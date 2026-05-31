// FIC: Fundamental Analysis Panel — replaces placeholder in MainDashboard. (EN)
// FIC: Panel de Análisis Fundamental — reemplaza el placeholder en MainDashboard. (ES)

import { useEffect, useState } from "react";
import { useSignalStore } from "../../store/signals";
import { useFundamentalAnalysis } from "../../hooks/useFundamentalAnalysis";
import { formatCurrency } from "../../utils/format";
import type { FundamentalData, OptionStrategyResult, PriceScenario } from "../../services/fundamental/fundamentalApi";
import {
  optionStrategyResultToApiShape,
  type OptionStrategyAnalysis,
} from "./simulation/OptionStrategyParamsModal";
import { ProjectionSimulationPanel } from "./simulation/ProjectionSimulationPanel";
import { getMarketQuotes } from "../../services/signals/marketApi";

// ─── Metric helpers ───────────────────────────────────────────────────────────

function fmtNum(val: number | undefined, decimals = 2, suffix = ""): string {
  if (val === undefined || val === null || isNaN(val)) return "—";
  return `${val.toFixed(decimals)}${suffix}`;
}

function fmtPct(val: number | undefined): string {
  if (val === undefined || val === null || isNaN(val)) return "—";
  return `${val.toFixed(2)}%`;
}

