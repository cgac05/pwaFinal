// FIC: Phase 5 T098 — panel de simulacion del PDF v1 (rangos, estrategia, tolerancia, toggles SI/NO).

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

interface Props {
  ticket: string;
  onResult: (result: SimulationResponse) => void;
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

export function SimulationControlPanel({ ticket, onResult }: Props) {
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

  const toggleCore = (c: CoreId) => setCoresOn((prev) => ({ ...prev, [c]: !prev[c] }));
  const toggleSub = (s: SubCoreIndicador) => setIndicadoresOn((prev) => ({ ...prev, [s]: !prev[s] }));

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

  return (
    <section className="card" style={{ display: "grid", gap: "0.75rem" }}>
      <h2 style={{ margin: 0 }}>Panel de Control · Simulacion</h2>

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

      {error && <div style={{ color: "var(--color-sell, #f85149)", fontSize: "0.8rem" }}>Error: {error}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <ExecuteSimulationButton loading={loading} onClick={run} />
      </div>
    </section>
  );
}

export default SimulationControlPanel;
