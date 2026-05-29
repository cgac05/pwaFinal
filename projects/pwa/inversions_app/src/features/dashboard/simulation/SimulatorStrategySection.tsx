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

const TERM_STRATEGIES = new Set(["CALENDAR_SPREAD", "DIAGONAL_SPREAD"]);

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
}

export function SimulatorStrategySection({ ticker, activeStrategy, coverageRequest }: Props) {
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

  const cardStyle: React.CSSProperties = {
    padding: "var(--space-lg)",
    opacity: (!isCoverageStrategy && !isTermStrategy) ? 0.5 : 1,
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
        {(isTermStrategy || !isCoverageStrategy) && (
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
      {!isCoverageStrategy && !isTermStrategy && (
        <p style={mutedText}>
          El análisis de {sectionTitle} está en construcción y estará disponible próximamente.
        </p>
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
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
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
                      <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid rgba(255,255,255,0.04)", fontWeight: selectedKind === r.kind ? 600 : 400 }}>
                        {KIND_LABELS[r.kind] ?? r.kind}
                      </td>
                      <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        {r.confidenceScore.toFixed(2)}
                      </td>
                      <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "var(--color-buy)" }}>
                        {r.summary.maxProfit === "∞" ? "∞" : `$${Number(r.summary.maxProfit).toLocaleString()}`}
                      </td>
                      <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "var(--color-sell)" }}>
                        ${r.summary.maxLoss.toLocaleString()}
                      </td>
                      <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        ${r.summary.breakEvenPrice.toFixed(2)}
                      </td>
                      <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        ${r.summary.stopLossPrice.toFixed(2)}
                      </td>
                      <td style={{ padding: "var(--space-sm)", fontSize: "var(--font-size-sm)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
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
    </section>
  );
}

export default SimulatorStrategySection;
