// FIC: ChatPanel — AI chat panel with sessionStorage history, context-aware sending, and rate limit handling.
// FIC: ChatPanel — panel de chat IA con historial en sessionStorage, envío con contexto y manejo de rate limit.

import React, { useState, useEffect, useCallback } from "react";
import { MessageSquare, PanelRightClose } from "lucide-react";
import type { ChatMessage } from "./types";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInputBar } from "./ChatInputBar";
import { ChatContextBadge } from "./ChatContextBadge";
import { sendChatMessage, sendFundamentalCopilotMessage, sendOptionsAnalysisQA } from "../../services/chat/chatApi";
import { useSignalStore } from "../../store/signals";
import { useAppShellStore } from "../../store/appShell";

const STORAGE_KEY = "inversions.chat.history";
const MAX_MESSAGES = 100;
const TRIM_TO = 80;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadHistory(): ChatMessage[] {
  try {
    const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(STORAGE_KEY) : null;
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages: ChatMessage[]): void {
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  } catch {
    // silent — sessionStorage may be unavailable in some contexts
  }
}

function extractTickerFromText(text: string): string | null {
  const match = text.toUpperCase().match(/\b[A-Z]{1,5}(?:[.=][A-Z])?\b/);
  return match?.[0] ?? null;
}

// FIC: Serializa los parámetros de la estrategia activa como MD para el cerebro del chat.
// FIC: Serializes the active strategy params as MD for the chat brain.
function buildStrategyContextMD(
  strategy: { name: string } | undefined,
  params: {
    ticker: string;
    strikePrice: number;
    currentPrice: number;
    premiumPerContract: number;
    numberOfContracts: number;
    expirationDate: string;
    availableCapital: number;
    assumptions?: { impliedVolatility?: number; timeDecayModel?: string; interestRate?: number };
  } | undefined,
): string | undefined {
  if (!strategy || !params) return undefined;
  const a = params.assumptions ?? {};
  // Días a vencimiento derivados de la fecha de expiración (input clave del cálculo).
  const dte = params.expirationDate
    ? Math.max(1, Math.ceil((new Date(params.expirationDate).getTime() - Date.now()) / 86_400_000))
    : undefined;
  const lines = [
    `## Estrategia activa: ${strategy.name} — ${params.ticker}`,
    ``,
    `| Parámetro | Valor |`,
    `|-----------|-------|`,
    `| Ticker | ${params.ticker} |`,
    `| Precio actual | $${params.currentPrice} |`,
    `| Strike | $${params.strikePrice} |`,
    `| Prima/contrato | $${params.premiumPerContract} |`,
    `| Contratos | ${params.numberOfContracts} |`,
    `| Vencimiento | ${params.expirationDate} |`,
    `| Capital disponible | $${params.availableCapital} |`,
    a.impliedVolatility !== undefined ? `| Vol. implícita | ${a.impliedVolatility}% |` : "",
    a.timeDecayModel ? `| Theta decay | ${a.timeDecayModel} |` : "",
    a.interestRate !== undefined ? `| Tasa interés | ${a.interestRate}% |` : "",
    ``,
    `### Qué se usa para los cálculos`,
    `- **Breakeven, P&L y escenarios** se derivan de: strike ($${params.strikePrice}), prima ($${params.premiumPerContract}/contrato × ${params.numberOfContracts} contratos × 100 acciones) y precio actual ($${params.currentPrice}).`,
    `- **Escenarios ATM / +5% / -5%** se calculan moviendo el precio actual y reevaluando el payoff de la opción a vencimiento.`,
    `- **Probabilidad ITM y decaimiento temporal** usan: volatilidad implícita ${a.impliedVolatility ?? 25}%, modelo theta ${a.timeDecayModel ?? "LINEAR"}, tasa de interés ${a.interestRate ?? 4}%${dte !== undefined ? ` y ${dte} días a vencimiento` : ""}.`,
    `- **Margen requerido** aplica solo a estrategias vendedoras (short), según el capital disponible ($${params.availableCapital}).`,
  ].filter(Boolean);
  return lines.join("\n");
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory());
  const [pending, setPending] = useState(false);
  const { selectedInstrument, selectedOptionsStrategy, optionsStrategyParams, dashboardContext, signalContextMD } = useSignalStore();
  const { analysisCategory, setChatPanelCollapsed } = useAppShellStore();

  // FIC: Persist history to sessionStorage on every change.
  // FIC: Persistir historial en sessionStorage en cada cambio.
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  const trimHistory = useCallback((msgs: ChatMessage[]): ChatMessage[] => {
    if (msgs.length <= MAX_MESSAGES) return msgs;
    const systemMsg: ChatMessage = {
      id: generateId(),
      role: "system",
      content: "El historial fue comprimido para mantener el rendimiento.",
      context: null,
      timestamp: Date.now(),
      status: "ok",
    };
    return [systemMsg, ...msgs.slice(msgs.length - TRIM_TO)];
  }, []);

  const conversationHistoryRef = React.useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);

  useEffect(() => {
    conversationHistoryRef.current = [];
    setMessages([]);
  }, [selectedInstrument?.symbol, selectedOptionsStrategy?.name, analysisCategory]);

  const handleSend = useCallback(async (text: string) => {
    if (pending) return;

    const context = selectedInstrument?.symbol
      ? { symbol: selectedInstrument.symbol, timeframe: "1d", analysisCategory }
      : null;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      content: text,
      context,
      timestamp: Date.now(),
      status: "ok",
    };

    const assistantId = generateId();
    const assistantPending: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      context,
      timestamp: Date.now(),
      status: "pending",
    };

    setMessages((prev) => trimHistory([...prev, userMsg, assistantPending]));
    setPending(true);

    try {
      let responseContent: string;

      const strategyKeyMap: Record<string, string> = {
        "short-put":  "SHORT_PUT",
        "long-put":   "LONG_PUT",
        "short-call": "SHORT_CALL",
        "long-call":  "LONG_CALL",
      };

      if (selectedOptionsStrategy && optionsStrategyParams) {
        // Build dashboard context from store snapshot for enriched deterministic analysis
        const builtDashboardCtx = dashboardContext ? {
          fundamental: dashboardContext.fundamentalVerdict ? {
            verdict: dashboardContext.fundamentalVerdict,
            overallScore: dashboardContext.fundamentalScore ?? 0,
            recommendation: dashboardContext.fundamentalRecommendation ?? "",
            source: dashboardContext.fundamentalSource,
            sector: dashboardContext.fundamentalSector,
            industry: dashboardContext.fundamentalIndustry,
            marketCap: dashboardContext.fundamentalMarketCap,
            pe: dashboardContext.fundamentalPE,
            pb: dashboardContext.fundamentalPB,
            ps: dashboardContext.fundamentalPS,
            roe: dashboardContext.fundamentalROE,
            debtToEquity: dashboardContext.fundamentalDebtToEquity,
            eps: dashboardContext.fundamentalEPS,
            epsGrowth: dashboardContext.fundamentalEPSGrowth,
            dividendYield: dashboardContext.fundamentalDividendYield,
            revenueGrowth: dashboardContext.fundamentalRevenueGrowth,
            volatility: dashboardContext.fundamentalVolatility,
            beta: dashboardContext.fundamentalBeta,
            change52w: dashboardContext.fundamentalChange52w,
          } : undefined,
          confluence: dashboardContext.confluenceCallCount !== undefined ? {
            callCount:       dashboardContext.confluenceCallCount ?? 0,
            putCount:        dashboardContext.confluencePutCount  ?? 0,
            holdCount:       dashboardContext.confluenceHoldCount ?? 0,
            avgScore:        dashboardContext.confluenceAvgScore  ?? 0,
            dominantTrend:   dashboardContext.confluenceDominantTrend ?? "LATERAL",
            topSignals:      dashboardContext.topSignals ?? [],
          } : undefined,
          ohlc: dashboardContext.ohlcTrend ? {
            timeframe:   dashboardContext.ohlcTimeframe  ?? "1d",
            lastClose:   dashboardContext.ohlcLastClose  ?? 0,
            recentTrend: dashboardContext.ohlcTrend,
          } : undefined,
        } : undefined;

        const response = await sendOptionsAnalysisQA({
          ...optionsStrategyParams,
          question: text,
          selectedStrategy: strategyKeyMap[selectedOptionsStrategy.id],
          dashboardContext: builtDashboardCtx,
        });
        responseContent = response.answer;
      } else if (analysisCategory === "fundamental") {
        const ticker = selectedInstrument?.symbol ?? extractTickerFromText(text);
        if (!ticker) {
          throw new Error("Selecciona una empresa o escribe el ticker en tu pregunta para analizar fundamentales.");
        }
        const history = conversationHistoryRef.current;
        // Enrich question with active signal MD and active strategy MD if available
        const strategyMD = buildStrategyContextMD(selectedOptionsStrategy, optionsStrategyParams);
        const extraCtx = [
          signalContextMD ? `**Contexto de señal activa:**\n${signalContextMD}` : "",
          strategyMD ? `**Contexto de estrategia activa:**\n${strategyMD}` : "",
        ].filter(Boolean).join("\n\n---\n\n");
        const enrichedQuestion = extraCtx ? `${text}\n\n---\n${extraCtx}` : text;
        const response = await sendFundamentalCopilotMessage({
          ticker,
          question: enrichedQuestion,
          strategy: selectedOptionsStrategy?.name,
          conversationHistory: history,
        });
        responseContent = response.answer;
        conversationHistoryRef.current = [
          ...history,
          { role: "user", content: text },
          { role: "assistant", content: response.answer },
        ];
      } else {
        // Include active signal MD and active strategy MD as context for the chat brain
        const strategyMD = buildStrategyContextMD(selectedOptionsStrategy, optionsStrategyParams);
        const chatContext = [
          context?.analysisCategory,
          signalContextMD,
          strategyMD,
        ].filter(Boolean).join("\n\n---\n\n") || undefined;

        const response = await sendChatMessage({
          symbol: context?.symbol ?? "",
          timeframe: context?.timeframe ?? "1d",
          question: text,
          context: chatContext,
        });
        responseContent = response.explanation;
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: responseContent, status: "ok" }
            : m
        )
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error desconocido.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: errorMsg, status: "error" }
            : m
        )
      );
    } finally {
      setPending(false);
    }
  }, [pending, selectedInstrument, selectedOptionsStrategy, optionsStrategyParams, dashboardContext, signalContextMD, analysisCategory, trimHistory]);

  const handleRetry = useCallback((messageId: string) => {
    const errorMsg = messages.find((m) => m.id === messageId);
    const preceding = messages.slice().reverse().find((m) => m.role === "user");
    if (preceding) {
      void handleSend(preceding.content);
    } else if (errorMsg) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
  }, [messages, handleSend]);

  return (
    <div
      data-testid="chat-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          padding: "0 var(--space-sm)",
          height: "var(--nav-height)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--color-border)",
          gap: "var(--space-sm)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", minWidth: 0 }}>
          <button
            type="button"
            aria-label="Contraer chat IA"
            title="Contraer chat IA"
            onClick={() => setChatPanelCollapsed(true)}
            style={{
              width: 28,
              height: 28,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-muted)",
              flexShrink: 0,
              padding: 0
            }}
          >
            <PanelRightClose size={15} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", minWidth: 0 }}>
            <MessageSquare size={16} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
            <span style={{ fontWeight: "var(--font-weight-emphasis)", fontSize: "var(--font-size-sm)", color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Chat IA
            </span>
          </div>
        </div>
        <ChatContextBadge />
      </div>

      {/* Message list */}
      <ChatMessageList messages={messages} onRetry={handleRetry} />

      {/* Input */}
      <ChatInputBar onSend={(text) => void handleSend(text)} pending={pending} />
    </div>
  );
}
