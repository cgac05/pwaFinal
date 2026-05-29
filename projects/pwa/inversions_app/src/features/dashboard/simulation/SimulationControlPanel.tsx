// FIC: Phase 5 T098 — panel de simulacion del PDF v1 (rangos, estrategia, tolerancia, toggles SI/NO).

import React, { useState, useEffect } from "react";
import {
  runSimulation,
  ALL_CORES,
  ALL_SUBCORES,
  type CoreId,
  type SubCoreIndicador,
  type SimulationRequestPayload,
  type SimulationResponse,
  type ConfluenceSignalRow
} from "../../../services/signals/confluenceTableApi";
import { RiskToleranceToggle } from "./RiskToleranceToggle";
import { ExecuteSimulationButton } from "./ExecuteSimulationButton";
import { FundamentalAnalysisModal, type AnalysisResult } from "./FundamentalAnalysisModal";
import { useSignalStore } from "../../../store/signals";

interface Props {
  ticket: string;
  onResult: (result: SimulationResponse) => void;
  onFundamentalRows?: (rows: ConfluenceSignalRow[]) => void;
  onProjectionResult?: (result: AnalysisResult) => void;
  isFundamentalMode?: boolean;
}

type Preset = "2A" | "1A" | "6M" | "3M" | "1M";
type DataSource = "FMP" | "Finnhub" | "SimFin" | "Finviz" | "Yahoo Finance";

const PRESETS: Preset[] = ["2A", "1A", "6M", "3M", "1M"];
const TIMEFRAMES: Array<"1m" | "5m" | "15m" | "1h" | "4h" | "1d"> = ["1m", "5m", "15m", "1h", "4h", "1d"];

const DATA_SOURCES: { id: DataSource; sourceId: string; available: boolean }[] = [
  { id: "FMP",          sourceId: "fmp",          available: true },
  { id: "Finnhub",      sourceId: "finnhub",      available: true },
  { id: "SimFin",       sourceId: "simfin",       available: true },
  { id: "Finviz",       sourceId: "finviz",       available: true },
  { id: "Yahoo Finance",sourceId: "yahoo_finance",available: true }
];

const FUNDAMENTAL_METRICS = [
  "Valoración",
  "Crecimiento",
  "Rentabilidad",
  "Salud Financiera",
  "Flujo de Caja",
  "Riesgo",
  "Ventaja Competitiva"
] as const;

const COMPARISON_OPTIONS = [
  "Comparar con S&P500"
] as const;

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoPlusDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

const chipStyle = (active: boolean): React.CSSProperties => ({
  padding: "0.35rem 0.85rem",
  border: `1px solid ${active ? "var(--color-accent, #ffd43b)" : "var(--color-border)"}`,
  borderRadius: "2rem",
  background: active ? "rgba(255,212,59,0.12)" : "transparent",
  color: active ? "var(--color-accent, #ffd43b)" : "var(--color-text-muted)",
  fontWeight: active ? 700 : 500,
  fontSize: "0.78rem",
  cursor: "pointer",
  transition: "all 0.15s",
  letterSpacing: "0.02em"
});

const sectionLabelStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "var(--color-text-muted)",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: "0.5rem"
};

const toggleStyle = (active: boolean): React.CSSProperties => ({
  width: 36,
  height: 20,
  borderRadius: 10,
  background: active ? "var(--color-accent, #ffd43b)" : "var(--color-border)",
  position: "relative",
  cursor: "pointer",
  transition: "background 0.2s",
  display: "inline-block",
  flexShrink: 0
});

const toggleKnobStyle = (active: boolean): React.CSSProperties => ({
  width: 14,
  height: 14,
  borderRadius: "50%",
  background: active ? "#000" : "var(--color-text-muted)",
  position: "absolute",
  top: 3,
  left: active ? 19 : 3,
  transition: "left 0.2s"
});

