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

const TERM_STRATEGIES = new Set(["CALENDAR_SPREAD", "DIAGONAL_SPREAD"]);
const CORE_OPTION_STRATEGIES = new Set(["LONG_CALL", "LONG_PUT", "SHORT_CALL", "SHORT_PUT"]);

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
}

function money(value: number | "Ilimitado"): string {
  return value === "Ilimitado" ? "Ilimitado" : `$${value.toFixed(2)}`;
}

export function SimulatorStrategySection({ ticker, activeStrategy, coverageRequest, optionStrategyAnalysis, wheelSummary }: Props) {
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

  const cardStyle: React.CSSProperties = {
    padding: "var(--space-lg)",
    opacity: (!isCoverageStrategy && !isTermStrategy && !isCoreOptionStrategy && !isWheelStrategy) ? 0.5 : 1,
  };

  const mutedText: React.CSSProperties = {
    margin: 0,
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text-muted)",
  };

  return (
    <section className="card" style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
        <h2 style={{ margin: 0, fontSize: "var(--font-size-base)" }}>
          Estrategia · {sectionTitle}
        </h2>
        {(isTermStrategy || (!isCoverageStrategy && !isCoreOptionStrategy && !isWheelStrategy)) && (
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

      {/* TERM strategies — placeholder */}
      {isTermStrategy && (
        <p style={mutedText}>
          El análisis de estrategias temporales (Calendar / Diagonal Spread) estará disponible en un sprint posterior.
        </p>
      )}

      {/* Unknown strategies */}
      {!isCoverageStrategy && !isTermStrategy && !isCoreOptionStrategy && !isWheelStrategy && (
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
          {/* Waiting for params */}
          {!coverageRequest && !loading && !results && (
            <p style={mutedText}>
              Selecciona los parámetros en el panel de control para ver el análisis de {sectionTitle}.
            </p>
          )}

          {loading && (
            <p style={mutedText}>Analizando estrategias de cobertura…</p>
          )}

          {error && (
            <p style={{ ...mutedText, color: "var(--color-sell)" }}>⚠ {error}</p>
          )}

          {results && (
            <>
              {/* Strategy table */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "var(--space-lg)" }}>
                <thead>
                  <tr>
                    {["Estrategia", "Score", "Max Profit", "Max Loss", "Break-even", "Stop-loss", "Nivel"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "var(--space-xs) var(--space-sm)",
                          fontSize: "var(--font-size-xs)",
                          color: "var(--color-text-muted)",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          borderBottom: "1px solid var(--color-border-subtle)",
                        }}
                      >
                        {h}
                      </th>
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

              <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", margin: "var(--space-sm) 0" }}>
                Haz clic en una fila para ver su diagrama de payoff
              </p>

              {/* PayoffChart */}
              {selectedResult && payoffPoints.length > 0 && (
                <div style={{ marginBottom: "var(--space-lg)" }}>
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-sm)" }}>
                    Diagrama de payoff — {KIND_LABELS[selectedResult.kind] ?? selectedResult.kind}
                  </p>
                  <PayoffChart points={payoffPoints} breakEvenPrice={breakEven} height={200} />
                </div>
              )}

              {/* Alerts */}
              {selectedResult && selectedResult.alerts.length > 0 && (
                <div>
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-sm)" }}>
                    Alertas:
                  </p>
                  {selectedResult.alerts.map((a, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "var(--space-xs) var(--space-sm)",
                        marginBottom: "var(--space-xs)",
                        borderRadius: "var(--radius-xs)",
                        backgroundColor:
                          a.severity === "critical" ? "rgba(226,59,74,0.12)"
                          : a.severity === "warning" ? "rgba(176,144,0,0.12)"
                          : "rgba(255,255,255,0.04)",
                        border: `1px solid ${
                          a.severity === "critical" ? "rgba(226,59,74,0.3)"
                          : a.severity === "warning" ? "rgba(176,144,0,0.3)"
                          : "rgba(255,255,255,0.06)"
                        }`,
                        fontSize: "var(--font-size-xs)",
                        color: "var(--color-text)",
                      }}
                    >
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
                  <div
                    key={r.label}
                    style={{
                      background: "var(--color-surface)",
                      borderRadius: "var(--radius-sm)",
                      padding: "var(--space-sm) var(--space-md)",
                      border: "1px solid var(--color-border-subtle)",
                    }}
                  >
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
