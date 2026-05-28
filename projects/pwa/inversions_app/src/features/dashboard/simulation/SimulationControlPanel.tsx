// FIC: Phase 5 T098 — panel de simulacion del PDF v1 (rangos, estrategia, tolerancia, toggles SI/NO).

import React, { useState } from "react";
import {
  runSimulation,
  ALL_CORES,
  ALL_SUBCORES,
  type CoreId,
  type SubCoreIndicador,
  type ConfluenceSignalRow,
  type SimulationRequestPayload,
  type SimulationResponse
} from "../../../services/signals/confluenceTableApi";
import { StrategySelector } from "./StrategySelector";
import { RiskToleranceToggle } from "./RiskToleranceToggle";
import { ExecuteSimulationButton } from "./ExecuteSimulationButton";
import { EstrategiasPanel } from "./EstrategiasPanel";
import type { FromChainResponse } from "../../../services/strategies/strategyApi";

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

/**
 * Transforma un FromChainResponse (TEAM-08) en SimulationResponse
 * para que los resultados de estrategias aparezcan en la tabla de confluencia.
 */
function strategyResultToSimulationResponse(result: FromChainResponse): SimulationResponse {
  const now = new Date().toISOString();
  const strategyLabel = result.strategy_type.replace(/_/g, " ").toUpperCase();
  const riskScore = (result.risk as any)?.puntaje_riesgo ?? 50;
  const riskAcceptable = (result.risk as any)?.riesgo_aceptable ?? false;
  const maxGain = (result.summary as any)?.perfil?.ganancia_maxima ?? 0;
  const maxLoss = (result.summary as any)?.perfil?.perdida_maxima ?? 0;
  const probExito = (result.simulation as any)?.probabilidad_exito ?? 0;
  const rendimiento = (result.simulation as any)?.rendimiento_esperado ?? 0;
  const sharpe = (result.simulation as any)?.ratio_sharpe ?? 0;
  const drawdown = (result.simulation as any)?.drawdown_maximo ?? 0;
  const maxGainText = typeof maxGain === "number" ? `$${maxGain.toLocaleString()}` : String(maxGain);
  const maxLossText = typeof maxLoss === "number" ? `$${maxLoss.toLocaleString()}` : String(maxLoss);

  // Filter to only valid CoreId values
  const coreId: CoreId = "A_IA";

  const rows: ConfluenceSignalRow[] = [];

  // ── Main strategy summary row ───────────────────────────
  rows.push({
    ticket: result.ticker,
    core: coreId,
    subCore: `ESTRATEGIAS/${strategyLabel}`,
    precio: 0,
    tipoSenal: probExito > 0.5 ? "CALL" : "PUT",
    fecha: result.expiracion || now,
    timeframe: "CUSTOM",
    tendencia: "LATERAL",
    score: riskScore / 10,
    peso: result.premiums_used.length,
    invertir: riskAcceptable,
    estado: riskAcceptable ? "ACTIVA" : "DEGRADADA",
    vigencia: result.expiracion || now,
    fuente: "TEAM-08",
    evidencia_refs: [`strategy:${result.strategy_type}`, `ticker:${result.ticker}`],
    ia_revisada: true,
    disclaimer_id: "estrategias-complejas-v1",
    delta_vs_anterior: "NUEVA",      observacion: {
        objetivo: `Ganancia Máx: ${maxGainText}, Pérdida Máx: ${maxLossText}`,
        senal: `${strategyLabel} · ${result.ticker}`,
        explicacion: `Prob. Éxito: ${typeof probExito === "number" ? probExito.toFixed(1) + "%" : "—"}, Rend. Esperado: ${typeof rendimiento === "number" ? "$" + Math.round(rendimiento).toLocaleString() : "—"}`,
        metricas: {
          ganancia_max: maxGain,
          perdida_max: maxLoss,
          prob_exito: probExito,
          rendimiento: rendimiento,
          sharpe,
          drawdown,
        },
      },
      algorithm_version: "team08-v1",
    computed_at: now,
    source_input_hash: `estrategias-${result.ticker}-${result.strategy_type}-${now}`,
  });

  // ── One row per leg with option details ─────────────────
  result.premiums_used.forEach((prem, i) => {
    rows.push({
      ticket: result.ticker,
      core: coreId,
      subCore: `${strategyLabel}/LEG${i + 1}`,
      precio: prem.strike,
      tipoSenal: prem.tipo === "call" ? "CALL" : "PUT",
      fecha: result.expiracion || now,
      timeframe: "CUSTOM",
      tendencia: "LATERAL",
      score: prem.prima,
      peso: 1,
      invertir: riskAcceptable,
      estado: riskAcceptable ? "ACTIVA" : "DEGRADADA",
      vigencia: result.expiracion || now,
      fuente: "ALPACA",
      evidencia_refs: [`premium:${prem.prima}`, `strike:${prem.strike}`],
      ia_revisada: false,
      delta_vs_anterior: "NUEVA",
      observacion: {
        objetivo: `Prima: $${prem.prima.toFixed(2)}`,
        senal: `${prem.posicion.toUpperCase()} ${prem.tipo.toUpperCase()} @ $${prem.strike}`,
        explicacion: `Leg ${i + 1} de ${strategyLabel} — ${riskAcceptable ? "Aceptable" : "Evaluación de riesgo desfavorable"}`,
        metricas: {
          prima: prem.prima,
          bid: prem.bid ?? 0,
          ask: prem.ask ?? 0,
        },
      },
      algorithm_version: "team08-v1",
      computed_at: now,
      source_input_hash: `leg-${result.ticker}-${i}-${now}`,
    });
  });

  return {
    verdict: {
      verdict: riskAcceptable ? "ESTRATEGIA_ACEPTABLE" : "ESTRATEGIA_RECHAZADA",
      score: riskScore,
      strategy: result.strategy_type,
      ticker: result.ticker,
    },
    table: rows,
    inputs_echo: {} as SimulationRequestPayload,
    computed_at: now,
    algorithm_version: "team08-v1",
  };
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
  const [estrategiasActivo, setEstrategiasActivo] = useState(false);
  const [estrategiasResult, setEstrategiasResult] = useState<FromChainResponse | null>(null);

  const toggleCore = (c: CoreId) => setCoresOn((prev) => ({ ...prev, [c]: !prev[c] }));
  const toggleSub = (s: SubCoreIndicador) => setIndicadoresOn((prev) => ({ ...prev, [s]: !prev[s] }));

  const handleEstrategiasToggle = () => {
    setEstrategiasActivo((prev) => !prev);
  };

  const handleEstrategiasResult = (result: FromChainResponse) => {
    setEstrategiasResult(result);
    // Transform Team 8 strategy result into confluence table rows
    const transformed = strategyResultToSimulationResponse(result);
    onResult(transformed);
  };

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
          <label style={{ display: "flex", gap: "0.3rem", alignItems: "center", fontSize: "0.8rem" }}>
            <input
              type="checkbox"
              checked={estrategiasActivo}
              onChange={handleEstrategiasToggle}
            />
            <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>ESTRATEGIAS</span>: <strong>{estrategiasActivo ? "SI" : "NO"}</strong>
            {estrategiasResult && (
              <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginLeft: "0.25rem" }}>
                · {estrategiasResult.strategy_type.replace(/_/g, " ").toUpperCase()} · {estrategiasResult.ticker}
              </span>
            )}
          </label>
        </div>
      </fieldset>

      {/* ── Estrategias Panel inline ────────────────── */}
      {estrategiasActivo && (
        <EstrategiasPanel
          defaultTicker={ticket}
          onStrategyResult={handleEstrategiasResult}
        />
      )}

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
