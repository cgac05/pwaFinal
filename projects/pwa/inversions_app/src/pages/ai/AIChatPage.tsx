import React, { useCallback, useState } from "react";
import { ChatHistory } from "../../components/ai/ChatHistory";
import { useChatStore } from "../../store/chat";
import { useSignalStore } from "../../store/signals";
import {
  buildFallbackDashboardSnapshot,
  composeDashboardChatReply
} from "../../services/ai/dashboardChatComposer";
import {
  getDashboardOrchestrator,
  type DashboardOrchestratorResponse
} from "../../services/signals/signalApi";

const DASHBOARD_FETCH_TIMEOUT_MS = 4500;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error("DASHBOARD_CONTEXT_TIMEOUT")), timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

function snapshotMatchesTicker(snapshot: DashboardOrchestratorResponse | undefined, ticker: string): boolean {
  if (!snapshot) {
    return false;
  }

  const normalizedTicker = ticker.trim().toUpperCase();
  return snapshot.instruments.some((instrument) => instrument.toUpperCase() === normalizedTicker)
    || snapshot.cards.some((card) => card.instrument.toUpperCase() === normalizedTicker);
}

async function loadDashboardSnapshot(
  ticker: string,
  currentPrice: number,
  cachedSnapshot: DashboardOrchestratorResponse | undefined
): Promise<DashboardOrchestratorResponse> {
  if (snapshotMatchesTicker(cachedSnapshot, ticker)) {
    return cachedSnapshot as DashboardOrchestratorResponse;
  }

  try {
    return await withTimeout(
      getDashboardOrchestrator({ instruments: ticker, timeframe: "1d" }),
      DASHBOARD_FETCH_TIMEOUT_MS
    );
  } catch {
    return buildFallbackDashboardSnapshot(ticker, currentPrice);
  }
}

export function AIChatPage() {
  const { selectedInstrument, selectedSignal, dashboardSnapshot } = useSignalStore();
  const { addMessage, updateMessage } = useChatStore();
  const [ticker, setTicker] = useState(() => selectedInstrument?.symbol ?? dashboardSnapshot?.instruments[0] ?? "SPY");
  const [currentPrice, setCurrentPrice] = useState("450");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;

    const activeTicker = ticker.trim().toUpperCase();
    const price = parseFloat(currentPrice);
    if (!activeTicker || Number.isNaN(price) || price <= 0) return;

    setInput("");
    setLoading(true);

    const userMessageId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    addMessage({
      id: userMessageId,
      role: "user",
      content: question,
      timestamp: new Date().toISOString(),
      status: "completed"
    });

    const assistantMessageId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    addMessage({
      id: assistantMessageId,
      role: "assistant",
      content: "Analizando datos del dashboard...",
      timestamp: new Date().toISOString(),
      status: "pending"
    });

    try {
      const snapshot = await loadDashboardSnapshot(activeTicker, price, dashboardSnapshot);
      const reply = composeDashboardChatReply({
        question,
        ticker: activeTicker,
        currentPrice: price,
        dashboard: snapshot,
        selectedSignal
      });

      updateMessage(assistantMessageId, {
        content: reply,
        status: "completed"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo construir la respuesta desde el dashboard.";
      updateMessage(assistantMessageId, {
        content: `No pude leer el dashboard para responder: ${message}`,
        status: "error"
      });
    } finally {
      setLoading(false);
    }
  }, [input, loading, ticker, currentPrice, addMessage, updateMessage, dashboardSnapshot, selectedSignal]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "1rem",
      height: "calc(100vh - 3rem)",
      maxHeight: "calc(100vh - 3rem)"
    }}>
      <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
        Chat IA — Coberturas
      </h1>

      <div className="card" style={{ borderColor: "var(--color-hold)", background: "rgba(255, 193, 7, 0.08)" }}>
        <p style={{ margin: 0, color: "var(--color-text)", fontSize: "0.85rem", lineHeight: 1.5 }}>
          Este chat responde con el snapshot actual del dashboard de inversiones y no guarda memoria entre preguntas.
        </p>
      </div>

      <div className="card" style={{
        display: "flex",
        gap: "0.75rem",
        alignItems: "flex-end",
        flexWrap: "wrap",
        padding: "0.65rem 1rem"
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Ticker</label>
          <input
            type="text"
            value={ticker}
            onChange={(event) => setTicker(event.target.value.toUpperCase())}
            style={{ width: "80px", padding: "0.4rem", background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", color: "var(--color-text)", fontSize: "0.85rem" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Precio</label>
          <input
            type="number"
            value={currentPrice}
            onChange={(event) => setCurrentPrice(event.target.value)}
            step="0.01"
            style={{ width: "80px", padding: "0.4rem", background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", color: "var(--color-text)", fontSize: "0.85rem" }}
          />
        </div>
      </div>

      <div className="card" style={{
        flex: 1,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column"
      }}>
        <ChatHistory />
      </div>

      {loading && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.8rem",
          color: "var(--color-text-muted)",
          padding: "0 0.5rem"
        }}>
          <div className="skeleton" style={{ width: "12px", height: "12px", borderRadius: "50%" }} />
          <span>Analizando dashboard...</span>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ej: ¿Cuál es la lectura del riesgo en SPY según el dashboard?"
          disabled={loading}
          rows={2}
          style={{
            flex: 1,
            padding: "0.6rem",
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--color-text)",
            fontSize: "0.85rem",
            resize: "none",
            fontFamily: "inherit"
          }}
        />
        <button
          className="btn-primary"
          onClick={() => void handleSend()}
          disabled={loading || !input.trim() || !ticker.trim()}
          style={{ padding: "0.5rem 1.5rem", alignSelf: "flex-end" }}
        >
          {loading ? "..." : "Enviar"}
        </button>
      </div>
    </div>
  );
}