export function SimulationControlPanel({ ticket, onResult, onFundamentalRows, onProjectionResult, isFundamentalMode = false }: Props) {
  const { selectedOptionsStrategy } = useSignalStore();
  const [preset, setPreset] = useState<Preset>("3M");
  const [estrategiaFrom, setEstrategiaFrom] = useState(isoToday());
  const [estrategiaTo, setEstrategiaTo] = useState(isoPlusDays(30));
  const [temporalidad, setTemporalidad] = useState<"1m" | "5m" | "15m" | "1h" | "4h" | "1d">("1h");
  const [tolerancia, setTolerancia] = useState<"BAJO" | "MEDIO" | "ALTO">("MEDIO");
  const [coresOn, setCoresOn] = useState<Record<CoreId, boolean>>(
    ALL_CORES.reduce((acc, c) => ({ ...acc, [c]: true }), {} as Record<CoreId, boolean>)
  );
  const [indicadoresOn, setIndicadoresOn] = useState<Record<SubCoreIndicador, boolean>>(
    ALL_SUBCORES.reduce((acc, s) => ({ ...acc, [s]: true }), {} as Record<SubCoreIndicador, boolean>)
  );

  const [fundamentalTicker, setFundamentalTicker] = useState(ticket);
  const [fundamentalTickerInput, setFundamentalTickerInput] = useState("");

  useEffect(() => {
    setFundamentalTicker(ticket);
  }, [ticket]);

  const [metricsOn, setMetricsOn] = useState<Record<string, boolean>>(
    FUNDAMENTAL_METRICS.reduce((acc, m) => ({ ...acc, [m]: true }), {} as Record<string, boolean>)
  );
  const [comparisonsOn, setComparisonsOn] = useState<Record<string, boolean>>(
    COMPARISON_OPTIONS.reduce((acc, c) => ({ ...acc, [c]: true }), {} as Record<string, boolean>)
  );
  const [dataSource, setDataSource] = useState<DataSource>("FMP");
  const [modalResult, setModalResult] = useState<AnalysisResult | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [projectionFrom, setProjectionFrom] = useState(isoToday());
  const [projectionTo, setProjectionTo] = useState(isoPlusDays(30));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCore = (c: CoreId) => setCoresOn((prev) => ({ ...prev, [c]: !prev[c] }));
  const toggleSub = (s: SubCoreIndicador) => setIndicadoresOn((prev) => ({ ...prev, [s]: !prev[s] }));
  const toggleMetric = (m: string) => setMetricsOn((prev) => ({ ...prev, [m]: !prev[m] }));
  const toggleComparison = (c: string) => setComparisonsOn((prev) => ({ ...prev, [c]: !prev[c] }));

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: SimulationRequestPayload = {
        ticket,
        rangoHistorico: preset,
        rangoEstrategia: { from: estrategiaFrom, to: estrategiaTo },
        temporalidad,
        runtimeMode: "OFFLINE",
        coresHabilitados: ALL_CORES.filter((c) => coresOn[c]),
        indicadoresHabilitados: ALL_SUBCORES.filter((s) => indicadoresOn[s]),
        estrategia: "IRON_CONDOR",
        toleranciaRiesgo: tolerancia
      };
      const result = await runSimulation(payload);
      onResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "simulation_failed");
    } finally {
      setLoading(false);
    }
  };

  const runFundamental = async () => {
    setLoading(true);
    setError(null);
    try {
      const src = DATA_SOURCES.find((d) => d.id === dataSource);
      const res = await fetch("/api/team-03/fundamental/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: fundamentalTicker || ticket,
          source: src?.sourceId ?? "fmp",
          investmentProfile: "Quality",
          horizon: "Mediano plazo",
          selectedMetrics: Object.entries(metricsOn).filter(([, v]) => v).map(([k]) => k),
          strategy: selectedOptionsStrategy?.name ?? "Long Call",
          comparisons: Object.entries(comparisonsOn).filter(([, v]) => v).map(([k]) => k),
          projectionFrom,
          projectionTo
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message ?? "fundamental_failed");
      }
      const data = (await res.json()) as AnalysisResult;
      setModalResult(data);
      setShowModal(false);
      if (data.confluenceRows && onFundamentalRows) {
        onFundamentalRows(data.confluenceRows as unknown as ConfluenceSignalRow[]);
      }
      onProjectionResult?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "fundamental_failed");
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    if (modalResult?.confluenceRows && onFundamentalRows) {
      onFundamentalRows(modalResult.confluenceRows as unknown as ConfluenceSignalRow[]);
    }
  };

  const projectionDays =
    projectionFrom && projectionTo
      ? Math.round((new Date(projectionTo).getTime() - new Date(projectionFrom).getTime()) / 86_400_000)
      : 0;

  return (
    <section className="card" style={{ display: "grid", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <h2 style={{ margin: 0 }}>Panel de Control · Analisis</h2>
      </div>

      {/* ── A_TECNICO / A_INDICADORES panel ───────────── */}
      {!isFundamentalMode && (
        <>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem" }}>
              <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Rango Historico</span>
              <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
                {PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem" }}>
              <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Estrategia Desde</span>
              <input type="date" value={estrategiaFrom} onChange={(e) => setEstrategiaFrom(e.target.value)} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem" }}>
              <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Estrategia Hasta</span>
              <input type="date" value={estrategiaTo} onChange={(e) => setEstrategiaTo(e.target.value)} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem" }}>
              <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Temporalidad</span>
              <select value={temporalidad} onChange={(e) => setTemporalidad(e.target.value as any)}>
                {TIMEFRAMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <RiskToleranceToggle value={tolerancia} onChange={setTolerancia} />
          </div>

          <fieldset style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.5rem 0.75rem" }}>
            <legend style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", textTransform: "uppercase" }}>Cores (SI/NO)</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {ALL_CORES.map((c) => (
                <label key={c} style={{ display: "flex", gap: "0.3rem", alignItems: "center", fontSize: "0.8rem" }}>
                  <input type="checkbox" checked={coresOn[c]} onChange={() => toggleCore(c)} />
                  {c}: <strong>{coresOn[c] ? "SI" : "NO"}</strong>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.5rem 0.75rem" }}>
            <legend style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", textTransform: "uppercase" }}>Indicadores (SI/NO)</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {ALL_SUBCORES.map((s) => (
                <label key={s} style={{ display: "flex", gap: "0.3rem", alignItems: "center", fontSize: "0.8rem" }}>
                  <input type="checkbox" checked={indicadoresOn[s]} onChange={() => toggleSub(s)} />
                  {s}: <strong>{indicadoresOn[s] ? "SI" : "NO"}</strong>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}

      {/* ── A_FUNDAMENTAL panel ────────────────────────── */}
      {isFundamentalMode && (
        <div style={{ display: "grid", gap: "1rem" }}>
          {/* Empresa a Analizar */}
          <div>
            <p style={sectionLabelStyle}>Empresa a Analizar</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.6rem" }}>
              {["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "SPY"].map((t) => (
                <button key={t} type="button" style={chipStyle(fundamentalTicker === t)} onClick={() => setFundamentalTicker(t)}>
                  {t}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const val = fundamentalTickerInput.trim().toUpperCase();
                if (val) { setFundamentalTicker(val); setFundamentalTickerInput(""); }
              }}
              style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
            >
              <input
                type="text"
                placeholder="Ticker personalizado (ej. NFLX)"
                value={fundamentalTickerInput}
                onChange={(e) => setFundamentalTickerInput(e.target.value.toUpperCase())}
                style={{ flex: 1, minWidth: 0 }}
              />
              <button type="submit" style={{ padding: "0.4rem 0.9rem", border: "1px solid var(--color-accent, #ffd43b)", borderRadius: "var(--radius-sm, 4px)", background: "transparent", color: "var(--color-accent, #ffd43b)", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer" }}>
                Usar
              </button>
            </form>
            {fundamentalTicker && (
              <p style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", marginTop: "0.35rem" }}>
                Empresa seleccionada: <strong style={{ color: "var(--color-accent, #ffd43b)" }}>{fundamentalTicker}</strong>
              </p>
            )}
          </div>

          {/* Rango de Proyección */}
          <div>
            <p style={sectionLabelStyle}>Rango de Proyección</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.6rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.75rem" }}>
                <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Desde</span>
                <input type="date" value={projectionFrom} onChange={(e) => setProjectionFrom(e.target.value)} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.75rem" }}>
                <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Hasta</span>
                <input type="date" value={projectionTo} onChange={(e) => setProjectionTo(e.target.value)} />
              </label>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem" }}>
              {[
                { label: "1 semana", days: 7 },
                { label: "2 semanas", days: 14 },
                { label: "1 mes", days: 30 },
                { label: "3 meses", days: 90 },
                { label: "6 meses", days: 180 },
                { label: "1 año", days: 365 }
              ].map(({ label, days }) => {
                const from = isoToday();
                const to = isoPlusDays(days);
                const active = projectionFrom === from && projectionTo === to;
                return (
                  <button key={label} type="button" style={chipStyle(active)} onClick={() => { setProjectionFrom(from); setProjectionTo(to); }}>
                    {label}
                  </button>
                );
              })}
            </div>
            {projectionDays > 0 && (
              <p style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", marginTop: "0.35rem" }}>
                Proyección de <strong style={{ color: "var(--color-accent, #ffd43b)" }}>{projectionDays} días</strong> ({projectionFrom} → {projectionTo})
              </p>
            )}
          </div>

          {/* Métricas Fundamentales */}
          <div>
            <p style={sectionLabelStyle}>Métricas Fundamentales</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.4rem" }}>
              {FUNDAMENTAL_METRICS.map((m) => (
                <label key={m} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.82rem" }}>
                  <input type="checkbox" checked={metricsOn[m]} onChange={() => toggleMetric(m)} style={{ accentColor: "var(--color-accent, #ffd43b)", width: 15, height: 15 }} />
                  <span style={{ color: metricsOn[m] ? "var(--color-text)" : "var(--color-text-muted)" }}>{m}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Fuente de Datos */}
          <div>
            <p style={sectionLabelStyle}>Fuente de Datos</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {DATA_SOURCES.map(({ id }) => (
                <button key={id} type="button" style={chipStyle(dataSource === id)} onClick={() => setDataSource(id)}>
                  {id}
                </button>
              ))}
            </div>
          </div>

          {/* Comparaciones */}
        </div>
      )}

      {error && <div style={{ color: "var(--color-sell, #f85149)", fontSize: "0.8rem" }}>Error: {error}</div>}

      {/* ── Modal de análisis fundamental ─────────────── */}
      {showModal && modalResult && (
        <FundamentalAnalysisModal result={modalResult} onClose={handleModalClose} />
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {isFundamentalMode ? (
          <button
            type="button"
            disabled={loading}
            onClick={runFundamental}
            style={{
              background: "var(--color-accent, #ffd43b)",
              color: "#000",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              padding: "0.75rem 1.5rem",
              border: 0,
              borderRadius: "var(--radius-sm, 4px)",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
            }}
          >
            {loading ? "Ejecutando…" : "▶ Ejecutar Simulacion"}
          </button>
        ) : (
          <ExecuteSimulationButton
            loading={loading}
            onClick={run}
            loadingText={coresOn["A_IA"] ? "Calculando Cores e IA..." : undefined}
          />
        )}
      </div>
    </section>
  );
}

export default SimulationControlPanel;