function metricColor(val: number | undefined, goodThreshold: number, badThreshold: number, higher = true): string {
  if (val === undefined || val === null) return "var(--color-text-muted)";
  if (higher) return val >= goodThreshold ? "var(--color-buy)" : val <= badThreshold ? "var(--color-sell)" : "var(--color-text)";
  return val <= goodThreshold ? "var(--color-buy)" : val >= badThreshold ? "var(--color-sell)" : "var(--color-text)";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = score >= 70 ? "var(--color-buy)" : score >= 40 ? "var(--color-hold)" : "var(--color-sell)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{
        fontSize: "var(--font-size-xl)",
        fontWeight: "var(--font-weight-bold)" as any,
        color,
        lineHeight: 1,
      }}>
        {Math.round(score)}
        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontWeight: "normal" }}>/100</span>
      </div>
      <div style={{
        width: "100%",
        height: 4,
        backgroundColor: "var(--color-surface-raised)",
        borderRadius: "var(--radius-pill)",
        overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`,
          height: "100%",
          backgroundColor: color,
          borderRadius: "var(--radius-pill)",
          transition: "width var(--duration-normal) var(--easing-standard)",
        }} />
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      padding: "var(--space-sm) var(--space-md)",
      background: "var(--color-surface-raised)",
      borderRadius: "var(--radius-sm)",
      border: "1px solid var(--color-border-subtle)",
    }}>
      <p style={{
        fontSize: 10,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--color-text-muted)",
        margin: "0 0 2px",
        fontWeight: 600,
      }}>{label}</p>
      <p style={{
        fontSize: "var(--font-size-sm)",
        fontWeight: "var(--font-weight-bold)" as any,
        margin: 0,
        color: color ?? "var(--color-text)",
      }}>{value}</p>
    </div>
  );
}

function ScenarioCard({ scenario, icon, accent }: { scenario: PriceScenario; icon: string; accent: string }) {
  const isPositive = scenario.profitLoss >= 0;
  const pnlColor = isPositive ? "var(--color-buy)" : "var(--color-sell)";
  return (
    <div style={{
      flex: 1,
      padding: "var(--space-md)",
      background: "var(--color-surface-raised)",
      borderRadius: "var(--radius-md)",
      border: `1px solid ${accent}`,
      borderTopWidth: 3,
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-xs)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
        <span style={{ fontSize: "var(--font-size-base)" }}>{icon}</span>
        <span style={{
          fontSize: "var(--font-size-xs)",
          fontWeight: "var(--font-weight-bold)" as any,
          color: accent,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}>{scenario.priceMovement}</span>
      </div>
      <div style={{
        fontSize: "var(--font-size-lg)",
        fontWeight: "var(--font-weight-bold)" as any,
        color: "var(--color-text)",
      }}>
        ${scenario.priceAtScenario.toFixed(2)}
      </div>
      <div style={{ display: "flex", gap: "var(--space-md)", fontSize: "var(--font-size-xs)" }}>
        <span>
          P&L:{" "}
          <strong style={{ color: pnlColor }}>
            {isPositive ? "+" : ""}${scenario.profitLoss.toFixed(2)}
          </strong>
        </span>
        <span>
          ROI:{" "}
          <strong style={{ color: pnlColor }}>
            {isPositive ? "+" : ""}{scenario.roi.toFixed(1)}%
          </strong>
        </span>
      </div>
    </div>
  );
}

function RiskWarning({ severity, message }: { severity: "high" | "medium"; message: string }) {
  const isHigh = severity === "high";
  const borderColor = isHigh ? "var(--color-sell)" : "var(--color-warning)";
  const bgColor = isHigh ? "rgba(226, 59, 74, 0.08)" : "rgba(236, 126, 0, 0.08)";
  const icon = isHigh ? "🔴" : "🟡";
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "var(--space-sm)",
      padding: "var(--space-sm) var(--space-md)",
      borderLeft: `3px solid ${borderColor}`,
      background: bgColor,
      borderRadius: `0 var(--radius-xs) var(--radius-xs) 0`,
      fontSize: "var(--font-size-sm)",
      color: "var(--color-text)",
    }}>
      <span>{icon}</span>
      <span>{message}</span>
    </div>
  );
}

function SkeletonBlock({ height = 120 }: { height?: number }) {
  return (
    <div
      className="skeleton"
      style={{ height, borderRadius: "var(--radius-md)", width: "100%" }}
    />
  );
}

// ─── Investment profiles ──────────────────────────────────────────────────────

const PROFILES = [
  { id: "Value", label: "Value" },
  { id: "Growth", label: "Growth" },
  { id: "Income", label: "Income" },
] as const;

const FUNDAMENTAL_METRICS = ["Valoración", "Crecimiento", "Rentabilidad", "Salud Financiera", "Flujo de Caja", "Riesgo", "Ventaja Competitiva"];

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoPlusDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

// ─── Main component ──────────────────────────────────────────────────────────

interface Props {
  optionStrategyAnalysis?: OptionStrategyAnalysis | null;
  autoRunKey?: number;
  onAnalysisComplete?: (data: ReturnType<typeof useFundamentalAnalysis>["data"]) => void;
}

export function FundamentalAnalysisPanel({ optionStrategyAnalysis, autoRunKey = 0, onAnalysisComplete }: Props) {
  const { selectedInstrument, selectedStrike } = useSignalStore();
  const selectedSymbol = selectedInstrument?.symbol ?? "SPY";
  const { data, optionsResult, loading, error, analyze } = useFundamentalAnalysis();
  const [profile, setProfile] = useState("Value");
  const displayedOptionsResult = optionStrategyAnalysis
    ? optionStrategyResultToApiShape(optionStrategyAnalysis) as unknown as OptionStrategyResult
    : optionsResult;

  useEffect(() => {
    if (data) onAnalysisComplete?.(data);
  }, [data, onAnalysisComplete]);

  const resolveCurrentPrice = async (): Promise<number | undefined> => {
    const strategyPrice = Number(optionStrategyAnalysis?.params.currentPrice);
    if (Number.isFinite(strategyPrice) && strategyPrice > 0) return strategyPrice;

    try {
      const quotes = await getMarketQuotes([selectedSymbol]);
      const quote = quotes.quotes.find((item) => item.symbol.toUpperCase() === selectedSymbol.toUpperCase());
      if (quote && quote.price > 0) return quote.price;
    } catch {
      // El backend conserva su fallback si no hay quote disponible.
    }

    return undefined;
  };

  const runFundamentalAnalysis = async () => {
    const projectionFrom = isoToday();
    const projectionTo = isoPlusDays(30);
    const currentPrice = await resolveCurrentPrice();
    analyze({
      ticker: selectedSymbol,
      source: "finviz",
      investmentProfile: profile,
      horizon: "Mediano plazo",
      selectedMetrics: FUNDAMENTAL_METRICS,
      strategy: optionStrategyAnalysis?.strategy ?? "Long Call",
      comparisons: ["Comparar con S&P500"],
      projectionFrom,
      projectionTo,
      currentPrice,
    });
  };

  useEffect(() => {
    if (autoRunKey <= 0) return;
    void runFundamentalAnalysis();
  }, [autoRunKey]);

  // ─── Build warnings ────────────────────────────────────────────────────────

  function buildWarnings(): Array<{ severity: "high" | "medium"; message: string }> {
    const warnings: Array<{ severity: "high" | "medium"; message: string }> = [];

    if ((selectedStrike || optionStrategyAnalysis) && displayedOptionsResult) {
      // Premium > 10% del strike
      const strike = selectedStrike?.strike ?? Number(optionStrategyAnalysis?.params.strikePrice ?? 0);
      const premium = selectedStrike?.premium ?? Number(optionStrategyAnalysis?.params.premium ?? 0);
      const premiumPct = strike > 0 ? (premium / strike) * 100 : 0;
      if (premiumPct > 10) {
        warnings.push({
          severity: "high",
          message: `Prima > 10% del strike (${premiumPct.toFixed(1)}%). Requiere movimiento significativo para ser rentable.`,
        });
      }

      // Inherited warnings from backend
      if (displayedOptionsResult.warnings) {
        for (const w of displayedOptionsResult.warnings) {
          if (w.includes("7 días") || w.includes("decay")) {
            warnings.push({ severity: "medium", message: w });
          } else if (w.includes("Capital") || w.includes("insuficiente")) {
            warnings.push({ severity: "high", message: w });
          } else {
            warnings.push({ severity: "medium", message: w });
          }
        }
      }
    }

    // Fundamental-level warnings from data
    if (data?.fundamentalData) {
      const fd = data.fundamentalData;
      if (fd.beta !== undefined && fd.beta > 2) {
        warnings.push({
          severity: "medium",
          message: `Beta elevada (${fd.beta.toFixed(2)}). Alta sensibilidad al mercado.`,
        });
      }
      if (fd.debtToEquity !== undefined && fd.debtToEquity > 3) {
        warnings.push({
          severity: "high",
          message: `Apalancamiento alto — D/E ratio: ${fd.debtToEquity.toFixed(2)}`,
        });
      }
    }

    return warnings;
  }

  // ─── Empty state ────────────────────────────────────────────────────────────

  if (!data && !loading && !error) {
    return (
      <section id="fundamental-analysis-panel" className="card" style={{ padding: "var(--space-lg)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-md)" }}>
          <div style={{ display: "none", alignItems: "center", gap: "var(--space-sm)" }}>
            <h2 style={{ margin: 0, fontSize: "var(--font-size-base)" }}>Análisis Fundamental</h2>
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>— {selectedSymbol}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            {/* Profile selector */}
            <div style={{ display: "flex", gap: "2px" }}>
              {PROFILES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProfile(p.id)}
                  style={{
                    background: profile === p.id ? "var(--color-accent-subtle)" : "transparent",
                    color: profile === p.id ? "var(--color-accent)" : "var(--color-text-muted)",
                    border: profile === p.id ? "1px solid var(--color-accent)" : "1px solid var(--color-border)",
                    borderRadius: "var(--radius-xs)",
                    padding: "0.2rem 0.6rem",
                    fontSize: "var(--font-size-xs)",
                    fontWeight: profile === p.id ? ("var(--font-weight-bold)" as any) : "normal",
                    cursor: "pointer",
                    transition: "all var(--duration-fast) var(--easing-standard)",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              className="btn-primary"
              style={{ fontSize: "var(--font-size-xs)", padding: "0.3rem 1rem" }}
              onClick={runFundamentalAnalysis}
            >
              Analizar
            </button>
          </div>
        </div>
        <div style={{
          padding: "var(--space-2xl) var(--space-lg)",
          textAlign: "center",
          color: "var(--color-text-muted)",
          border: "1px dashed var(--color-border)",
          borderRadius: "var(--radius-md)",
          background: "var(--color-surface-raised)",
        }}>
          <p style={{ fontWeight: "var(--font-weight-emphasis)" as any, marginBottom: "var(--space-xs)", color: "var(--color-text)" }}>
            Selecciona un instrumento y ejecuta el análisis
          </p>
          <p style={{ fontSize: "var(--font-size-sm)", margin: 0 }}>
            Ejecuta el análisis con las métricas fundamentales predeterminadas. La simulación llenará la tabla de confluencia con filas fundamentales.
            {!selectedStrike && !optionStrategyAnalysis && (
              <span style={{ display: "block", marginTop: "var(--space-xs)", color: "var(--color-warning)" }}>
                Selecciona un strike en la Cadena de Opciones para ver escenarios P&L.
              </span>
            )}
          </p>
        </div>
      </section>
    );
  }

  // ─── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <section id="fundamental-analysis-panel" className="card" style={{ padding: "var(--space-lg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
          <h2 style={{ margin: 0, fontSize: "var(--font-size-base)" }}>Análisis Fundamental</h2>
          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>— {selectedSymbol}</span>
          <span style={{
            marginLeft: "auto",
            fontSize: "var(--font-size-xs)",
            color: "var(--color-accent)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-xs)",
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "var(--color-accent)",
              animation: "skeleton-pulse 1s ease-in-out infinite",
            }} />
            Analizando…
          </span>
        </div>
        <div style={{ display: "grid", gap: "var(--space-md)" }}>
          <SkeletonBlock height={80} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "var(--space-sm)" }}>
            {[1, 2, 3, 4, 5].map((i) => <SkeletonBlock key={i} height={56} />)}
          </div>
          <SkeletonBlock height={100} />
        </div>
      </section>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <section id="fundamental-analysis-panel" className="card" style={{ padding: "var(--space-lg)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-md)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <h2 style={{ margin: 0, fontSize: "var(--font-size-base)" }}>Análisis Fundamental</h2>
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>— {selectedSymbol}</span>
          </div>
          <button
            className="btn-primary"
            style={{ fontSize: "var(--font-size-xs)", padding: "0.3rem 1rem" }}
            onClick={runFundamentalAnalysis}
          >
            Reintentar
          </button>
        </div>
        <div style={{
          padding: "var(--space-lg)",
          borderRadius: "var(--radius-md)",
          background: "rgba(226, 59, 74, 0.06)",
          border: "1px solid rgba(226, 59, 74, 0.2)",
          color: "var(--color-sell)",
          fontSize: "var(--font-size-sm)",
        }}>
          <strong>Error:</strong> {error}
        </div>
      </section>
    );
  }

  // ─── Data loaded ────────────────────────────────────────────────────────────

  if (!data) return null;

  const fd = data.fundamentalData;
  const warnings = buildWarnings();

  const verdictColor =
    data.verdict?.toLowerCase().includes("comprar") || data.verdict?.toLowerCase().includes("buy")
      ? "var(--color-buy)"
      : data.verdict?.toLowerCase().includes("vender") || data.verdict?.toLowerCase().includes("sell")
        ? "var(--color-sell)"
        : "var(--color-hold)";

  return (
    <section id="fundamental-analysis-panel" className="card" style={{ padding: "var(--space-lg)" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "var(--space-md)",
        flexWrap: "wrap",
        gap: "var(--space-sm)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <h2 style={{ margin: 0, fontSize: "var(--font-size-base)" }}>
            Análisis Fundamental — {data.companyName || selectedSymbol}
          </h2>
          {data.companyName && (
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              ({selectedSymbol})
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <div style={{ display: "flex", gap: "2px" }}>
            {PROFILES.map((p) => (
              <button
                key={p.id}
                onClick={() => setProfile(p.id)}
                style={{
                  background: profile === p.id ? "var(--color-accent-subtle)" : "transparent",
                  color: profile === p.id ? "var(--color-accent)" : "var(--color-text-muted)",
                  border: profile === p.id ? "1px solid var(--color-accent)" : "1px solid var(--color-border)",
                  borderRadius: "var(--radius-xs)",
                  padding: "0.2rem 0.6rem",
                  fontSize: "var(--font-size-xs)",
                  fontWeight: profile === p.id ? ("var(--font-weight-bold)" as any) : "normal",
                  cursor: "pointer",
                  transition: "all var(--duration-fast) var(--easing-standard)",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            className="btn-primary"
            style={{ fontSize: "var(--font-size-xs)", padding: "0.3rem 1rem" }}
            onClick={runFundamentalAnalysis}
          >
            Analizar
          </button>
        </div>
      </div>

      {data.projection && (
        <div style={{ marginBottom: "var(--space-md)" }}>
          <ProjectionSimulationPanel projection={data.projection} />
        </div>
      )}

      {/* ── Score cards row ────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 0,
        marginBottom: "var(--space-md)",
      }}>
        {/* Score */}
        <div style={{ paddingRight: "var(--space-md)", borderRight: "1px solid var(--color-border-subtle)" }}>
          <p style={{
            fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
            color: "var(--color-text-muted)", margin: "0 0 4px", fontWeight: 600,
          }}>Score</p>
          <ScoreGauge score={data.overallScore ?? 0} />
        </div>

        {/* Verdict */}
        <div style={{ paddingLeft: "var(--space-md)", paddingRight: "var(--space-md)", borderRight: "1px solid var(--color-border-subtle)" }}>
          <p style={{
            fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
            color: "var(--color-text-muted)", margin: "0 0 4px", fontWeight: 600,
          }}>Veredicto</p>
          <p style={{
            fontSize: 14, fontWeight: 600, margin: 0, color: verdictColor,
            textTransform: "uppercase",
          }}>{data.verdict || "—"}</p>
        </div>

        {/* Sector */}
        <div style={{ paddingLeft: "var(--space-md)", paddingRight: "var(--space-md)", borderRight: "1px solid var(--color-border-subtle)" }}>
          <p style={{
            fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
            color: "var(--color-text-muted)", margin: "0 0 4px", fontWeight: 600,
          }}>Sector</p>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
            {fd.sector || "—"}
          </p>
          {fd.industry && (
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "2px 0 0" }}>
              {fd.industry}
            </p>
          )}
        </div>

        {/* Price */}
        <div style={{ paddingLeft: "var(--space-md)" }}>
          <p style={{
            fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
            color: "var(--color-text-muted)", margin: "0 0 4px", fontWeight: 600,
          }}>Precio</p>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
            {fd.price !== undefined ? `$${fd.price.toFixed(2)}` : "—"}
          </p>
          {fd.change52w !== undefined && (
            <p style={{
              fontSize: 11, margin: "2px 0 0",
              color: fd.change52w >= 0 ? "var(--color-buy)" : "var(--color-sell)",
            }}>
              {fd.change52w >= 0 ? "▲" : "▼"} {fmtPct(fd.change52w)} (52w)
            </p>
          )}
        </div>
      </div>

      {/* ── Key metrics ───────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
        gap: "var(--space-sm)",
        marginBottom: "var(--space-md)",
        borderTop: "1px solid var(--color-border-subtle)",
        paddingTop: "var(--space-md)",
      }}>
        <MetricCard label="P/E" value={fmtNum(fd.pe)} color={metricColor(fd.pe, 25, 40, false)} />
        <MetricCard label="P/B" value={fmtNum(fd.pb)} color={metricColor(fd.pb, 3, 10, false)} />
        <MetricCard label="P/S" value={fmtNum(fd.ps)} />
        <MetricCard label="ROE" value={fmtPct(fd.roe)} color={metricColor(fd.roe, 15, 5)} />
        <MetricCard label="D/E" value={fmtNum(fd.debtToEquity)} color={metricColor(fd.debtToEquity, 1, 3, false)} />
        <MetricCard label="Beta" value={fmtNum(fd.beta)} color={metricColor(fd.beta, 1.5, 2, false)} />
        <MetricCard label="EPS" value={fd.eps !== undefined ? `$${fd.eps.toFixed(2)}` : "—"} />
        <MetricCard
          label="EPS Crecimiento"
          value={fmtPct(fd.epsGrowth)}
          color={fd.epsGrowth !== undefined ? (fd.epsGrowth >= 0 ? "var(--color-buy)" : "var(--color-sell)") : undefined}
        />
        <MetricCard label="Div Yield" value={fmtPct(fd.dividendYield)} color={metricColor(fd.dividendYield, 2, 0)} />
        <MetricCard label="Vol. Anual" value={fmtPct(fd.volatility)} color={metricColor(fd.volatility, 30, 60, false)} />
        {fd.marketCap !== undefined && (
          <MetricCard label="Market Cap" value={formatCurrency(fd.marketCap)} />
        )}
        {fd.revenue !== undefined && (
          <MetricCard label="Revenue" value={formatCurrency(fd.revenue)} />
        )}
      </div>

      {/* ── P&L Scenarios (only if strike selected + options result) ─── */}
      {displayedOptionsResult && (selectedStrike || optionStrategyAnalysis) && (
        <div style={{
          borderTop: "1px solid var(--color-border-subtle)",
          paddingTop: "var(--space-md)",
          marginBottom: "var(--space-md)",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
            marginBottom: "var(--space-sm)",
          }}>
            <p style={{
              fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
              color: "var(--color-text-muted)", margin: 0, fontWeight: 600,
            }}>Escenarios P&L</p>
            <span style={{
              fontSize: "var(--font-size-xs)",
              color: (selectedStrike?.type ?? (optionStrategyAnalysis?.strategy.endsWith("CALL") ? "call" : "put")) === "call" ? "var(--color-buy)" : "var(--color-sell)",
            }}>
              {(selectedStrike?.type ?? (optionStrategyAnalysis?.strategy.endsWith("CALL") ? "call" : "put")).toUpperCase()} @ ${Number(selectedStrike?.strike ?? optionStrategyAnalysis?.params.strikePrice ?? 0).toFixed(2)} · Prima ${Number(selectedStrike?.premium ?? optionStrategyAnalysis?.params.premium ?? 0).toFixed(2)}
            </span>
            {/* Break-even */}
            <span style={{
              marginLeft: "auto",
              fontSize: "var(--font-size-xs)",
              color: "var(--color-text-muted)",
            }}>
              Break-even: <strong style={{ color: "var(--color-text)" }}>${displayedOptionsResult.breakEvenPrice.toFixed(2)}</strong>
            </span>
          </div>

          {/* Metrics bar */}
          <div style={{
            display: "flex",
            gap: "var(--space-lg)",
            marginBottom: "var(--space-sm)",
            fontSize: "var(--font-size-xs)",
            color: "var(--color-text-muted)",
          }}>
            <span>
              Máx. Ganancia:{" "}
              <strong style={{ color: "var(--color-buy)" }}>
                {displayedOptionsResult.maxProfit === null || displayedOptionsResult.maxProfit === Infinity ? "∞ Ilimitada" : `$${displayedOptionsResult.maxProfit.toFixed(2)}`}
              </strong>
            </span>
            <span>
              Máx. Pérdida:{" "}
              <strong style={{ color: "var(--color-sell)" }}>
                {displayedOptionsResult.maxLoss === null || displayedOptionsResult.maxLoss === Infinity ? "∞ Ilimitada" : `$${displayedOptionsResult.maxLoss.toFixed(2)}`}
              </strong>
            </span>
            <span>
              Prob. ITM:{" "}
              <strong style={{ color: "var(--color-text)" }}>
                {(displayedOptionsResult.probabilityItm * 100).toFixed(1)}%
              </strong>
            </span>
          </div>

          {/* Scenario cards */}
          <div style={{ display: "flex", gap: "var(--space-sm)" }}>
            <ScenarioCard
              scenario={displayedOptionsResult.scenarioPlus5}
              icon="▲"
              accent="var(--color-buy)"
            />
            <ScenarioCard
              scenario={displayedOptionsResult.scenarioAtm}
              icon="═"
              accent="var(--color-hold)"
            />
            <ScenarioCard
              scenario={displayedOptionsResult.scenarioMinus5}
              icon="▼"
              accent="var(--color-sell)"
            />
          </div>
        </div>
      )}

      {/* ── Strike not selected hint ──────────────────────────────────── */}
      {!selectedStrike && !optionStrategyAnalysis && (
        <div style={{
          borderTop: "1px solid var(--color-border-subtle)",
          paddingTop: "var(--space-md)",
          marginBottom: "var(--space-md)",
          padding: "var(--space-md)",
          borderRadius: "var(--radius-sm)",
          background: "var(--color-surface-raised)",
          border: "1px dashed var(--color-border)",
          textAlign: "center",
          color: "var(--color-text-muted)",
          fontSize: "var(--font-size-sm)",
        }}>
          Selecciona un <strong>strike</strong> en la pestaña <em>Cadena de Opciones</em> para ver los escenarios P&L y alertas de riesgo.
        </div>
      )}

      {/* ── Risk warnings ─────────────────────────────────────────────── */}
      {warnings.length > 0 && (
        <div style={{
          borderTop: "1px solid var(--color-border-subtle)",
          paddingTop: "var(--space-md)",
        }}>
          <p style={{
            fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
            color: "var(--color-text-muted)", margin: "0 0 var(--space-sm)", fontWeight: 600,
          }}>⚠ Alertas de Riesgo</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            {warnings.map((w, i) => (
              <RiskWarning key={i} severity={w.severity} message={w.message} />
            ))}
          </div>
        </div>
      )}

      {/* ── Timestamp footer ──────────────────────────────────────────── */}
      <div style={{
        marginTop: "var(--space-md)",
        paddingTop: "var(--space-sm)",
        borderTop: "1px solid var(--color-border-subtle)",
        display: "flex",
        justifyContent: "space-between",
        fontSize: "var(--font-size-xs)",
        color: "var(--color-text-muted)",
      }}>
        <span>Fuente: {data.sourceId ?? "auto"}</span>
        <span>{new Date(data.timestamp).toLocaleString()}</span>
      </div>
    </section>
  );
}
