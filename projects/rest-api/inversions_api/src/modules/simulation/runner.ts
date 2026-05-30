// FIC: Simulation runner Phase 5 — pipeline puro SimulationRequest -> { verdict, table, inputs_echo } (Kevin, TEAM-02).
// FIC: Phase 5 simulation runner — pure pipeline (FR-015, US6). Idempotent, hash-stable.

import { computeConfluence } from "../indicators/confluence";
import { buildIndicatorsTable } from "../indicators/confluenceTable";
import { buildCoreStubs } from "../indicators/coreStubs";
import { getCandles, intervalMs, isSupportedTimeframe } from "../indicators/ohlcSource";
import {
  ALGORITHM_VERSION,
  ALL_CORE_IDS,
  ALL_SUBCORES_INDICADOR,
  type ConfluenceSignalRow,
  type ConfluenceVerdict,
  type CoreId,
  type OhlcBar,
  type SimulationRequest,
  type SubCoreIndicador,
  type Timeframe
} from "../indicators/types";
import { buildInstitutionalRows } from "../institutional/institutionalRowBuilder";
import { buildTechnicalTable } from "../indicators/technicalTable";
import type { InstitutionalRouteContext } from "../../routes/institutional/bootstrap";
import type { InstitutionalAnalysisContract } from "../institutional/institutionalContract";
import { runAiCore } from "./aiCoreRunner";

export interface SimulationRunResult {
  verdict: ConfluenceVerdict;
  table: ConfluenceSignalRow[];
  inputs_echo: SimulationRequest;
  computed_at: string;
  algorithm_version: string;
}

export interface SimulationValidationError {
  error_code: string;
  message: string;
  hint?: string;
  field?: string;
}

export const KNOWN_ESTRATEGIAS = new Set<string>([
  "IRON_CONDOR",
  "BULL_CALL_SPREAD",
  "BEAR_PUT_SPREAD",
  "BUY_CALL",
  "BUY_PUT",
  "SELL_CALL",
  "SELL_PUT",
  "STRADDLE",
  "STRANGLE",
  "BUTTERFLY",
  "COVERED_CALL",
  "CALENDAR_SPREAD",
  "DIAGONAL_SPREAD",
  "WHEEL",
]);

const RANGO_HISTORICO_DAYS: Record<string, number> = {
  "2A": 730,
  "1A": 365,
  "6M": 180,
  "3M": 90,
  "1M": 30
};

function isPresetRange(value: unknown): value is "2A" | "1A" | "6M" | "3M" | "1M" {
  return typeof value === "string" && value in RANGO_HISTORICO_DAYS;
}

function isObjectRange(value: unknown): value is { from: string; to: string } {
  return !!value && typeof value === "object" && "from" in (value as any) && "to" in (value as any);
}

