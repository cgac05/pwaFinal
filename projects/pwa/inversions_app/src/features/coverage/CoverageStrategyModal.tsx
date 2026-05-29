// FIC: CoverageStrategyModal — parameter form + 4-strategy table + PayoffChart. (EN)
// FIC: CoverageStrategyModal — formulario de parámetros + tabla de 4 estrategias + PayoffChart. (ES)

import React, { useState, useRef, useEffect } from "react";
import { ContentModal } from "../../components/ui/ContentModal";
import { PayoffChart } from "../../components/coverage/PayoffChart";
import {
  postCoverageAnalyze,
  type CoverageAnalyzeResponse,
  type CoverageStrategyResult,
} from "../../services/coverage/coverageApi";
import { useSignalStore } from "../../store/signals";
import { getMarketQuotes } from "../../services/signals/marketApi";
import type { InstitutionalAnalysisResponse } from "../../services/institutional/institutionalApi";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialTicker?: string;
  initialKind?: "protective_put" | "married_put" | "collar_put" | "covered_straddle";
  institutionalContext?: InstitutionalAnalysisResponse;
}

const KIND_LABELS: Record<string, string> = {
  protective_put: "Protective Put",
  married_put: "Married Put",
  collar_put: "Collar Put",
  covered_straddle: "Covered Straddle",
};

const BADGE_COLORS: Record<string, string> = {
  ALTA: "var(--color-buy)",
  MEDIA: "var(--color-hold)",
  BAJA: "var(--color-sell)",
};

