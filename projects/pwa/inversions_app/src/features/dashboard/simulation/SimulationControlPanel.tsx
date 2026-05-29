// FIC: Simulation control panel — Revolut tokens applied, logic unchanged.
// FIC: Panel de control de simulación — tokens Revolut aplicados, lógica sin cambios.

import React, { useState } from "react";
import {
  runSimulation,
  ALL_CORES,
  ALL_SUBCORES,
  type CoreId,
  type SubCoreIndicador,
  type SimulationRequestPayload,
  type SimulationResponse
} from "../../../services/signals/confluenceTableApi";
import { StrategySelector } from "./StrategySelector";
import { RiskToleranceToggle } from "./RiskToleranceToggle";
import { ExecuteSimulationButton } from "./ExecuteSimulationButton";
import { TermStrategyModal, type TermStrategyParams } from "./TermStrategyModal";
import { CoverageParamsModal, type CoverageModalParams } from "./CoverageParamsModal";

const TERM_STRATEGIES = new Set(["CALENDAR_SPREAD", "DIAGONAL_SPREAD"]);

function isTermStrategy(e: string): boolean { return TERM_STRATEGIES.has(e); }
function isCoverageStrategy(e: string): boolean { return e === "COVERED_CALL"; }

const DEFAULT_TERM_PARAMS: TermStrategyParams = {
  optionStyle: "CALL",
  strikeShort: 0,
  strikeLong: 0,
  expirationShort: new Date().toISOString().slice(0, 10),
  expirationLong: new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10),
  premiumShort: 0,
  premiumLong: 0,
  contracts: 1,
  riskFreeRate: 0.05
};

const DEFAULT_COVERAGE_PARAMS: CoverageModalParams = {
  currentPrice: 0,
  shares: 100,
  riskTolerancePct: 0.05,
};

interface Props {
  ticket: string;
  onResult: (result: SimulationResponse) => void;
  // FIC: Called with active core IDs when the user clicks Execute — before the API call completes. (EN)
  // FIC: Llamado con los IDs de cores activos cuando el usuario hace clic en Ejecutar — antes de que complete la API. (ES)
  onExecute?: (activeCoreIds: CoreId[]) => void;
  onStrategyChange?: (estrategia: string) => void;
  onCoverageParamsConfirmed?: (params: CoverageModalParams, kind: string) => void;
}

type Preset = "2A" | "1A" | "6M" | "3M" | "1M";
const PRESETS: Preset[] = ["2A", "1A", "6M", "3M", "1M"];
const TIMEFRAMES: Array<"1m" | "5m" | "15m" | "1h" | "4h" | "1d"> = ["1m", "5m", "15m", "1h", "4h", "1d"];

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoPlusDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

