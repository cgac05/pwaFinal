import React, { useEffect } from "react";

interface MetricSection {
  metric: string;
  score: number;
  tipoSenal: "CALL" | "PUT" | "HOLD";
  tendencia: "ALCISTA" | "BAJISTA" | "LATERAL";
  invertir: boolean;
  finding: string;
}

interface FundamentalData {
  price?: number;
  marketCap?: number;
  sector?: string;
  industry?: string;
  pe?: number;
  pb?: number;
  ps?: number;
  roe?: number;
  debtToEquity?: number;
  eps?: number;
  epsGrowth?: number;
  dividendYield?: number;
  volatility?: number;
  beta?: number;
  high52w?: number;
  low52w?: number;
  change52w?: number;
  revenue?: number;
  revenueGrowth?: number;
}

export interface ProjectionPoint {
  date: string;
  basePrice: number;
  bullishPrice: number;
  bearishPrice: number;
  basePnL: number;
  bullishPnL: number;
  bearishPnL: number;
}

export interface FundamentalProjection {
  ticker: string;
  strategy: string;
  verdict: "VIABLE" | "MARGINAL" | "NO_VIABLE";
  score: number;
  projectionFrom: string;
  projectionTo: string;
  days: number;
  initialPrice: number;
  expectedMove: number;
  expectedMovePercent: number;
  strike: number;
  premium: number;
  breakeven: number;
  maxLoss: number | "ILIMITADO";
  maxProfit: number | "ILIMITADO";
  scenarios: Array<{ label: "ATM" | "+5%" | "-5%"; price: number; profitLoss: number }>;
  path: ProjectionPoint[];
  drivers: string[];
  changeTriggers: string[];
  calculationSteps: string[];
  disclaimer: string;
}

export interface AnalysisResult {
  ticker: string;
  companyName: string;
  sourceId: string;
  overallScore: number;
  verdict: "VIABLE" | "NEUTRAL" | "NOT_VIABLE";
  recommendation: string;
  aiAnalysis: string;
  sections: MetricSection[];
  confluenceRows?: unknown[];
  projection?: FundamentalProjection;
  fundamentalData: FundamentalData;
  timestamp: string;
}

interface Props {
  result: AnalysisResult;
  onClose: () => void;
}

const verdictColor = (v: string) =>
  v === "VIABLE" ? "#4ade80" : v === "NEUTRAL" ? "#ffd43b" : "#f85149";

const signalColor = (s: string) =>
  s === "CALL" || s === "ALCISTA" ? "#4ade80"
  : s === "PUT" || s === "BAJISTA" ? "#f85149"
  : "#8b949e";

const scoreBg = (score: number) =>
  score >= 65 ? "rgba(74,222,128,0.12)" : score >= 40 ? "rgba(255,212,59,0.10)" : "rgba(248,81,73,0.10)";

function MetricRow({ s }: { s: MetricSection }) {
  const barWidth = `${s.score}%`;
  return (
    <div style={{ display: "grid", gap: "0.3rem", padding: "0.6rem 0.75rem", borderBottom: "1px solid var(--color-border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>{s.metric}</span>
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.72rem", color: signalColor(s.tipoSenal), fontWeight: 700 }}>
            {s.tipoSenal} · {s.tendencia}
          </span>
          <span style={{
            fontSize: "0.72rem", fontWeight: 800,
            padding: "0.1rem 0.45rem",
            borderRadius: "3px",
            background: scoreBg(s.score),
            color: verdictColor(s.score >= 65 ? "VIABLE" : s.score >= 40 ? "NEUTRAL" : "NOT_VIABLE")
          }}>
            {s.score}
          </span>
        </div>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "var(--color-border)", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: barWidth, borderRadius: 2,
          background: s.score >= 65 ? "#4ade80" : s.score >= 40 ? "#ffd43b" : "#f85149",
          transition: "width 0.5s ease"
        }} />
      </div>
      <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>{s.finding}</span>
    </div>
  );
}

function DataItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
      <span style={{ fontSize: "0.62rem", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em" }}>
        {label}
      </span>
      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: accent ? "var(--color-accent,#ffd43b)" : "var(--color-text)" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function fmt(n: number | undefined, decimals = 2, suffix = ""): string {
  if (n == null || !isFinite(n) || n === 0) return "—";
  return `${n.toFixed(decimals)}${suffix}`;
}

function fmtB(n: number | undefined): string {
  if (!n) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(0)}`;
}

export function FundamentalAnalysisModal({ result, onClose }: Props) {
  const [tab, setTab] = React.useState<"overview" | "metrics" | "ai" | "signals">("overview");
  const d = result.fundamentalData;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "0.4rem 0.9rem",
    border: "none",
    borderBottom: active ? "2px solid var(--color-accent,#ffd43b)" : "2px solid transparent",
    background: "transparent",
    color: active ? "var(--color-accent,#ffd43b)" : "var(--color-text-muted)",
    fontWeight: active ? 700 : 500,
    fontSize: "0.78rem",
    cursor: "pointer",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em"
  });

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.72)",
          zIndex: 1000,
          backdropFilter: "blur(2px)"
        }}
      />

      {/* Modal panel */}
      <div style={{
        position: "fixed",
        top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        zIndex: 1001,
        width: "min(92vw, 880px)",
        maxHeight: "88vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-surface, #1a1d23)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md, 8px)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        overflow: "hidden"
      }}>

        {/* Header */}
        <div style={{
          padding: "1rem 1.25rem",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
          background: "var(--color-surface-raised, #22262e)"
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "1.3rem", fontWeight: 800 }}>{result.ticker}</span>
              <span style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>{result.companyName}</span>
              {d.price && (
                <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--color-accent,#ffd43b)" }}>
                  ${d.price.toFixed(2)}
                </span>
              )}
              <span style={{
                padding: "0.2rem 0.65rem",
                borderRadius: "2rem",
                fontWeight: 800,
                fontSize: "0.72rem",
                background: scoreBg(result.overallScore),
                color: verdictColor(result.verdict),
                border: `1px solid ${verdictColor(result.verdict)}40`
              }}>
                {result.verdict} · {result.overallScore}/100
              </span>
              <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", padding: "0.15rem 0.5rem", border: "1px solid var(--color-border)", borderRadius: "3px" }}>
                {result.sourceId.toUpperCase()}
              </span>
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              {d.sector ?? ""}{d.industry ? ` · ${d.industry}` : ""}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm,4px)",
              color: "var(--color-text-muted)",
              fontSize: "1rem",
              cursor: "pointer",
              padding: "0.2rem 0.6rem",
              flexShrink: 0
            }}
            title="Cerrar (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--color-border)", padding: "0 0.75rem", background: "var(--color-surface-raised,#22262e)" }}>
          {(["overview", "metrics", "ai", "signals"] as const).map((t) => (
            <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>
              {t === "overview" ? "Resumen" : t === "metrics" ? "Métricas" : t === "ai" ? "Análisis IA" : "Señales"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem" }}>

          {/* OVERVIEW TAB */}
          {tab === "overview" && (
            <div style={{ display: "grid", gap: "1rem" }}>
              {/* Price overview */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0.75rem" }}>
                <DataItem label="Precio" value={d.price ? `$${d.price.toFixed(2)}` : "—"} accent />
                <DataItem label="Market Cap" value={fmtB(d.marketCap)} />
                <DataItem label="52w High" value={d.high52w ? `$${d.high52w.toFixed(2)}` : "—"} />
                <DataItem label="52w Low"  value={d.low52w  ? `$${d.low52w.toFixed(2)}`  : "—"} />
                <DataItem label="Cambio 52w" value={fmt(d.change52w, 2, "%")} />
                <DataItem label="Volatilidad" value={fmt(d.volatility, 2, "%")} />
                <DataItem label="Beta" value={fmt(d.beta, 2)} />
                <DataItem label="Div Yield" value={fmt(d.dividendYield, 2, "%")} />
              </div>

              {/* Ratios */}
              <div>
                <p style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 0.5rem" }}>
                  Ratios de Valoración
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0.75rem" }}>
                  <DataItem label="P/E"  value={fmt(d.pe, 2)} />
                  <DataItem label="P/B"  value={fmt(d.pb, 2)} />
                  <DataItem label="P/S"  value={fmt(d.ps, 2)} />
                  <DataItem label="ROE"  value={fmt(d.roe, 2, "%")} />
                  <DataItem label="D/E"  value={fmt(d.debtToEquity, 2)} />
                  <DataItem label="EPS"  value={d.eps ? `$${d.eps.toFixed(2)}` : "—"} />
                  <DataItem label="EPS Growth" value={fmt(d.epsGrowth, 2, "%")} />
                  <DataItem label="Rev Growth" value={fmt(d.revenueGrowth, 2, "%")} />
                </div>
              </div>

              {/* Recommendation */}
              <div style={{ background: "var(--color-surface-raised,#22262e)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm,4px)", padding: "0.75rem" }}>
                <p style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", fontWeight: 700, textTransform: "uppercase", margin: "0 0 0.35rem" }}>
                  Perspectiva del Análisis
                </p>
                <p style={{ margin: 0, fontSize: "0.85rem", lineHeight: 1.5 }}>{result.recommendation}</p>
              </div>
            </div>
          )}

          {/* METRICS TAB */}
          {tab === "metrics" && (
            <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm,4px)", overflow: "hidden" }}>
              {result.sections.length === 0
                ? <p style={{ padding: "1rem", color: "var(--color-text-muted)", textAlign: "center" }}>Sin métricas seleccionadas.</p>
                : result.sections.map((s) => <MetricRow key={s.metric} s={s} />)
              }
            </div>
          )}

          {/* AI ANALYSIS TAB */}
          {tab === "ai" && (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <div style={{
                background: "var(--color-surface-raised,#22262e)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm,4px)",
                padding: "1rem",
                fontSize: "0.85rem",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap"
              }}>
                {result.aiAnalysis}
              </div>
              <p style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", fontStyle: "italic", margin: 0 }}>
                Este análisis es informativo y educativo. No constituye asesoramiento financiero ni recomendación de inversión.
                Siempre consulte con un asesor financiero calificado antes de tomar decisiones de inversión.
              </p>
            </div>
          )}

          {/* SIGNALS TAB */}
          {tab === "signals" && (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
                Señales A_FUNDAMENTAL generadas — se añadirán a la tabla de confluencia al cerrar.
              </p>
              <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm,4px)", overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                  <thead>
                    <tr>
                      {["SubCore", "Señal", "Tendencia", "Score", "Invertir", "Estado"].map((h) => (
                        <th key={h} style={{ padding: "0.4rem 0.5rem", background: "var(--color-surface,#14171c)", textAlign: "left", fontSize: "0.65rem", borderBottom: "1px solid var(--color-border)", fontWeight: 700, textTransform: "uppercase" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.sections.map((s) => (
                      <tr key={s.metric}>
                        <td style={{ padding: "0.4rem 0.5rem", borderBottom: "1px solid var(--color-border)", fontWeight: 600 }}>{s.metric}</td>
                        <td style={{ padding: "0.4rem 0.5rem", borderBottom: "1px solid var(--color-border)", color: signalColor(s.tipoSenal), fontWeight: 700 }}>{s.tipoSenal}</td>
                        <td style={{ padding: "0.4rem 0.5rem", borderBottom: "1px solid var(--color-border)", color: signalColor(s.tendencia) }}>{s.tendencia}</td>
                        <td style={{ padding: "0.4rem 0.5rem", borderBottom: "1px solid var(--color-border)" }}>
                          <span style={{ background: scoreBg(s.score), padding: "0.1rem 0.4rem", borderRadius: "3px", fontWeight: 700, color: verdictColor(s.score >= 65 ? "VIABLE" : s.score >= 40 ? "NEUTRAL" : "NOT_VIABLE") }}>
                            {s.score}
                          </span>
                        </td>
                        <td style={{ padding: "0.4rem 0.5rem", borderBottom: "1px solid var(--color-border)", color: s.invertir ? "#4ade80" : "#8b949e" }}>{s.invertir ? "SI" : "NO"}</td>
                        <td style={{ padding: "0.4rem 0.5rem", borderBottom: "1px solid var(--color-border)", color: s.score >= 30 ? "#4ade80" : "#8b949e" }}>{s.score >= 30 ? "ACTIVA" : "DEGRADADA"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "0.75rem 1.25rem",
          borderTop: "1px solid var(--color-border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--color-surface-raised,#22262e)",
          fontSize: "0.72rem",
          color: "var(--color-text-muted)",
          gap: "0.5rem",
          flexWrap: "wrap"
        }}>
          <span>{result.timestamp ? new Date(result.timestamp).toLocaleString() : ""} · Fuente: {result.sourceId.toUpperCase()}</span>
          <button
            onClick={onClose}
            style={{
              background: "var(--color-accent,#ffd43b)",
              color: "#000",
              fontWeight: 800,
              fontSize: "0.78rem",
              padding: "0.4rem 1rem",
              border: 0,
              borderRadius: "var(--radius-sm,4px)",
              cursor: "pointer",
              textTransform: "uppercase"
            }}
          >
            Cerrar y añadir señales a tabla
          </button>
        </div>
      </div>
    </>
  );
}

export default FundamentalAnalysisModal;
