// FIC: Inline strategy breakdown section — shows coverage analysis results after params are confirmed. (EN)
// FIC: Sección de desglose de estrategia inline — muestra resultados del análisis de coberturas tras confirmar parámetros. (ES)

import React, { useEffect, useRef, useState } from "react";
import { PayoffChart } from "../../../components/coverage/PayoffChart";
import {
  postCoverageAnalyze,
  type CoverageAnalyzeResponse,
  type CoverageStrategyResult,
} from "../../../services/coverage/coverageApi";
import type { CoverageModalParams } from "./CoverageParamsModal";
import type { OptionStrategyAnalysis } from "./OptionStrategyParamsModal";
import type { WheelModalParams } from "./WheelParamsModal";
import type { FromChainResponse } from "../../../services/strategies/strategyApi";

const TERM_STRATEGIES = new Set(["CALENDAR_SPREAD", "DIAGONAL_SPREAD"]);
const CORE_OPTION_STRATEGIES = new Set(["LONG_CALL", "LONG_PUT", "SHORT_CALL", "SHORT_PUT"]);
const COMPLEX_STRATEGIES = new Set(["IRON_CONDOR", "IRON_BUTTERFLY", "BUTTERFLY_SPREAD", "CONDOR"]);

const KIND_LABELS: Record<string, string> = {
  protective_put:   "Protective Put",
  married_put:      "Married Put",
  collar_put:       "Collar Put",
  covered_straddle: "Covered Straddle",
};

const BADGE_COLORS: Record<string, string> = {
  ALTA: "var(--color-buy)",
  MEDIA: "var(--color-hold)",
  BAJA: "var(--color-sell)",
};

interface Props {
  ticker: string;
  activeStrategy: string;
  coverageRequest?: { params: CoverageModalParams; kind: string } | null;
  optionStrategyAnalysis?: OptionStrategyAnalysis | null;
  wheelSummary?: WheelModalParams | null;
  termResult?: any | null;
  complexResult?: FromChainResponse | null;
}

function money(value: number | "Ilimitado"): string {
  return value === "Ilimitado" ? "Ilimitado" : `$${value.toFixed(2)}`;
}

