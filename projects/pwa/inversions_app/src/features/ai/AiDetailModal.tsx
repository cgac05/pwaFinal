import React, { useState } from "react";
import { ContentModal } from "../../components/ui/ContentModal";
import { MarkdownContent } from "../../components/ui/MarkdownContent";
import type { ConfluenceSignalRow } from "../../services/signals/confluenceTableApi";
import { ObservationsTab } from "../dashboard/ObservationsTab";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  ticker: string;
  signalRow?: ConfluenceSignalRow;
  activeStrategy?: string;
  precalculatedRows?: ConfluenceSignalRow[];
  onAiRetry?: (row: ConfluenceSignalRow) => void;
}

type Tab = "resumen" | "preprompt" | "entradas" | "canonica";

const TAB_LABELS: Record<Tab, string> = {
  resumen: "Resumen IA",
  preprompt: "Preprompt",
  entradas: "Valor de entrada",
  canonica: "Observaciones",
};

const strengthBar = (value: number, colorType: "buy" | "sell" | "neutral" = "buy") => {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const color = colorType === "buy" ? "var(--color-buy)" : colorType === "sell" ? "var(--color-sell)" : "var(--color-accent)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
      <div
        style={{
          width: 80,
          height: 8,
          backgroundColor: "var(--color-surface-raised)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: color,
            borderRadius: 4,
          }}
        />
      </div>
      <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", fontWeight: 600 }}>
        {pct}%
      </span>
    </div>
  );
};

export function AiDetailModal({ isOpen, onClose, ticker, signalRow, activeStrategy, precalculatedRows, onAiRetry }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("resumen");

  const [isRetrying, setIsRetrying] = useState(false);

  if (!signalRow) return null;

  const subtitle = `Estado: ${signalRow.estado} · Resuelto: ${new Date(signalRow.computed_at).toLocaleTimeString()}`;

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    padding: "var(--space-xs) var(--space-md)",
    fontSize: "var(--font-size-sm)",
    fontWeight: activeTab === tab ? 600 : 400,
    color: activeTab === tab ? "var(--color-accent)" : "var(--color-text-muted)",
    borderTop: "none",
    borderLeft: "none",
    borderRight: "none",
    borderBottom: activeTab === tab ? `2px solid var(--color-accent)` : "2px solid transparent",
    cursor: "pointer",
    background: "none",
    transition: "color var(--duration-fast) var(--easing-standard)",
  });

  const decisionColor = signalRow.tipoSenal === "CALL" ? "var(--color-buy)" : signalRow.tipoSenal === "PUT" ? "var(--color-sell)" : "var(--color-hold)";
  const decisionBg = signalRow.tipoSenal === "CALL" ? "rgba(0,168,126,0.15)" : signalRow.tipoSenal === "PUT" ? "rgba(248,81,73,0.15)" : "rgba(139,148,158,0.15)";
  const scoreAbs = Math.abs(signalRow.score);

  return (
    <ContentModal
      isOpen={isOpen}
      onClose={onClose}
      title={`${ticker} — ANÁLISIS DE INTELIGENCIA ARTIFICIAL`}
      subtitle={subtitle}
    >
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: "var(--space-lg)",
          borderBottom: "1px solid var(--color-border)",
          overflowX: "auto"
        }}
      >
        {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
          <button key={tab} style={tabStyle(tab)} onClick={() => setActiveTab(tab)}>
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 400 }}>
        {activeTab === "resumen" && (
          <div>
            {/* Metricas graficas */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-md)", marginBottom: "var(--space-xl)", paddingBottom: "var(--space-lg)", borderBottom: "1px solid var(--color-border-subtle)" }}>
              <div>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-xs)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Decisión Final</p>
                <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: "var(--radius-pill)", backgroundColor: decisionBg, color: decisionColor, fontWeight: 700, fontSize: "var(--font-size-base)" }}>
                  {signalRow.tipoSenal === "CALL" || signalRow.tipoSenal === "PUT" ? "SÍ" : "NO"} ({signalRow.tipoSenal})
                </span>
              </div>
              
              <div>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-xs)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Confianza (Score)</p>
                {strengthBar(scoreAbs, signalRow.score > 0 ? "buy" : signalRow.score < 0 ? "sell" : "neutral")}
              </div>

              <div>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-xs)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Tendencia Inferida</p>
                <span style={{ fontSize: "var(--font-size-base)", fontWeight: 600 }}>
                  {signalRow.tendencia}
                </span>
              </div>

              <div>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-xs)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Modelo</p>
                <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text)", fontWeight: 500, padding: "2px 6px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--color-surface-raised)" }}>
                  {signalRow.observacion?.metricas?.MODEL_VERSION || "LLM"}
                </span>
              </div>
            </div>

            {/* Respuesta generada */}
            <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-accent)", marginBottom: "var(--space-xs)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Respuesta Generada</p>
            <div style={{ background: "var(--color-surface-raised)", padding: "var(--space-md)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border-subtle)" }}>
              <MarkdownContent content={signalRow.observacion?.explicacion || ""} />
            </div>
            {/* Reintento aislado para IA degradada */}
            {(signalRow.observacion?.explicacion?.includes("No pudimos conectarnos con el modelo") || signalRow.observacion?.explicacion?.includes("[Modo de Respaldo]")) && (
              <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <button
                  className="btn-primary"
                  disabled={isRetrying}
                  style={isRetrying ? { opacity: 0.7, cursor: "wait", position: "relative", overflow: "hidden" } : {}}
                  onClick={async () => {
                    if (!precalculatedRows) return;
                    setIsRetrying(true);
                    try {
                      const res = await fetch("/api/simulation/retry-ai", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ticket: signalRow.ticket, timeframe: signalRow.timeframe, sourceInputHash: signalRow.source_input_hash, precalculatedRows })
                      });
                      if (!res.ok) throw new Error("retry failed");
                      const newRow = await res.json();
                      if (onAiRetry) onAiRetry(newRow);
                    } catch (err) {
                      console.error("retry-ai failed", err);
                      alert("Fallo al reintentar la IA. Revisa la consola.");
                    } finally {
                      setIsRetrying(false);
                    }
                  }}
                >
                  {isRetrying ? (
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className="spinner-small" style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 1s linear infinite", display: "inline-block" }}></span>
                      Conectando...
                    </span>
                  ) : (
                    "Reintentar IA"
                  )}
                </button>
                <style>{`
                  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                `}</style>
              </div>
            )}
          </div>
        )}

        {activeTab === "preprompt" && (
          <div style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "var(--space-md)", height: "100%" }}>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "0.8rem", fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>
              {String(signalRow.observacion?.metricas?.PREPROMPT || "No disponible")}
            </pre>
          </div>
        )}

        {activeTab === "entradas" && (
          <div style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "var(--space-md)", height: "100%" }}>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "0.8rem", fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>
              {String(signalRow.observacion?.metricas?.VALOR_ENTRADA || "No disponible")}
            </pre>
          </div>
        )}

        {activeTab === "canonica" && (
          <div>
            <ObservationsTab row={signalRow} activeStrategy={activeStrategy} />
          </div>
        )}
      </div>
    </ContentModal>
  );
}
