// FIC: Simulation runner Phase 5 — pipeline puro SimulationRequest -> { verdict, table, inputs_echo } (Kevin, TEAM-02).
// FIC: Phase 5 simulation runner — pure pipeline (FR-015, US6). Idempotent, hash-stable.

import { computeConfluence } from "../indicators/confluence";
import { buildIndicatorsTable } from "../indicators/confluenceTable";
import { buildCoreStubs } from "../indicators/coreStubs";
import { getCandles, intervalMs, isSupportedTimeframe } from "../indicators/ohlcSource";
import { buildNewsConfluenceRows } from "../news/newsConfluenceRows";
import {
  ALGORITHM_VERSION,
  ALL_CORE_IDS,
  ALL_SUBCORES_INDICADOR,
  type ConfluenceSignalRow,
  type ConfluenceVerdict,
  type CoreId,
  type OhlcBar,
  type SignalMetrics,
  type SimulationRequest,
  type SubCoreIndicador,
  type Timeframe,
  type TipoSenal
} from "../indicators/types";
import { buildInstitutionalRows } from "../institutional/institutionalRowBuilder";
import { buildTechnicalTable } from "../indicators/technicalTable";
import { buildStrategyViabilityTable } from "../indicators/strategyConfluenceRows";
import type { InstitutionalRouteContext } from "../../routes/institutional/bootstrap";
import type { InstitutionalAnalysisContract } from "../institutional/institutionalContract";
import { runAiCore } from "./aiCoreRunner";
import { analyzeFundamental } from "../fundamental/fundamentalAnalyzer";

export interface SimulationRunResult {
  verdict: ConfluenceVerdict;
  table: ConfluenceSignalRow[];
  inputs_echo: SimulationRequest;
  computed_at: string;
  algorithm_version: string;
  // FIC: Aggregated buy/sell/hold counters over the returned table (US5). (EN)
  // FIC: Conteo agregado compra/venta/hold sobre la tabla devuelta (US5). (ES)
  signalMetrics: SignalMetrics;
}

export interface SimulationValidationError {
  error_code: string;
  message: string;
  hint?: string;
  field?: string;
}

