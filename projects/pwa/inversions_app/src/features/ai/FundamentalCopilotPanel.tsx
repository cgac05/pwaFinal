import React, { useRef, useEffect, useState } from "react";
import type { FundamentalProjection } from "../dashboard/simulation/FundamentalAnalysisModal";

interface ChatEntry {
  role: "user" | "assistant";
  content: string;
  disclaimer?: string;
  sourceContext?: string[];
}

interface CopilotResponse {
  answer: string;
  disclaimer: string;
  sourceContext: string[];
  reasoningTrace: string[];
}

const PRESET_TICKERS = ["NVDA", "AAPL", "MSFT", "SPY"];

interface Props {
  defaultTicker?: string;
  simulationContext?: FundamentalProjection;
}

/**
 * FIC: Panel de chat del Copilot Fundamental IA.
 * Llama a POST /api/team-03/ai/fundamental/copilot con ticker + pregunta.
 * Muestra historial de conversación y disclaimer regulatorio.
 */
export function FundamentalCopilotPanel({ defaultTicker = "AAPL", simulationContext }: Props) {
  const [ticker, setTicker]     = useState(defaultTicker);
  const [question, setQuestion] = useState("");
  const [history, setHistory]   = useState<ChatEntry[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTicker(defaultTicker);
    setHistory(simulationContext ? [{
      role: "assistant",
      content: `Simulacion cargada para ${simulationContext.ticker}: ${simulationContext.strategy}, veredicto ${simulationContext.verdict} (${simulationContext.score}/100), rango ${simulationContext.projectionFrom} -> ${simulationContext.projectionTo}. Puedes preguntar por viabilidad, razones fundamentales, riesgos, escenarios o calculo.`,
      disclaimer: simulationContext.disclaimer
    }] : []);
    setError(null);
  }, [defaultTicker, simulationContext]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  async function sendMessage(overrideQuestion?: string) {
    const q = (overrideQuestion ?? question).trim();
    if (!q || loading) return;

    setHistory((h) => [...h, { role: "user", content: q }]);
    setQuestion("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/team-03/ai/fundamental/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: ticker.toUpperCase(),
          question: q,
          includeStrategyRecommendation: Boolean(simulationContext),
          simulationContext
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as CopilotResponse;
      setHistory((h) => [
        ...h,
        {
          role: "assistant",
          content: data.answer,
          disclaimer: data.disclaimer,
          sourceContext: data.sourceContext
        }
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al conectar con el copilot");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <h2 style={{ margin: 0 }}>Copilot Fundamental IA</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          {PRESET_TICKERS.map((sym) => (
            <button
              key={sym}
              className={`btn-ghost ${ticker === sym ? "active" : ""}`}
              onClick={() => { setTicker(sym); setHistory([]); setError(null); }}
              style={{ fontWeight: ticker === sym ? 700 : 400, minWidth: 52 }}
            >
              {sym}
            </button>
          ))}
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            style={{ width: 72, textAlign: "center", fontWeight: 700, fontSize: "0.85rem" }}
            placeholder="Otro…"
          />
        </div>
      </div>

      {/* Chat history */}
      <div style={{
        minHeight: 200,
        maxHeight: 400,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        padding: "0.5rem",
        background: "var(--color-bg)",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--color-border)"
      }}>
        {history.length === 0 && !loading && (
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem", textAlign: "center", margin: "auto" }}>
            Escribe una pregunta sobre el análisis fundamental de {ticker}.
          </p>
        )}

        {history.map((entry, i) => (
          <div key={i} style={{
            display: "flex",
            flexDirection: "column",
            alignItems: entry.role === "user" ? "flex-end" : "flex-start",
            gap: "0.25rem"
          }}>
            <div style={{
              maxWidth: "85%",
              padding: "0.6rem 0.9rem",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.875rem",
              lineHeight: 1.55,
              background: entry.role === "user"
                ? "var(--color-accent)"
                : "var(--color-surface-raised)",
              color: entry.role === "user" ? "white" : "var(--color-text)",
              whiteSpace: "pre-wrap"
            }}>
              {entry.content}
            </div>
            {entry.disclaimer && (
              <p style={{
                fontSize: "0.7rem",
                color: "var(--color-text-muted)",
                maxWidth: "85%",
                margin: 0,
                fontStyle: "italic"
              }}>
                {entry.disclaimer}
              </p>
            )}
          </div>
        ))}

        {loading && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            color: "var(--color-text-muted)",
            fontSize: "0.875rem"
          }}>
            <span className="skeleton" style={{ width: 8, height: 8, borderRadius: "50%", display: "inline-block" }} />
            <span className="skeleton" style={{ width: 8, height: 8, borderRadius: "50%", display: "inline-block" }} />
            <span className="skeleton" style={{ width: 8, height: 8, borderRadius: "50%", display: "inline-block" }} />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <p style={{ color: "var(--color-sell)", fontSize: "0.8rem", margin: 0 }}>
          {error}
        </p>
      )}

      {simulationContext && (
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {[
            "Por que es VIABLE / MARGINAL / NO_VIABLE?",
            "Que riesgos tiene la estrategia?",
            "Que podria cambiar la opinion?",
            "Como calculaste la proyeccion?"
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="btn-ghost"
              onClick={() => void sendMessage(prompt)}
              disabled={loading}
              style={{ fontSize: "0.75rem" }}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Pregunta sobre ${ticker}… (Enter para enviar, Shift+Enter salto de línea)`}
          rows={2}
          style={{
            flex: 1,
            resize: "vertical",
            fontFamily: "inherit",
            fontSize: "0.875rem",
            padding: "0.5rem 0.75rem",
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--color-text)"
          }}
          disabled={loading}
        />
        <button
          className="btn-primary"
          onClick={() => void sendMessage()}
          disabled={loading || !question.trim()}
          style={{ height: 56, whiteSpace: "nowrap" }}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