export function validateSimulationRequest(body: any): SimulationValidationError | null {
  if (!body || typeof body !== "object") {
    return { error_code: "INVALID_SIMULATION_REQUEST", message: "Cuerpo invalido o ausente.", field: "body" };
  }
  if (!body.ticket || typeof body.ticket !== "string") {
    return { error_code: "INVALID_SIMULATION_REQUEST", message: "'ticket' es obligatorio.", field: "ticket" };
  }
  if (!isPresetRange(body.rangoHistorico) && !isObjectRange(body.rangoHistorico)) {
    return {
      error_code: "INVALID_SIMULATION_REQUEST",
      message: "'rangoHistorico' debe ser preset (2A|1A|6M|3M|1M) o {from,to}.",
      field: "rangoHistorico"
    };
  }
  if (!isObjectRange(body.rangoEstrategia)) {
    return { error_code: "INVALID_SIMULATION_REQUEST", message: "'rangoEstrategia' debe ser {from,to}.", field: "rangoEstrategia" };
  }
  const from = Date.parse(body.rangoEstrategia.from);
  const to = Date.parse(body.rangoEstrategia.to);
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return { error_code: "INVALID_SIMULATION_REQUEST", message: "Fechas invalidas en 'rangoEstrategia'.", field: "rangoEstrategia" };
  }
  if (from > to) {
    return { error_code: "INVALID_RANGE", message: "'rangoEstrategia.from' es posterior a 'to'.", field: "rangoEstrategia" };
  }
  if (!isSupportedTimeframe(body.temporalidad)) {
    return {
      error_code: "INVALID_SIMULATION_REQUEST",
      message: `'temporalidad' '${body.temporalidad}' no soportada.`,
      hint: "Valores validos: 1m, 5m, 15m, 1h, 4h, 1d",
      field: "temporalidad"
    };
  }
  if (body.runtimeMode !== "ONLINE" && body.runtimeMode !== "OFFLINE") {
    return { error_code: "INVALID_SIMULATION_REQUEST", message: "'runtimeMode' debe ser ONLINE u OFFLINE.", field: "runtimeMode" };
  }
  if (!Array.isArray(body.coresHabilitados) || body.coresHabilitados.length === 0) {
    return { error_code: "INVALID_SIMULATION_REQUEST", message: "'coresHabilitados' debe ser un array no vacio.", field: "coresHabilitados" };
  }
  for (const c of body.coresHabilitados) {
    if (!ALL_CORE_IDS.includes(c)) {
      return { error_code: "INVALID_SIMULATION_REQUEST", message: `core invalido: ${c}`, field: "coresHabilitados" };
    }
  }
  if (!Array.isArray(body.indicadoresHabilitados)) {
    return { error_code: "INVALID_SIMULATION_REQUEST", message: "'indicadoresHabilitados' debe ser un array.", field: "indicadoresHabilitados" };
  }
  for (const i of body.indicadoresHabilitados) {
    if (!ALL_SUBCORES_INDICADOR.includes(i)) {
      return { error_code: "INVALID_SIMULATION_REQUEST", message: `indicador invalido: ${i}`, field: "indicadoresHabilitados" };
    }
  }
  if (typeof body.estrategia !== "string" || !KNOWN_ESTRATEGIAS.has(body.estrategia)) {
    return {
      error_code: "INVALID_SIMULATION_REQUEST",
      message: `'estrategia' '${body.estrategia}' fuera del catalogo canonico.`,
      hint: `Valores validos: ${Array.from(KNOWN_ESTRATEGIAS).join(", ")}`,
      field: "estrategia"
    };
  }
  if (body.toleranciaRiesgo !== "BAJO" && body.toleranciaRiesgo !== "MEDIO" && body.toleranciaRiesgo !== "ALTO") {
    return { error_code: "INVALID_SIMULATION_REQUEST", message: "'toleranciaRiesgo' debe ser BAJO|MEDIO|ALTO.", field: "toleranciaRiesgo" };
  }
  return null;
}

function candleCountFor(request: SimulationRequest): number {
  const tfMs = intervalMs(request.temporalidad);
  let totalMs: number;
  if (isPresetRange(request.rangoHistorico)) {
    totalMs = RANGO_HISTORICO_DAYS[request.rangoHistorico] * 86_400_000;
  } else {
    const r = request.rangoHistorico as { from: string; to: string };
    totalMs = Math.max(Date.parse(r.to) - Date.parse(r.from), tfMs * 50);
  }
  const count = Math.ceil(totalMs / tfMs);
  return Math.max(60, Math.min(1000, count));
}

export interface RunSimulationDeps {
  /**
   * FIC: Inyectable para test/runtime (default usa getCandles async con Yahoo Finance). (EN)
   */
  fetchCandles?: (input: { symbol: string; timeframe: Timeframe; count: number }) => OhlcBar[] | Promise<OhlcBar[]>;
  now?: Date;
  previousRows?: ConfluenceSignalRow[];
  /** FIC: Institutional engines context — injected by the route handler when A_INSTITUCIONAL is enabled. */
  institutionalContext?: Omit<InstitutionalRouteContext, "dataService"> & {
    buildContract: (ticker: string) => InstitutionalAnalysisContract;
  };
}

/**
 * FIC: Orquesta la simulacion: candles -> indicadores filtrados -> tabla -> stubs -> verdict derivado.
 * FIC: Idempotente: misma request + mismas candles -> misma respuesta (hash estable).
 * FIC: Async desde TEAM-05: cuando A_INSTITUCIONAL está habilitado llama los engines reales en paralelo.
 */
