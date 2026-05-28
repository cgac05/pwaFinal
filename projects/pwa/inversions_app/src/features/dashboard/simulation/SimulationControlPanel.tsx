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
import { StrategySelector } from "./StrategySelector";
import { RiskToleranceToggle } from "./RiskToleranceToggle";
import { ExecuteSimulationButton } from "./ExecuteSimulationButton";
import { FundamentalAnalysisModal, type AnalysisResult } from "./FundamentalAnalysisModal";

interface Props {
  ticket: string;
  onResult: (result: SimulationResponse) => void;
  onFundamentalRows?: (rows: ConfluenceSignalRow[]) => void;
  onProjectionResult?: (result: AnalysisResult) => void;
}

type Preset = "2A" | "1A" | "6M" | "3M" | "1M";
type AnalysisMode = "A_TECNICO" | "A_FUNDAMENTAL" | "A_INDICADORES";
type InvestmentProfile = "Value" | "Growth" | "Dividend" | "Quality" | "Aggressive";
type InvestmentHorizon = "Corto plazo" | "Mediano plazo" | "Largo plazo";
type OptionsStrategy = "Short Call" | "Short Put" | "Long Call" | "Long Put";
type DataSource = "FMP" | "Finnhub" | "SimFin" | "Finviz" | "Yahoo Finance";

const PRESETS: Preset[] = ["2A", "1A", "6M", "3M", "1M"];
const TIMEFRAMES: Array<"1m" | "5m" | "15m" | "1h" | "4h" | "1d"> = ["1m", "5m", "15m", "1h", "4h", "1d"];

const ANALYSIS_MODES: { id: AnalysisMode; label: string }[] = [
  { id: "A_TECNICO", label: "A_TECNICO" },
  { id: "A_FUNDAMENTAL", label: "A_FUNDAMENTAL" },
  { id: "A_INDICADORES", label: "A_INDICADORES" }
];

const INVESTMENT_PROFILES: InvestmentProfile[] = ["Value", "Growth", "Dividend", "Quality", "Aggressive"];
const INVESTMENT_HORIZONS: InvestmentHorizon[] = ["Corto plazo", "Mediano plazo", "Largo plazo"];
const OPTIONS_STRATEGIES: OptionsStrategy[] = ["Short Call", "Short Put", "Long Call", "Long Put"];

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
  "Comparar con sector",
  "Comparar con industria",
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

const modeBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: "0.4rem 1rem",
  border: `1px solid ${active ? "var(--color-accent, #ffd43b)" : "var(--color-border)"}`,
  borderRadius: "var(--radius-sm, 4px)",
  background: active ? "var(--color-accent, #ffd43b)" : "transparent",
  color: active ? "#000" : "var(--color-text-muted)",
  fontWeight: active ? 800 : 500,
  fontSize: "0.75rem",
  cursor: "pointer",
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  transition: "all 0.15s"
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