export function SimulationControlPanel({ ticket, onResult, onExecute, onStrategyChange, onCoverageParamsConfirmed }: Props) {
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termModalOpen, setTermModalOpen] = useState(false);
  const [termParams, setTermParams] = useState<TermStrategyParams>(DEFAULT_TERM_PARAMS);
  const [coverageModalOpen, setCoverageModalOpen] = useState(false);
  const [coverageParams, setCoverageParams] = useState<CoverageModalParams>(DEFAULT_COVERAGE_PARAMS);

  const handleEstrategiaChange = (e: string) => {
    setEstrategia(e);
    onStrategyChange?.(e);
    if (isTermStrategy(e)) setTermModalOpen(true);
    else if (isCoverageStrategy(e)) setCoverageModalOpen(true);
  };

  const toggleCore = (c: CoreId) => setCoresOn((prev) => ({ ...prev, [c]: !prev[c] }));
  const toggleSub = (s: SubCoreIndicador) => setIndicadoresOn((prev) => ({ ...prev, [s]: !prev[s] }));

  const run = async () => {
    setLoading(true);
    setError(null);
    const activeCoreIds = ALL_CORES.filter((c) => coresOn[c]);
    onExecute?.(activeCoreIds);
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

  const fieldsetStyle: React.CSSProperties = {
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-sm)",
    padding: "var(--space-sm) var(--space-md)"
  };

  const legendStyle: React.CSSProperties = {
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-muted)",
    textTransform: "uppercase",
    fontWeight: "var(--font-weight-emphasis)",
    letterSpacing: "0.06em"
  };

  return (
    <section className="card" style={{ display: "grid", gap: "var(--space-md)" }}>
      <h2 style={{ margin: 0 }}>Panel de Control · Simulacion</h2>

      <div style={{ display: "grid", gap: "var(--space-sm)", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "var(--font-size-xs)" }}>
          <span style={{ color: "var(--color-text-muted)", fontWeight: "var(--font-weight-emphasis)", textTransform: "uppercase" }}>Rango Historico</span>
          <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
            {PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "var(--font-size-xs)" }}>
          <span style={{ color: "var(--color-text-muted)", fontWeight: "var(--font-weight-emphasis)", textTransform: "uppercase" }}>Estrategia Desde</span>
          <input type="date" value={estrategiaFrom} onChange={(e) => setEstrategiaFrom(e.target.value)} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "var(--font-size-xs)" }}>
          <span style={{ color: "var(--color-text-muted)", fontWeight: "var(--font-weight-emphasis)", textTransform: "uppercase" }}>Estrategia Hasta</span>
          <input type="date" value={estrategiaTo} onChange={(e) => setEstrategiaTo(e.target.value)} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "var(--font-size-xs)" }}>
          <span style={{ color: "var(--color-text-muted)", fontWeight: "var(--font-weight-emphasis)", textTransform: "uppercase" }}>Temporalidad</span>
          <select value={temporalidad} onChange={(e) => setTemporalidad(e.target.value as typeof temporalidad)}>
            {TIMEFRAMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <StrategySelector value={estrategia} onChange={handleEstrategiaChange} />
        <RiskToleranceToggle value={tolerancia} onChange={setTolerancia} />
      </div>

      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>Cores (SI/NO)</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", marginTop: "var(--space-xs)" }}>
          {ALL_CORES.map((c) => (
            <label key={c} style={{ display: "flex", gap: "0.3rem", alignItems: "center", fontSize: "var(--font-size-sm)", cursor: "pointer" }}>
              <input type="checkbox" checked={coresOn[c]} onChange={() => toggleCore(c)} style={{ accentColor: "var(--color-accent)" }} />
              <span style={{ color: coresOn[c] ? "var(--color-text)" : "var(--color-text-muted)" }}>{c}:</span>
              <strong style={{ color: coresOn[c] ? "var(--color-buy)" : "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                {coresOn[c] ? "SI" : "NO"}
              </strong>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>Indicadores (SI/NO)</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", marginTop: "var(--space-xs)" }}>
          {ALL_SUBCORES.map((s) => (
            <label key={s} style={{ display: "flex", gap: "0.3rem", alignItems: "center", fontSize: "var(--font-size-sm)", cursor: "pointer" }}>
              <input type="checkbox" checked={indicadoresOn[s]} onChange={() => toggleSub(s)} style={{ accentColor: "var(--color-accent)" }} />
              <span style={{ color: indicadoresOn[s] ? "var(--color-text)" : "var(--color-text-muted)" }}>{s}:</span>
              <strong style={{ color: indicadoresOn[s] ? "var(--color-buy)" : "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                {indicadoresOn[s] ? "SI" : "NO"}
              </strong>
            </label>
          ))}
        </div>
      </fieldset>

      {error && <div style={{ color: "var(--color-sell)", fontSize: "var(--font-size-sm)" }}>Error: {error}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <ExecuteSimulationButton loading={loading} onClick={run} />
      </div>

      <TermStrategyModal
        open={termModalOpen}
        estrategia={estrategia}
        params={termParams}
        onChange={setTermParams}
        onClose={() => setTermModalOpen(false)}
      />
      <CoverageParamsModal
        open={coverageModalOpen}
        estrategia={estrategia}
        ticker={ticket}
        params={coverageParams}
        onChange={setCoverageParams}
        onClose={() => setCoverageModalOpen(false)}
        onConfirm={(params) => onCoverageParamsConfirmed?.(params, estrategia)}
      />
    </section>
  );
}

export default SimulationControlPanel;