export async function runSimulation(
  request: SimulationRequest,
  deps: RunSimulationDeps = {}
): Promise<SimulationRunResult> {
  const fetcher = deps.fetchCandles ?? getCandles;
  const count = candleCountFor(request);
  const candles = await Promise.resolve(fetcher({ symbol: request.ticket, timeframe: request.temporalidad, count }));
  const computedAt = deps.now ?? new Date();

  const enabledCores = new Set<CoreId>(request.coresHabilitados);
  const enabledSubs: SubCoreIndicador[] =
    request.indicadoresHabilitados.length > 0
      ? request.indicadoresHabilitados
      : (ALL_SUBCORES_INDICADOR as readonly SubCoreIndicador[]).slice();

  const verdict = computeConfluence(candles, {
    symbol: request.ticket,
    timeframe: request.temporalidad
  });

  let table: ConfluenceSignalRow[] = [];
  if (enabledCores.has("A_INDICADORES")) {
    table = buildIndicatorsTable({
      ticket: request.ticket,
      timeframe: request.temporalidad,
      candles,
      enabledSubCores: enabledSubs,
      previousRows: deps.previousRows,
      now: computedAt
    });
  }

  // FIC: A_INSTITUCIONAL — run engines with synthetic fallbacks; skip dataService.resolve() to avoid
  // FIC: blocking on external HTTP sources (SEC EDGAR, FINRA, Yahoo) that are unreliable in sim context.
  let institutionalRows: ConfluenceSignalRow[] = [];
  if (enabledCores.has("A_INSTITUCIONAL") && deps.institutionalContext) {
    const { zonesEngine, trendEngine, expirationEngine, buildContract } = deps.institutionalContext;
    try {
      const contract = buildContract(request.ticket);
      // FIC: Pass undefined preResolvedResult — all 3 engines have deterministic synthetic fallbacks. (EN)
      const [zonesSettled, trendSettled, expirationSettled] = await Promise.allSettled([
        zonesEngine.analyze(contract, undefined),
        trendEngine.analyze(contract, undefined),
        expirationEngine.analyze(contract, undefined),
      ]);
      institutionalRows = buildInstitutionalRows({
        ticket: request.ticket,
        timeframe: request.temporalidad,
        sourceInputHash: verdict.source_input_hash,
        now: computedAt,
        zones:      zonesSettled.status      === "fulfilled" ? zonesSettled.value      : null,
        trend:      trendSettled.status      === "fulfilled" ? trendSettled.value      : null,
        expiration: expirationSettled.status === "fulfilled" ? expirationSettled.value : null,
      });
    } catch (err) {
      console.error("[A_INSTITUCIONAL] engine error — falling back to stub:", err);
    }
  }

  // FIC: A_TECNICO real rows — uses candles already in scope, no extra fetch. (EN)
  // FIC: Filas reales A_TECNICO — usa candles ya en scope, sin fetch extra. (ES)
  const tecnicoRows = enabledCores.has("A_TECNICO")
    ? buildTechnicalTable({
        ticket:          request.ticket,
        timeframe:       request.temporalidad,
        candles,
        sourceInputHash: verdict.source_input_hash,
        previousRows:    deps.previousRows,
        now:             computedAt,
      })
    : [];

  // FIC: Execute AI Core if enabled
  let aiRow: ConfluenceSignalRow | null = null;
  if (enabledCores.has("A_IA")) {
    aiRow = await runAiCore({
      ticket: request.ticket,
      timeframe: request.temporalidad,
      sourceInputHash: verdict.source_input_hash,
      computedAt: computedAt,
      previousRows: deps.previousRows,
      precalculatedRows: [...table, ...institutionalRows, ...tecnicoRows],
    });
  }

  // FIC: Stub remaining cores — skip A_INSTITUCIONAL/A_TECNICO/A_IA if real rows were built. (EN)
  // FIC: Stub de cores restantes — omite A_INSTITUCIONAL/A_TECNICO/A_IA si hay filas reales. (ES)
  const stubCores = (ALL_CORE_IDS as readonly CoreId[])
    .filter((c) => {
      if (c === "A_INDICADORES") return false;
      if (c === "A_INSTITUCIONAL" && institutionalRows.length > 0) return false;
      if (c === "A_TECNICO" && tecnicoRows.length > 0) return false;
      if (c === "A_IA" && aiRow !== null) return false;
      return enabledCores.has(c);
    });

  if (stubCores.length > 0) {
    const stubs = buildCoreStubs({
      ticket: request.ticket,
      timeframe: request.temporalidad,
      cores: stubCores,
      sourceInputHash: verdict.source_input_hash,
      previousRows: deps.previousRows,
      now: computedAt
    });
    table = [...table, ...institutionalRows, ...tecnicoRows, ...stubs];
  } else {
    table = [...table, ...institutionalRows, ...tecnicoRows];
  }

  if (aiRow) {
    table.push(aiRow);
  }

  const disabled = (ALL_CORE_IDS as readonly CoreId[]).filter((c) => !enabledCores.has(c));
  const degradedVerdict: ConfluenceVerdict = {
    ...verdict,
    degraded: verdict.degraded || disabled.length > 0,
    missing: Array.from(new Set([...verdict.missing, ...disabled.map((c) => `core:${c}`)]))
  };

  return {
    verdict: degradedVerdict,
    table,
    inputs_echo: request,
    computed_at: computedAt.toISOString(),
    algorithm_version: ALGORITHM_VERSION,
  };
}