export function CoverageStrategyModal({ isOpen, onClose, initialTicker, initialKind, institutionalContext }: Props) {
  const { selectedInstrument } = useSignalStore();

  const [ticker, setTicker] = useState(initialTicker ?? selectedInstrument?.symbol ?? "SPY");
  const [currentPrice, setCurrentPrice] = useState("");
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState(false);
  const [shares, setShares] = useState("100");
  const [putStrike, setPutStrike] = useState("");
  const [callStrike, setCallStrike] = useState("");
  const [riskPct, setRiskPct] = useState("5");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CoverageAnalyzeResponse | null>(null);
  const [selectedKind, setSelectedKind] = useState<string | null>(initialKind ?? null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTicker(initialTicker ?? selectedInstrument?.symbol ?? "SPY");
      setResults(null);
      setError(null);
      setSelectedKind(initialKind ?? null);
    }
  }, [isOpen, initialTicker, selectedInstrument?.symbol, initialKind]);

  useEffect(() => {
    if (!isOpen || !ticker) return;

    let cancelled = false;
    setPriceLoading(true);
    setPriceError(false);

    getMarketQuotes([ticker])
      .then((data) => {
        if (cancelled) return;
        const quote = data.quotes.find((q) => q.symbol === ticker.toUpperCase());
        if (quote) {
          setCurrentPrice(quote.price.toFixed(2));
        } else {
          setPriceError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setPriceError(true);
      })
      .finally(() => {
        if (!cancelled) setPriceLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, ticker]);

  async function handleAnalyze() {
    const price = parseFloat(currentPrice);
    const sharesN = parseInt(shares);
    if (!ticker || isNaN(price) || isNaN(sharesN)) {
      setError(priceError ? "No se pudo obtener el precio actual. Intenta de nuevo más tarde." : "Ticker, precio y shares son obligatorios.");
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const body = {
        ticker: ticker.toUpperCase(),
        currentPrice: price,
        shares: sharesN,
        riskTolerancePct: parseFloat(riskPct) / 100,
        ...(putStrike ? { putStrikePrice: parseFloat(putStrike) } : {}),
        ...(callStrike ? { callStrikePrice: parseFloat(callStrike) } : {}),
        institutionalContext: institutionalContext
          ? {
              direction: (
                institutionalContext.trends?.direction === "bullish" ? "bullish"
                : institutionalContext.trends?.direction === "bearish" ? "bearish"
                : "lateral"
              ) as "bullish" | "bearish" | "lateral",
              continuityProbability: institutionalContext.trends?.continuityProbability ?? 0.5,
              institutionalScore: institutionalContext.zones?.institutionalScore ?? 0.5,
              hasNearExpiration: (institutionalContext.expiration?.events?.length ?? 0) > 0,
            }
          : undefined,
      };
      const data = await postCoverageAnalyze(body, abortRef.current.signal);
      setResults(data);
      if (!selectedKind && data.results.length > 0) {
        setSelectedKind(data.results[0].kind);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Error al analizar estrategias. Verifica que el backend esté disponible.");
      }
    } finally {
      setLoading(false);
    }
  }

  const selectedResult = results?.results.find((r) => r.kind === selectedKind) ?? null;
  const payoffPoints = selectedResult?.payoffPoints ?? [];
  const breakEven = selectedResult?.summary.breakEvenPrice ?? 0;

  const inputStyle: React.CSSProperties = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-xs)",
    color: "var(--color-text)",
    fontSize: "var(--font-size-sm)",
    padding: "var(--space-xs) var(--space-sm)",
    width: "100%",
    outline: "none",
  };

  const readOnlyInputStyle: React.CSSProperties = {
    ...inputStyle,
    background: "var(--color-surface-raised)",
    border: "1px solid var(--color-border-subtle)",
    color: "var(--color-text-muted)",
    cursor: "default",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-muted)",
    marginBottom: "var(--space-xs)",
    display: "block",
  };

  return (
    <ContentModal
      isOpen={isOpen}
      onClose={onClose}
      title="Estrategias de Cobertura"
      subtitle="Compara Protective Put · Married Put · Collar · Covered Straddle"
      width="900px"
      data-testid="coverage-strategy-modal"
    >
      {/* Parameter form */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "var(--space-sm)",
          marginBottom: "var(--space-lg)",
          padding: "var(--space-md)",
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--color-border-subtle)",
        }}
      >
        <div>
          <label style={labelStyle}>Ticker</label>
          <input style={readOnlyInputStyle} value={ticker} readOnly />
        </div>
        <div>
          <label style={labelStyle}>
            Precio actual
            {priceLoading && (
              <span style={{ marginLeft: "var(--space-xs)", color: "var(--color-text-muted)", fontStyle: "italic" }}>
                cargando…
              </span>
            )}
            {priceError && !priceLoading && (
              <span style={{ marginLeft: "var(--space-xs)", color: "var(--color-sell)" }}>
                ⚠ no disponible
              </span>
            )}
          </label>
          <input
            style={readOnlyInputStyle}
            type="number"
            value={currentPrice}
            readOnly
            placeholder={priceLoading ? "Cargando…" : "—"}
          />
        </div>
        <div>
          <label style={labelStyle}>Shares</label>
          <input style={inputStyle} type="number" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="100" />
        </div>
        <div>
          <label style={labelStyle}>Strike Put (opc.)</label>
          <input style={inputStyle} type="number" value={putStrike} onChange={(e) => setPutStrike(e.target.value)} placeholder="auto" />
        </div>
        <div>
          <label style={labelStyle}>Strike Call (opc.)</label>
          <input style={inputStyle} type="number" value={callStrike} onChange={(e) => setCallStrike(e.target.value)} placeholder="auto" />
        </div>
        <div>
          <label style={labelStyle}>Riesgo (%)</label>
          <input style={inputStyle} type="number" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} placeholder="5" />
        </div>
      </div>

      <button
        onClick={handleAnalyze}
        disabled={loading}
        style={{
          backgroundColor: loading ? "rgba(73,79,223,0.5)" : "var(--color-accent)",
          color: "white",
          border: "none",
          borderRadius: "var(--radius-xs)",
          padding: "var(--space-xs) var(--space-lg)",
          fontSize: "var(--font-size-sm)",
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          marginBottom: "var(--space-lg)",
          transition: "background-color var(--duration-fast) var(--easing-standard)",
        }}
      >
        {loading ? "Analizando…" : "Analizar 4 estrategias"}
      </button>

      {error && (
        <p style={{ color: "var(--color-sell)", fontSize: "var(--font-size-sm)", marginBottom: "var(--space-md)" }}>
          ⚠️ {error}
        </p>
      )}

      {/* Results table */}
      {results && (
        <>
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
              {results.results.map((r) => (
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
                    <span
                      style={{
                        color: BADGE_COLORS[r.confidenceLevel],
                        fontWeight: 700,
                        fontSize: "var(--font-size-xs)",
                      }}
                    >
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

          {/* PayoffChart for selected strategy */}
          {selectedResult && payoffPoints.length > 0 && (
            <div>
              <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-sm)" }}>
                Diagrama de payoff — {KIND_LABELS[selectedResult.kind] ?? selectedResult.kind}
              </p>
              <PayoffChart points={payoffPoints} breakEvenPrice={breakEven} height={200} />
            </div>
          )}

          {/* Alerts for selected strategy */}
          {selectedResult && selectedResult.alerts.length > 0 && (
            <div style={{ marginTop: "var(--space-lg)" }}>
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
                      a.severity === "critical"
                        ? "rgba(226,59,74,0.12)"
                        : a.severity === "warning"
                        ? "rgba(176,144,0,0.12)"
                        : "rgba(255,255,255,0.04)",
                    border: `1px solid ${a.severity === "critical" ? "rgba(226,59,74,0.3)" : a.severity === "warning" ? "rgba(176,144,0,0.3)" : "rgba(255,255,255,0.06)"}`,
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
    </ContentModal>
  );
}