export function SimulationControlPanel({ ticket, onResult, onFundamentalRows, onProjectionResult }: Props) {
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("A_TECNICO");

  const [preset, setPreset] = useState<Preset>("3M");
  const [estrategiaFrom, setEstrategiaFrom] = useState(isoToday());
  const [estrategiaTo, setEstrategiaTo] = useState(isoPlusDays(30));
  const [temporalidad, setTemporalidad] = useState<"1m" | "5m" | "15m" | "1h" | "4h" | "1d">("1h");
  const [estrategia, setEstrategia] = useState("IRON_CONDOR");
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

  const [investmentProfile, setInvestmentProfile] = useState<InvestmentProfile>("Value");
  const [horizon, setHorizon] = useState<InvestmentHorizon>("Largo plazo");
  const [metricsOn, setMetricsOn] = useState<Record<string, boolean>>(
    FUNDAMENTAL_METRICS.reduce((acc, m) => ({ ...acc, [m]: true }), {} as Record<string, boolean>)
  );
  const [comparisonsOn, setComparisonsOn] = useState<Record<string, boolean>>(
    COMPARISON_OPTIONS.reduce((acc, c) => ({ ...acc, [c]: true }), {} as Record<string, boolean>)
  );
  const [optionsStrategy, setOptionsStrategy] = useState<OptionsStrategy>("Long Call");
  const [dataSource, setDataSource] = useState<DataSource>("FMP");
  const [modalResult, setModalResult] = useState<AnalysisResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [roeMin, setRoeMin] = useState("");
  const [revenueGrowthMin, setRevenueGrowthMin] = useState("");
  const [debtEquityMax, setDebtEquityMax] = useState("");
  const [netMarginMin, setNetMarginMin] = useState("");

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
        estrategia,
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
          investmentProfile,
          horizon,
          selectedMetrics: Object.entries(metricsOn).filter(([, v]) => v).map(([k]) => k),
          strategy: optionsStrategy,
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

  return (
    <section className="card" style={{ display: "grid", gap: "0.75rem" }}>
      {/* ── Mode selector ─────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <h2 style={{ margin: 0 }}>Panel de Control · Analisis</h2>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {ANALYSIS_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              style={modeBtnStyle(analysisMode === m.id)}
              onClick={() => setAnalysisMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── A_TECNICO / A_INDICADORES panel ───────────── */}
      {analysisMode !== "A_FUNDAMENTAL" && (
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
            <StrategySelector value={estrategia} onChange={setEstrategia} />
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
      {analysisMode === "A_FUNDAMENTAL" && (
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
            {projectionFrom && projectionTo && (() => {
              const days = Math.round((new Date(projectionTo).getTime() - new Date(projectionFrom).getTime()) / 86_400_000);
              return days > 0 ? (
                <p style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", marginTop: "0.35rem" }}>
                  Proyección de <strong style={{ color: "var(--color-accent, #ffd43b)" }}>{days} días</strong> ({projectionFrom} → {projectionTo})
                </p>
              ) : null;
            })()}
          </div>

          {/* Perfil de Inversión */}
          <div>
            <p style={sectionLabelStyle}>Perfil de Inversión</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {INVESTMENT_PROFILES.map((p) => (
                <button key={p} type="button" style={chipStyle(investmentProfile === p)} onClick={() => setInvestmentProfile(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Horizonte de Inversión */}
          <div>
            <p style={sectionLabelStyle}>Horizonte de Inversión</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {INVESTMENT_HORIZONS.map((h) => (
                <button key={h} type="button" style={chipStyle(horizon === h)} onClick={() => setHorizon(h)}>
                  {h}
                </button>
              ))}
            </div>
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

          {/* Filtros Fundamentales */}
          <div>
            <p style={sectionLabelStyle}>Filtros Fundamentales</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.6rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.75rem" }}>
                <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>ROE mínimo (%)</span>
                <input type="number" placeholder="ej. 15" value={roeMin} onChange={(e) => setRoeMin(e.target.value)} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.75rem" }}>
                <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Revenue Growth mínimo (%)</span>
                <input type="number" placeholder="ej. 10" value={revenueGrowthMin} onChange={(e) => setRevenueGrowthMin(e.target.value)} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.75rem" }}>
                <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Debt/Equity máximo</span>
                <input type="number" placeholder="ej. 0.5" value={debtEquityMax} onChange={(e) => setDebtEquityMax(e.target.value)} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.75rem" }}>
                <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Margen Neto mínimo (%)</span>
                <input type="number" placeholder="ej. 5" value={netMarginMin} onChange={(e) => setNetMarginMin(e.target.value)} />
              </label>
            </div>
          </div>

          {/* Estrategia de Opciones */}
          <div>
            <p style={sectionLabelStyle}>Estrategia de Opciones</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {OPTIONS_STRATEGIES.map((s) => (
                <button key={s} type="button" style={chipStyle(optionsStrategy === s)} onClick={() => setOptionsStrategy(s)}>
                  {s}
                </button>
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
          <div>
            <p style={sectionLabelStyle}>Comparaciones</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {COMPARISON_OPTIONS.map((c) => (
                <label key={c} style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", fontSize: "0.82rem" }} onClick={() => toggleComparison(c)}>
                  <span style={toggleStyle(comparisonsOn[c])}>
                    <span style={toggleKnobStyle(comparisonsOn[c])} />
                  </span>
                  <span style={{ color: comparisonsOn[c] ? "var(--color-text)" : "var(--color-text-muted)" }}>{c}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && <div style={{ color: "var(--color-sell, #f85149)", fontSize: "0.8rem" }}>Error: {error}</div>}

      {/* ── Modal de análisis fundamental ─────────────── */}
      {showModal && modalResult && (
        <FundamentalAnalysisModal result={modalResult} onClose={handleModalClose} />
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {analysisMode === "A_FUNDAMENTAL" ? (
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
          <ExecuteSimulationButton loading={loading} onClick={run} />
        )}
      </div>
    </section>
  );
}

export default SimulationControlPanel;