export function SimulatorStrategySection({ ticker, activeStrategy, coverageRequest, optionStrategyAnalysis, wheelSummary, termResult, complexResult }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CoverageAnalyzeResponse | null>(null);
  const [selectedKind, setSelectedKind] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!coverageRequest || activeStrategy !== "COVERED_CALL") return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    setResults(null);

    const { params } = coverageRequest;
    postCoverageAnalyze(
      {
        ticker: ticker.toUpperCase(),
        currentPrice: params.currentPrice,
        shares: params.shares,
        riskTolerancePct: params.riskTolerancePct,
        ...(params.putStrikePrice ? { putStrikePrice: params.putStrikePrice } : {}),
        ...(params.callStrikePrice ? { callStrikePrice: params.callStrikePrice } : {}),
      },
      abortRef.current.signal
    )
      .then((data) => {
        setResults(data);
        setSelectedKind(data.results[0]?.kind ?? null);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") {
          setError("Error al obtener el análisis. Verifica que el backend esté disponible.");
        }
      })
      .finally(() => setLoading(false));

    return () => abortRef.current?.abort();
  }, [coverageRequest, ticker, activeStrategy]);

  const sectionTitle = activeStrategy.replace(/_/g, " ");
  const selectedResult = results?.results.find((r) => r.kind === selectedKind) ?? null;
  const payoffPoints = selectedResult?.payoffPoints ?? [];
  const breakEven = selectedResult?.summary.breakEvenPrice ?? 0;

  const isTermStrategy = TERM_STRATEGIES.has(activeStrategy);
  const isCoverageStrategy = activeStrategy === "COVERED_CALL";
  const isCoreOptionStrategy = CORE_OPTION_STRATEGIES.has(activeStrategy);
  const hasCoreOptionAnalysis = isCoreOptionStrategy && optionStrategyAnalysis?.strategy === activeStrategy;
  const isWheelStrategy = activeStrategy === "WHEEL";
  const isComplexStrategy = COMPLEX_STRATEGIES.has(activeStrategy);

  const cardStyle: React.CSSProperties = {
    padding: "var(--space-lg)",
    opacity: (!isCoverageStrategy && !isTermStrategy && !isCoreOptionStrategy && !isWheelStrategy && !isComplexStrategy) ? 0.5 : 1,
  };

  const mutedText: React.CSSProperties = {
    margin: 0,
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text-muted)",
  };

  const fmt = (v: any, d = 2) =>
    v != null && Number.isFinite(Number(v)) ? Number(v).toFixed(d) : "—";

  return (
    <section className="card" style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
        <h2 style={{ margin: 0, fontSize: "var(--font-size-base)" }}>
          Estrategia · {sectionTitle}
        </h2>
        {isTermStrategy && !termResult && (
          <span style={{
            fontSize: "var(--font-size-xs)",
            color: "var(--color-text-muted)",
            background: "var(--color-surface-raised)",
            padding: "2px 8px",
            borderRadius: "var(--radius-xs)",
          }}>
            Ejecuta la simulación para ver el análisis
          </span>
        )}          {(!isCoverageStrategy && !isCoreOptionStrategy && !isWheelStrategy && !isTermStrategy && !isComplexStrategy) && (
          <span style={{
            fontSize: "var(--font-size-xs)",
            color: "var(--color-text-muted)",
            background: "var(--color-surface-raised)",
            padding: "2px 8px",
            borderRadius: "var(--radius-xs)",
          }}>
            Próximamente
          </span>
        )}
      </div>

      {/* TERM strategies — Calendar / Diagonal */}
      {isTermStrategy && !termResult && (
        <p style={mutedText}>
          Selecciona los parámetros y ejecuta la simulación para ver el análisis de {sectionTitle}.
        </p>
      )}

      {isTermStrategy && termResult && (() => {
        const analysis  = termResult.analysis  ?? {};
        const report    = termResult.report    ?? {};
        const risk      = report.riskMetrics   ?? {};
        const mc        = termResult.simulation?.monteCarlo ?? null;
        const stressTests: any[] = report.stressTests ?? [];
        const payoff: any[] = report.payoffCurve ?? [];
        const netTheta = analysis.netTheta ?? analysis.greeks?.theta ?? 0;
        const delta    = analysis.greeks?.delta ?? risk.netDelta ?? 0;
        const gamma    = analysis.greeks?.gamma ?? risk.netGamma ?? 0;
        const vega     = analysis.greeks?.vega  ?? risk.netVega  ?? 0;
        const pop      = risk.probabilityOfProfit ?? 0;
        const breakEvenPrice: number = (() => {
          if (!payoff.length) return 0;
          for (let i = 1; i < payoff.length; i++) {
            const prev = payoff[i - 1];
            const curr = payoff[i];
            if ((prev.pnl < 0 && curr.pnl >= 0) || (prev.pnl >= 0 && curr.pnl < 0)) {
              return Number(curr.price ?? curr.underlyingPrice ?? 0);
            }
          }
          return 0;
        })();

        return (
          <div style={{ display: "grid", gap: "var(--space-md)" }}>

            {/* Métricas principales */}
            <div>
              <p style={{ ...mutedText, marginBottom: "var(--space-sm)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "var(--font-size-xs)" }}>
                Métricas principales
              </p>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Estructura", "DTE Corto", "DTE Largo", "Theta ($/día)", "Delta", "Gamma", "Vega ($/1%)", "PoP"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "var(--space-xs) var(--space-sm)", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--color-border-subtle)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid var(--color-border-subtle)", fontWeight: 600 }}>
                      {termResult.structureName ?? sectionTitle}
                    </td>
                    <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid var(--color-border-subtle)" }}>
                      {analysis.shortDte ?? "—"} días
                    </td>
                    <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid var(--color-border-subtle)" }}>
                      {analysis.longDte ?? "—"} días
                    </td>
                    <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid var(--color-border-subtle)", color: netTheta > 0 ? "var(--color-buy)" : "var(--color-sell)" }}>
                      ${fmt(netTheta)}
                    </td>
                    <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid var(--color-border-subtle)" }}>
                      {fmt(delta, 4)}
                    </td>
                    <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid var(--color-border-subtle)" }}>
                      {fmt(gamma, 4)}
                    </td>
                    <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid var(--color-border-subtle)" }}>
                      ${fmt(vega)}
                    </td>
                    <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid var(--color-border-subtle)", color: pop >= 0.5 ? "var(--color-buy)" : "var(--color-sell)" }}>
                      {fmt(pop * 100, 1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
              {breakEvenPrice > 0 && (
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-xs)" }}>
                  Break-even aproximado: ${fmt(breakEvenPrice)}
                </p>
              )}
            </div>

            {/* Stress Tests */}
            {stressTests.length > 0 && (
              <div>
                <p style={{ ...mutedText, marginBottom: "var(--space-sm)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "var(--font-size-xs)" }}>
                  Stress Tests
                </p>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Escenario", "Precio Suby.", "P&L ($)", "Valor Estrategia ($)"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "var(--space-xs) var(--space-sm)", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--color-border-subtle)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stressTests.map((s: any) => (
                      <tr key={s.label}>
                        <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid var(--color-border-subtle)", fontWeight: 500 }}>{s.label}</td>
                        <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid var(--color-border-subtle)" }}>${fmt(s.underlyingPrice)}</td>
                        <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid var(--color-border-subtle)", color: Number(s.pnl) >= 0 ? "var(--color-buy)" : "var(--color-sell)", fontWeight: 600 }}>
                          {Number(s.pnl) >= 0 ? "+" : ""}${fmt(s.pnl)}
                        </td>
                        <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid var(--color-border-subtle)" }}>${fmt(s.strategyValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Monte Carlo */}
            {mc && (
              <div>
                <p style={{ ...mutedText, marginBottom: "var(--space-sm)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "var(--font-size-xs)" }}>
                  Simulación Monte Carlo ({mc.iterations ?? 1000} iteraciones) — valores en $
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "var(--space-sm)" }}>
                  {[
                    ["P&L Medio", `$${fmt(mc.meanPnl)}`],
                    ["Mediana", `$${fmt(mc.medianPnl)}`],
                    ["VaR 95%", `$${fmt(mc.var95)}`],
                    ["P5", `$${fmt(mc.percentile5)}`],
                    ["P95", `$${fmt(mc.percentile95)}`],
                  ].map(([label, value]) => (
                    <div key={label} style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-xs)", padding: "var(--space-xs) var(--space-sm)" }}>
                      <div style={{ fontSize: "0.6rem", color: "var(--color-text-muted)", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
                      <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 700 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payoff Chart */}
            {payoff.length > 0 && (
              <div>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-sm)" }}>
                  Diagrama de payoff — {termResult.structureName ?? sectionTitle}
                </p>
                <PayoffChart
                  points={payoff.map((p: any) => ({
                    underlyingPrice: Number(p.price ?? p.underlyingPrice ?? 0),
                    pnl: Number(p.pnl ?? 0),
                  }))}
                  breakEvenPrice={breakEvenPrice}
                  height={200}
                />
              </div>
            )}

          </div>
        );
      })()}

      {/* Complex strategies */}
      {isComplexStrategy && !complexResult && (
        <p style={mutedText}>
          Abre la estrategia en el panel de control, configura los parámetros y ejecuta el cálculo para ver el análisis completo.
        </p>
      )}

      {isComplexStrategy && complexResult && (() => {
        const strategyLabel = complexResult.strategy_type.replace(/_/g, " ");
        const profile = complexResult.profile as any;
        const risk = complexResult.risk as any;
        const simulation = complexResult.simulation as any;
        const premiums = complexResult.premiums_used ?? [];
        const payoffCurve = profile?.payoff_curve ?? [];
        const griegas = profile?.griegas;
        const escenarios = simulation?.escenarios;
        const bePoints: number[] = Array.isArray(profile?.break_even_points) ? profile.break_even_points : [];

        // Calculate DTE
        let dte = "—";
        try {
          const expDate = new Date(complexResult.expiracion);
          const today = new Date();
          const diff = Math.max(0, Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
          dte = `${diff} días`;
        } catch { /* ignore */ }

        return (
          <>
            {/* Summary metrics grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
              {[
                { label: "Ganancia Máx", value: profile?.ganancia_maxima != null ? `$${Number(profile.ganancia_maxima).toLocaleString()}` : "—", color: "var(--color-buy)" },
                { label: "Pérdida Máx", value: profile?.perdida_maxima != null ? `$${Number(profile.perdida_maxima).toLocaleString()}` : "—", color: "var(--color-sell)" },
                { label: bePoints.length >= 2 ? `BE 1 / BE 2` : "Break-even", value: bePoints.length > 0 ? bePoints.map((bp: number) => `$${bp.toFixed(2)}`).join(" / ") : "—" },
                { label: "Riesgo", value: `${risk?.puntaje_riesgo ?? "—"}/100`, color: risk?.puntaje_riesgo != null && risk.puntaje_riesgo >= 60 ? "var(--color-warning)" : undefined },
                { label: "Prob. Éxito", value: simulation?.probabilidad_exito != null ? `${Number(simulation.probabilidad_exito).toFixed(1)}%` : "—", color: simulation?.probabilidad_exito != null && simulation.probabilidad_exito >= 50 ? "var(--color-buy)" : "var(--color-sell)" },
                { label: "Ratio R/B", value: profile?.ratio_riesgo_beneficio != null ? `1:${Number(profile.ratio_riesgo_beneficio).toFixed(2)}` : "—" },
                { label: "Crédito Neto / Débito Neto", value: profile?.credito_neto != null ? `$${Number(profile.credito_neto).toLocaleString()}` : "—", color: profile?.tipo_neto === "credito" ? "var(--color-buy)" : "var(--color-sell)" },
                { label: "DTE", value: dte },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-xs)", background: "var(--color-surface-raised)", padding: "var(--space-sm)" }}>
                  <div style={{ fontSize: "10px", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>{label}</div>
                  <strong style={{ fontSize: "var(--font-size-sm)", color: color ?? "var(--color-text)" }}>{value}</strong>
                </div>
              ))}
            </div>

            {/* Griega× (Greek summary) */}
            {griegas && (
              <div style={{ marginBottom: "var(--space-md)" }}>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-sm)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Griegas
                </p>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-size-xs)" }}>
                  <thead>
                    <tr>
                      {["Delta", "Gamma", "Theta ($/día)", "Vega ($/1%)", "Rho"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "var(--space-xs) var(--space-sm)", borderBottom: "1px solid var(--color-border-subtle)", color: "var(--color-text-muted)", fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: "var(--space-sm)", borderBottom: "1px solid var(--color-border-subtle)" }}>{griegas.delta?.toFixed(4) ?? "—"}</td>
                      <td style={{ padding: "var(--space-sm)", borderBottom: "1px solid var(--color-border-subtle)" }}>{griegas.gamma?.toFixed(4) ?? "—"}</td>
                      <td style={{ padding: "var(--space-sm)", borderBottom: "1px solid var(--color-border-subtle)", color: (griegas.theta ?? 0) >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}>
                        ${griegas.theta?.toFixed(2) ?? "—"}
                      </td>
                      <td style={{ padding: "var(--space-sm)", borderBottom: "1px solid var(--color-border-subtle)" }}>${griegas.vega?.toFixed(2) ?? "—"}</td>
                      <td style={{ padding: "var(--space-sm)", borderBottom: "1px solid var(--color-border-subtle)" }}>{griegas.rho?.toFixed(4) ?? "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Payoff + Premiums */}
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "var(--space-md)", marginBottom: "var(--space-md)" }}>
              <div>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-sm)" }}>
                  Diagrama de payoff — {strategyLabel}
                </p>
                {payoffCurve.length > 0 ? (
                  <PayoffChart
                    points={payoffCurve.map((p: any) => ({
                      underlyingPrice: Number(p.precio_subyacente ?? p.price ?? 0),
                      pnl: Number(p.pnl ?? 0),
                    }))}
                    breakEvenPrice={bePoints[0] ?? 0}
                    height={200}
                  />
                ) : (
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontStyle: "italic" }}>Sin datos de payoff</p>
                )}
              </div>
              <div>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-sm)" }}>
                  Primas (Alpaca)
                </p>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-size-xs)" }}>
                  <thead>
                    <tr>
                      {["Pos", "Strike", "Tipo", "Prima"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "var(--space-xs)", borderBottom: "1px solid var(--color-border-subtle)", color: "var(--color-text-muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {premiums.map((p: any, i: number) => (
                      <tr key={i}>
                        <td style={{ padding: "var(--space-xs)", borderBottom: "1px solid var(--color-border-subtle)" }}>
                          <span style={{
                            fontSize: "0.55rem", fontWeight: 700, textTransform: "uppercase",
                            padding: "1px 6px", borderRadius: "var(--radius-xs)",
                            background: p.posicion === "long" ? "rgba(0,168,126,0.15)" : "rgba(248,81,73,0.15)",
                            color: p.posicion === "long" ? "var(--color-buy)" : "var(--color-sell)",
                          }}>
                            {p.posicion}
                          </span>
                        </td>
                        <td style={{ padding: "var(--space-xs)", borderBottom: "1px solid var(--color-border-subtle)", fontWeight: 600 }}>${p.strike}</td>
                        <td style={{ padding: "var(--space-xs)", borderBottom: "1px solid var(--color-border-subtle)" }}>{p.tipo}</td>
                        <td style={{ padding: "var(--space-xs)", borderBottom: "1px solid var(--color-border-subtle)", fontWeight: 700, color: "var(--color-accent)" }}>${p.prima.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Scenarios + Risk */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
              <div>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-sm)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Evaluación de Riesgo
                </p>
                <div style={{ display: "grid", gap: "var(--space-xs)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-sm)", padding: "var(--space-xs) 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <span style={{ color: "var(--color-text-muted)" }}>Puntaje</span>
                    <span style={{ fontWeight: 700 }}>{risk?.puntaje_riesgo ?? "—"}/100</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-sm)", padding: "var(--space-xs) 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <span style={{ color: "var(--color-text-muted)" }}>Aceptable</span>
                    <span style={{ fontWeight: 700, color: risk?.riesgo_aceptable ? "var(--color-buy)" : "var(--color-sell)" }}>
                      {risk?.riesgo_aceptable ? "Sí" : "No"}
                    </span>
                  </div>
                  {Array.isArray(risk?.eventos) && risk.eventos.map((e: any, i: number) => (
                    <div key={i} style={{ fontSize: "var(--font-size-xs)", color: e.bloquea ? "var(--color-sell)" : "var(--color-hold)", padding: "0.15rem 0" }}>
                      {e.mensaje}
                    </div>
                  ))}
                  {risk?.resumen && (
                    <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", padding: "var(--space-xs) 0", borderBottom: "1px solid var(--color-border-subtle)", fontStyle: "italic" }}>
                      {risk.resumen}
                    </div>
                  )}
                  {risk?.accion_recomendada && (
                    <div style={{ fontSize: "var(--font-size-xs)", fontWeight: 600, padding: "var(--space-xs) 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
                      {risk.accion_recomendada}
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-sm)", padding: "var(--space-xs) 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <span style={{ color: "var(--color-text-muted)" }}>Sharpe</span>
                    <span style={{ fontWeight: 700, color: (simulation?.ratio_sharpe ?? 0) >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}>
                      {simulation?.ratio_sharpe?.toFixed(2) ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-sm)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Simulación Monte Carlo
                </p>
                <div style={{ display: "grid", gap: "var(--space-xs)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-sm)", padding: "var(--space-xs) 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <span style={{ color: "var(--color-text-muted)" }}>Prob. Éxito</span>
                    <span style={{ fontWeight: 700, color: (simulation?.probabilidad_exito ?? 0) >= 50 ? "var(--color-buy)" : "var(--color-sell)" }}>
                      {simulation?.probabilidad_exito != null ? `${Number(simulation.probabilidad_exito).toFixed(1)}%` : "—"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-sm)", padding: "var(--space-xs) 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <span style={{ color: "var(--color-text-muted)" }}>Rend. Esperado</span>
                    <span style={{ fontWeight: 700, color: (simulation?.rendimiento_esperado ?? 0) >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}>
                      {simulation?.rendimiento_esperado != null ? `$${Number(simulation.rendimiento_esperado).toLocaleString()}` : "—"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-sm)", padding: "var(--space-xs) 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <span style={{ color: "var(--color-text-muted)" }}>Drawdown Máx</span>
                    <span style={{ fontWeight: 700, color: "var(--color-sell)" }}>
                      {simulation?.drawdown_maximo != null ? `$${Number(simulation.drawdown_maximo).toLocaleString()}` : "—"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-sm)", padding: "var(--space-xs) 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <span style={{ color: "var(--color-text-muted)" }}>Costos Totales</span>
                    <span style={{ fontWeight: 700 }}>{simulation?.costos_totales != null ? `$${Number(simulation.costos_totales).toFixed(2)}` : "—"}</span>
                  </div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", padding: "var(--space-xs) 0" }}>
                    Iteraciones: {simulation?.total_iteraciones?.toLocaleString() ?? "—"}
                  </div>
                </div>

                {/* Scenario breakdown */}
                {escenarios && (
                  <div style={{ marginTop: "var(--space-sm)" }}>
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Escenarios
                    </p>
                    <div style={{ display: "grid", gap: "2px" }}>
                      {[
                        { key: "mejor_caso", label: "Mejor caso", precio: escenarios.mejor_caso?.precio, pnl: escenarios.mejor_caso?.pnl },
                        { key: "caso_base", label: "Caso base", precio: escenarios.caso_base?.precio, pnl: escenarios.caso_base?.pnl },
                        { key: "peor_caso", label: "Peor caso", precio: escenarios.peor_caso?.precio, pnl: escenarios.peor_caso?.pnl },
                      ].map((s) => (
                        <div key={s.key} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-xs)", padding: "2px 0" }}>
                          <span style={{ color: "var(--color-text-muted)" }}>{s.label}</span>
                          <span style={{ fontWeight: 600, color: (s.pnl ?? 0) >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}>
                            {s.precio != null ? `$${Number(s.precio).toFixed(2)} ` : ""}
                            {s.pnl != null ? `${(s.pnl) >= 0 ? "+" : ""}$${Number(s.pnl).toFixed(2)}` : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {/* Unknown strategies */}
      {!isCoverageStrategy && !isTermStrategy && !isCoreOptionStrategy && !isWheelStrategy && !isComplexStrategy && (
        <p style={mutedText}>
          El análisis de {sectionTitle} está en construcción y estará disponible próximamente.
        </p>
      )}

      {isCoreOptionStrategy && !hasCoreOptionAnalysis && (
        <p style={mutedText}>
          Abre la estrategia en el panel de control, captura sus parámetros y presiona Calcular para enviar el resultado a la tabla de confluencia.
        </p>
      )}

      {hasCoreOptionAnalysis && optionStrategyAnalysis && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
            {[
              ["Strike", `$${Number(optionStrategyAnalysis.params.strikePrice).toFixed(2)}`],
              ["Prima", `$${Number(optionStrategyAnalysis.params.premium).toFixed(2)}`],
              ["Contratos", optionStrategyAnalysis.params.contracts],
              ["Break-even", `$${optionStrategyAnalysis.result.breakeven.toFixed(2)}`],
              ["Margen req.", `$${optionStrategyAnalysis.result.requiredMargin.toFixed(2)}`],
            ].map(([label, value]) => (
              <div key={label} style={{ border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-sm)", background: "var(--color-surface-raised)", padding: "var(--space-sm)" }}>
                <div style={{ fontSize: "10px", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>{label}</div>
                <strong style={{ fontSize: "var(--font-size-sm)" }}>{value}</strong>
              </div>
            ))}
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "var(--space-md)" }}>
            <thead>
              <tr>
                {["Max Profit", "Max Loss", "Escenario +5%", "Escenario ATM", "Escenario -5%"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "var(--space-xs) var(--space-sm)", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", borderBottom: "1px solid var(--color-border-subtle)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "var(--space-sm)", color: "var(--color-buy)" }}>{money(optionStrategyAnalysis.result.maxProfit)}</td>
                <td style={{ padding: "var(--space-sm)", color: "var(--color-sell)" }}>{money(optionStrategyAnalysis.result.maxLoss)}</td>
                <td style={{ padding: "var(--space-sm)", color: optionStrategyAnalysis.result.scenarioPlus5 >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}>${optionStrategyAnalysis.result.scenarioPlus5.toFixed(2)}</td>
                <td style={{ padding: "var(--space-sm)", color: optionStrategyAnalysis.result.scenarioAtm >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}>${optionStrategyAnalysis.result.scenarioAtm.toFixed(2)}</td>
                <td style={{ padding: "var(--space-sm)", color: optionStrategyAnalysis.result.scenarioMinus5 >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}>${optionStrategyAnalysis.result.scenarioMinus5.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          {optionStrategyAnalysis.payoffPoints.length > 0 && (
            <div>
              <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-sm)" }}>
                Diagrama de payoff - {sectionTitle}
              </p>
              <PayoffChart points={optionStrategyAnalysis.payoffPoints} breakEvenPrice={optionStrategyAnalysis.result.breakeven} height={220} />
            </div>
          )}
        </>
      )}

      {/* Coverage strategies */}
      {isCoverageStrategy && (
        <>
          {!coverageRequest && !loading && !results && (
            <p style={mutedText}>
              Selecciona los parámetros en el panel de control para ver el análisis de {sectionTitle}.
            </p>
          )}

          {loading && (
            <p style={mutedText}>Analizando estrategias de cobertura…</p>
          )}

          {error && (
            <p style={{ ...mutedText, color: "var(--color-sell)" }}>{error}</p>
          )}

          {results && (
            <>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "var(--space-lg)" }}>
                <thead>
                  <tr>
                    {["Estrategia", "Score", "Max Profit", "Max Loss", "Break-even", "Stop-loss", "Nivel"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "var(--space-xs) var(--space-sm)", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--color-border-subtle)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((r: CoverageStrategyResult) => (
                    <tr
                      key={r.kind}
                      onClick={() => setSelectedKind(r.kind)}
                      style={{
                        cursor: "pointer",
                        backgroundColor: selectedKind === r.kind ? "rgba(73,79,223,0.12)" : "transparent",
                        borderLeft: selectedKind === r.kind ? "3px solid var(--color-accent)" : "3px solid transparent",
                        transition: "background-color var(--duration-fast) var(--easing-standard)",
                      }}
                    >
                      <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid var(--color-border-subtle)", fontWeight: selectedKind === r.kind ? 600 : 400 }}>
                        {KIND_LABELS[r.kind] ?? r.kind}
                      </td>
                      <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid var(--color-border-subtle)" }}>
                        {r.confidenceScore.toFixed(2)}
                      </td>
                      <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid var(--color-border-subtle)", color: "var(--color-buy)" }}>
                        {r.summary.maxProfit === "∞" ? "∞" : `$${Number(r.summary.maxProfit).toLocaleString()}`}
                      </td>
                      <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid var(--color-border-subtle)", color: "var(--color-sell)" }}>
                        ${r.summary.maxLoss.toLocaleString()}
                      </td>
                      <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid var(--color-border-subtle)" }}>
                        ${r.summary.breakEvenPrice.toFixed(2)}
                      </td>
                      <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid var(--color-border-subtle)" }}>
                        ${r.summary.stopLossPrice.toFixed(2)}
                      </td>
                      <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid var(--color-border-subtle)" }}>
                        <span style={{ color: BADGE_COLORS[r.confidenceLevel], fontWeight: 700, fontSize: "var(--font-size-xs)" }}>
                          {r.confidenceLevel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedResult && payoffPoints.length > 0 && (
                <div style={{ marginBottom: "var(--space-lg)" }}>
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-sm)" }}>
                    Diagrama de payoff — {KIND_LABELS[selectedResult.kind] ?? selectedResult.kind}
                  </p>
                  <PayoffChart points={payoffPoints} breakEvenPrice={breakEven} height={200} />
                </div>
              )}

              {selectedResult && selectedResult.alerts.length > 0 && (
                <div>
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-sm)" }}>Alertas:</p>
                  {selectedResult.alerts.map((a, i) => (
                    <div key={i} style={{ padding: "var(--space-xs) var(--space-sm)", marginBottom: "var(--space-xs)", borderRadius: "var(--radius-xs)", backgroundColor: a.severity === "critical" ? "rgba(226,59,74,0.12)" : a.severity === "warning" ? "rgba(176,144,0,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${a.severity === "critical" ? "rgba(226,59,74,0.3)" : a.severity === "warning" ? "rgba(176,144,0,0.3)" : "rgba(255,255,255,0.06)"}`, fontSize: "var(--font-size-xs)", color: "var(--color-text)" }}>
                      <strong>{a.code}</strong>: {a.message}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {isWheelStrategy && (
        <>
          {!wheelSummary && (
            <p style={mutedText}>
              Selecciona un PUT desde la cadena de opciones y configura los parámetros Wheel en el panel de control.
            </p>
          )}
          {wheelSummary && (() => {
            const { csp, cc } = wheelSummary;
            const capitalComprometido = csp.strikePut * csp.contratos * 100;
            const primaCsp = csp.primaPut * csp.contratos * 100;
            const primaCc = cc.primaCall * cc.contratos * 100;
            const breakeven = csp.strikePut - csp.primaPut - cc.primaCall;
            const roi = capitalComprometido > 0 ? (primaCsp + primaCc) / capitalComprometido : 0;
            const hasCc = cc.strikeCall > 0 && cc.primaCall > 0;
            const rows: Array<{ label: string; value: string; color?: string }> = [
              { label: "Estado", value: hasCc ? "CC_CONFIGURADO" : "CSP_CONFIGURADO", color: hasCc ? "var(--color-buy)" : "var(--color-accent)" },
              { label: "Capital comprometido", value: capitalComprometido > 0 ? `$${capitalComprometido.toFixed(2)}` : "-" },
              { label: "Prima CSP recibida", value: primaCsp > 0 ? `$${primaCsp.toFixed(2)}` : "-", color: "var(--color-buy)" },
              { label: "Prima CC recibida", value: primaCc > 0 ? `$${primaCc.toFixed(2)}` : "-", color: "var(--color-buy)" },
              { label: "Breakeven Wheel", value: breakeven > 0 ? `$${breakeven.toFixed(2)}` : "-" },
              { label: "ROI estimado", value: roi > 0 ? `${(roi * 100).toFixed(2)}%` : "-", color: "var(--color-buy)" },
            ];

            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "var(--space-md)" }}>
                {rows.map((r) => (
                  <div key={r.label} style={{ background: "var(--color-surface)", borderRadius: "var(--radius-sm)", padding: "var(--space-sm) var(--space-md)", border: "1px solid var(--color-border-subtle)" }}>
                    <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: 2 }}>
                      {r.label}
                    </div>
                    <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 700, color: r.color ?? "var(--color-text)" }}>
                      {r.value}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}
    </section>
  );
}

export default SimulatorStrategySection;