export const KNOWN_ESTRATEGIAS = new Set<string>([
  "IRON_CONDOR",
  "IRON_BUTTERFLY",
  "BUTTERFLY_SPREAD",
  "CONDOR",
  "BULL_CALL_SPREAD",
  "BEAR_PUT_SPREAD",
  "BULL_PUT_SPREAD",
  "BEAR_CALL_SPREAD",
  "LONG_CALL",
  "LONG_PUT",
  "SHORT_CALL",
  "SHORT_PUT",
  "BUY_CALL",
  "BUY_PUT",
  "SELL_CALL",
  "SELL_PUT",
  "STRADDLE",
  "STRANGLE",
  "BUTTERFLY",
  "COVERED_CALL",
  "PROTECTIVE_PUT",
  "MARRIED_PUT",
  "COLLAR_PUT",
  "COVERED_STRADDLE",
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
  if (body.strategyRows !== undefined && !Array.isArray(body.strategyRows)) {
    return { error_code: "INVALID_SIMULATION_REQUEST", message: "'strategyRows' debe ser un array cuando se envía.", field: "strategyRows" };
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
  // FIC: fechaHistorica is optional; when present it must be a parseable date not in the future. (EN)
  // FIC: fechaHistorica es opcional; si viene debe ser fecha valida y no futura. (ES)
  if (body.fechaHistorica !== undefined && body.fechaHistorica !== "" && body.fechaHistorica !== null) {
    const asOf = Date.parse(body.fechaHistorica);
    if (!Number.isFinite(asOf)) {
      return { error_code: "INVALID_SIMULATION_REQUEST", message: "'fechaHistorica' no es una fecha valida.", field: "fechaHistorica" };
    }
    if (asOf > Date.now()) {
      return { error_code: "INVALID_RANGE", message: "'fechaHistorica' no puede ser futura.", field: "fechaHistorica" };
    }
  }
  return null;
}

// FIC: End-of-day epoch (ms, UTC) for an as-of date, so the snapshot includes that whole day. (EN)
// FIC: Fin de dia (ms, UTC) de la fecha as-of, para que el snapshot incluya el dia completo. (ES)
function endOfDayMs(isoDate: string): number {
  return Date.parse(isoDate.length <= 10 ? `${isoDate}T23:59:59.999Z` : isoDate);
}

// FIC: US7 — keep only A_INDICADORES subCore rows whose tipoSenal coincides with at least one
// FIC: other indicator. The aggregate A_INDICADORES row (no subCore) and all other cores are kept.
// FIC: With <2 indicator rows there is nothing to compare, so all rows pass through unchanged.
// FIC: US7 — conserva solo las filas subCore de A_INDICADORES cuya tipoSenal coincide con al menos
// FIC: otro indicador. La fila agregada (sin subCore) y los demas cores se conservan. Con <2 filas
// FIC: de indicador no hay con que comparar, asi que todas pasan sin cambios.
function applyCoincidenceFilter(rows: ConfluenceSignalRow[]): ConfluenceSignalRow[] {
  const indicatorRows = rows.filter((r) => r.core === "A_INDICADORES" && !!r.subCore);
  if (indicatorRows.length < 2) return rows;

  const counts = new Map<TipoSenal, number>();
  for (const r of indicatorRows) counts.set(r.tipoSenal, (counts.get(r.tipoSenal) ?? 0) + 1);

  return rows.filter((r) => {
    if (r.core !== "A_INDICADORES" || !r.subCore) return true; // aggregate + other cores
    return (counts.get(r.tipoSenal) ?? 0) >= 2; // indicator row: must coincide with >=1 peer
  });
}

// FIC: US5 — count buy (CALL) / sell (PUT) / hold rows over the final table. (EN)
// FIC: US5 — cuenta filas compra (CALL) / venta (PUT) / hold sobre la tabla final. (ES)
function computeSignalMetrics(rows: ConfluenceSignalRow[]): SignalMetrics {
  let buy = 0, sell = 0, hold = 0;
  for (const r of rows) {
    if (r.tipoSenal === "CALL") buy++;
    else if (r.tipoSenal === "PUT") sell++;
    else hold++;
  }
  return { buy, sell, hold, total: rows.length };
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
  fetchCandles?: (input: { symbol: string; timeframe: Timeframe; count: number; endTimeMs?: number }) => OhlcBar[] | Promise<OhlcBar[]>;
  now?: Date;
  previousRows?: ConfluenceSignalRow[];
  /** FIC: Institutional engines context — injected by the route handler when A_INSTITUCIONAL is enabled. */
  institutionalContext?: Omit<InstitutionalRouteContext, "dataService"> & {
    buildContract: (ticker: string) => InstitutionalAnalysisContract;
  };
  /** FIC: Fundamental context — injected to fetch real fundamental data */
  fundamentalContext?: {
    fetchData: (ticker: string) => Promise<any>;
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
  // FIC: US8 — when fechaHistorica is set, fetch/truncate candles up to that day's end so every
  // FIC: downstream core computes the signal AS IF it were that past date. (EN)
  const endTimeMs = request.fechaHistorica ? endOfDayMs(request.fechaHistorica) : undefined;
  const fetched = await Promise.resolve(
    fetcher({ symbol: request.ticket, timeframe: request.temporalidad, count, endTimeMs })
  );
  // FIC: Defensive truncation in case the injected fetcher ignores endTimeMs. (EN)
  const candles = endTimeMs
    ? fetched.filter((c) => c.time * 1000 <= endTimeMs)
    : fetched;
  const computedAt = deps.now ?? new Date();

  const enabledCores = new Set<CoreId>(request.coresHabilitados);
  // FIC: No "all indicators" fallback. If A_INDICADORES is enabled but the user selected NO
  // FIC: individual indicator, the core emits ZERO rows — the confluence table shows nothing for
  // FIC: indicators. Other enabled cores still emit their own rows (multicore rule). (EN)
  // FIC: Sin fallback a "todos los indicadores". Si A_INDICADORES esta activo pero el usuario no
  // FIC: selecciono ningun indicador individual, el core no emite filas — la tabla no muestra nada
  // FIC: de indicadores. Los demas cores activos siguen emitiendo sus filas (regla multicore). (ES)
  const enabledSubs: SubCoreIndicador[] = request.indicadoresHabilitados ?? [];

  const verdict = computeConfluence(candles, {
    symbol: request.ticket,
    timeframe: request.temporalidad
  });
  const strategyRows = Array.isArray(request.strategyRows) ? request.strategyRows : [];

  let table: ConfluenceSignalRow[] = [];
  if (enabledCores.has("A_INDICADORES") && enabledSubs.length > 0) {
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
      const lastClose = candles[candles.length - 1]?.close ?? candles[candles.length - 1]?.open ?? 0;
      const candlesSimple = candles.map((c) => ({ close: c.close, volume: c.volume }));
      const candlesOhlcv = candles.map((c) => ({ open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
      const [zonesSettled, trendSettled, expirationSettled] = await Promise.allSettled([
        zonesEngine.analyze(contract, undefined, candlesOhlcv),
        trendEngine.analyze(contract, undefined, candlesSimple),
        expirationEngine.analyze(contract, undefined, candlesSimple, lastClose),
      ]);
      institutionalRows = buildInstitutionalRows({
        ticket: request.ticket,
        timeframe: request.temporalidad,
        sourceInputHash: verdict.source_input_hash,
        now: computedAt,
        zones:      zonesSettled.status      === "fulfilled" ? zonesSettled.value      : null,
        trend:      trendSettled.status      === "fulfilled" ? trendSettled.value      : null,
        expiration: expirationSettled.status === "fulfilled" ? expirationSettled.value : null,
        estrategia: request.estrategia,
        precioActual: lastClose,
      });
    } catch (err) {
      console.error("[A_INSTITUCIONAL] engine error — falling back to stub:", err);
    }
  }

  let fundamentalRows: ConfluenceSignalRow[] = [];
  if (enabledCores.has("A_FUNDAMENTAL") && deps.fundamentalContext) {
    try {
      const dataResult = await deps.fundamentalContext.fetchData(request.ticket);
      if (dataResult && dataResult.success && dataResult.data) {
        const opts = {
          ticker: request.ticket,
          investmentProfile: "Value",
          horizon: "Largo plazo",
          selectedMetrics: ["Valoración", "Crecimiento", "Rentabilidad", "Salud Financiera", "Flujo de Caja", "Riesgo", "Ventaja Competitiva"],
          strategy: request.estrategia,
          comparisons: [],
          projectionFrom: request.fechaHistorica
        };
        const analysis = await analyzeFundamental(dataResult.data, opts);
        fundamentalRows = analysis.confluenceRows as unknown as ConfluenceSignalRow[];
      }
    } catch (err) {
      console.error("[A_FUNDAMENTAL] engine error — falling back to stub:", err);
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

  const noticiasRows = enabledCores.has("A_NOTICIAS")
    ? await buildNewsConfluenceRows({
        ticket: request.ticket,
        timeframe: request.temporalidad,
        precio: candles[candles.length - 1]?.close ?? candles[candles.length - 1]?.open ?? 0,
        sourceInputHash: verdict.source_input_hash,
        previousRows: deps.previousRows,
        now: computedAt,
        limit: 100,
        from: request.rangoEstrategia.from,
        to: request.rangoEstrategia.to,
      })
    : [];

  // FIC: A_ESTRATEGIA core — evaluates which complex strategies are viable. (EN)
  // FIC: Core A_ESTRATEGIA — evalúa qué estrategias complejas son viables. (ES)
  const estrategiaRows = enabledCores.has("A_ESTRATEGIA")
    ? buildStrategyViabilityTable({
        ticket: request.ticket,
        timeframe: request.temporalidad,
        candles,
        sourceInputHash: verdict.source_input_hash,
        previousRows: deps.previousRows,
        now: computedAt,
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
      precalculatedRows: [...table, ...fundamentalRows, ...institutionalRows, ...tecnicoRows, ...noticiasRows, ...strategyRows, ...estrategiaRows],
      estrategia: request.estrategia,
      toleranciaRiesgo: request.toleranciaRiesgo,
      rangoEstrategia: request.rangoEstrategia,
      fechaHistorica: request.fechaHistorica,
    });
  }

  // FIC: Stub remaining cores — skip A_INSTITUCIONAL/A_TECNICO/A_NOTICIAS/A_IA/A_ESTRATEGIA if real rows were built. (EN)
  const stubCores = (ALL_CORE_IDS as readonly CoreId[])
    .filter((c) => {
      if (c === "A_INDICADORES") return false;
      if (c === "A_INSTITUCIONAL" && institutionalRows.length > 0) return false;
      if (c === "A_FUNDAMENTAL" && fundamentalRows.length > 0) return false;
      if (c === "A_TECNICO" && tecnicoRows.length > 0) return false;
      if (c === "A_IA" && aiRow !== null) return false;
      if (c === "A_NOTICIAS" && noticiasRows.length > 0) return false;
      if (c === "A_ESTRATEGIA" && estrategiaRows.length > 0) return false;
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
    table = [...table, ...fundamentalRows, ...institutionalRows, ...tecnicoRows, ...noticiasRows, ...strategyRows, ...estrategiaRows, ...stubs];
  } else {
    table = [...table, ...fundamentalRows, ...institutionalRows, ...tecnicoRows, ...noticiasRows, ...strategyRows, ...estrategiaRows];
  }

  // FIC: US8 bugfix — when running on historical (as-of) data, the rows MUST display the REAL date
  // FIC: of the data point, not today's date. Stamp every row's `fecha` with the last candle's day.
  // FIC: `computed_at` keeps the real computation timestamp; only `fecha` (the data date) changes.
  // FIC: US8 fix — al correr sobre datos historicos, las filas DEBEN mostrar la fecha real del dato,
  // FIC: no la de hoy. Sella el `fecha` de cada fila con el dia de la ultima vela usada. (ES)
  if (endTimeMs && candles.length > 0) {
    const dataDate = new Date(candles[candles.length - 1].time * 1000).toISOString().slice(0, 10);
    table = table.map((r) => ({ ...r, fecha: dataDate }));
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

  // FIC: US7 — apply the multi-indicator coincidence filter unless explicitly disabled. (EN)
  // FIC: US7 — aplica el filtro de coincidencias multi-indicador salvo que se desactive. (ES)
  const finalTable = request.soloCoincidencias === false ? table : applyCoincidenceFilter(table);

  return {
    verdict: degradedVerdict,
    table: finalTable,
    inputs_echo: request,
    computed_at: computedAt.toISOString(),
    algorithm_version: ALGORITHM_VERSION,
    signalMetrics: computeSignalMetrics(finalTable),
  };
}
