// FIC: Adapter Phase 5 — emite ConfluenceSignalRow[] desde los 5 indicadores tecnicos (Mauricio, TEAM-02).
// FIC: Phase 5 adapter — emits ConfluenceSignalRow[] from the 5 technical indicators (FR-014, US5).
//
// FIC: Responsable de transformar el verdict consolidado en N filas por subCore (RSI/MACD/EMA/ADX/BB)
// FIC: + 1 fila agregada de core A_INDICADORES. NO emite los stubs de otros cores (eso es coreStubs.ts).

import {
  ALGORITHM_VERSION,
  type ConfluenceComponent,
  type ConfluenceSignalRow,
  type DeltaPrev,
  type EstadoSenal,
  type OhlcBar,
  type SignalObservation,
  type SubCoreIndicador,
  type Tendencia,
  type Timeframe,
  type TipoSenal
} from "./types";
import {
  computeConfluence,
  DEFAULT_PROBES,
  type IndicatorProbe,
  type ProbeMeta
} from "./confluence";

export interface ConfluenceTableInput {
  ticket: string;
  timeframe: Timeframe;
  candles: OhlcBar[];
  /**
   * FIC: Filtra los subCores a evaluar. Por defecto los 5 canonicos.
   * FIC: Filters which subCores to evaluate. Defaults to the canonical 5.
   */
  enabledSubCores?: SubCoreIndicador[];
  /**
   * FIC: Filas de la corrida anterior (mismo ticket/timeframe) para calcular `delta_vs_anterior`.
   * FIC: Previous run rows used to derive `delta_vs_anterior`. Optional: defaults to NUEVA.
   */
  previousRows?: ConfluenceSignalRow[];
  /**
   * FIC: Cuantas velas de vigencia se anaden al timeframe (default 5).
   * FIC: Number of future bars the signal is considered valid (default 5).
   */
  vigenciaBars?: number;
  /**
   * FIC: Override de la fecha de calculo (testing/idempotency).
   */
  now?: Date;
}

const SUBCORE_PROBE_NAME: Record<SubCoreIndicador, string> = {
  RSI: "rsi",
  MACD: "macd",
  EMA: "ema",
  ADX: "adx",
  BB: "bollinger"
};

const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400
};

function probesForSubCores(subCores: SubCoreIndicador[]): IndicatorProbe[] {
  const allowed = new Set(subCores.map((s) => SUBCORE_PROBE_NAME[s]));
  return DEFAULT_PROBES.filter((p) => allowed.has(p.name));
}

function tendenciaFromSignal(signal: number): Tendencia {
  if (signal > 0.15) return "ALCISTA";
  if (signal < -0.15) return "BAJISTA";
  return "LATERAL";
}

function tipoSenalFromSignal(signal: number): TipoSenal {
  if (signal > 0.2) return "CALL";
  if (signal < -0.2) return "PUT";
  return "HOLD";
}

function deltaVsAnterior(
  current: TipoSenal,
  previous: ConfluenceSignalRow | undefined,
  degraded: boolean
): DeltaPrev {
  if (degraded) return "DEGRADADA";
  if (!previous) return "NUEVA";
  if (previous.tipoSenal === current) return "CONFIRMADA";
  return "INVERTIDA";
}

function vigenciaIso(now: Date, timeframe: Timeframe, bars: number): string {
  const seconds = TIMEFRAME_SECONDS[timeframe] * bars;
  return new Date(now.getTime() + seconds * 1000).toISOString();
}

function observationFromComponent(
  component: ConfluenceComponent,
  subCore: SubCoreIndicador
): SignalObservation {
  return {
    objetivo: `Evaluar ${subCore} sobre la serie OHLC para detectar momentum/estructura.`,
    senal: component.available
      ? `Senal direccional ${component.signal.toFixed(3)} (peso nominal ${component.weight}).`
      : `${component.indicator} no disponible en esta corrida.`,
    explicacion: component.detail,
    metricas: {
      VOLATILIDAD: component.value ?? "n/a"
    }
  };
}

function observationForAggregate(
  components: ConfluenceComponent[],
  degraded: boolean,
  missing: string[]
): SignalObservation {
  const available = components.filter((c) => c.available);
  const summary =
    available.length === 0
      ? "Sin indicadores disponibles."
      : available
          .map((c) => `${c.indicator}=${c.signal.toFixed(2)}`)
          .join(", ");
  return {
    objetivo:
      "Consolidar los indicadores tecnicos disponibles en una senal unica por ticket.",
    senal: degraded
      ? `Senal degradada — faltantes: ${missing.join(", ") || "ninguno"}.`
      : `Senal consolidada de ${available.length} indicadores.`,
    explicacion: `Componentes activos: ${summary}.`,
    metricas: {}
  };
}

function findPrevious(
  rows: ConfluenceSignalRow[] | undefined,
  core: string,
  subCore?: string
): ConfluenceSignalRow | undefined {
  if (!rows) return undefined;
  return rows.find((r) => r.core === core && (subCore ? r.subCore === subCore : !r.subCore));
}

// FIC: Genera la fila por subCore (1 por indicador habilitado).
// FIC: Builds the row for a single subCore indicator.
function buildSubCoreRow(
  input: ConfluenceTableInput,
  component: ConfluenceComponent,
  subCore: SubCoreIndicador,
  sourceInputHash: string,
  computedAt: Date
): ConfluenceSignalRow {
  const lastClose = input.candles[input.candles.length - 1]?.close ?? 0;
  const degraded = !component.available;
  const tipoSenal = degraded ? "HOLD" : tipoSenalFromSignal(component.signal);
  const previous = findPrevious(input.previousRows, "A_INDICADORES", subCore);

  return {
    ticket: input.ticket,
    core: "A_INDICADORES",
    subCore,
    precio: lastClose,
    tipoSenal,
    fecha: computedAt.toISOString().slice(0, 10),
    timeframe: input.timeframe,
    tendencia: degraded ? "LATERAL" : tendenciaFromSignal(component.signal),
    score: component.signal,
    peso: component.weight,
    invertir: !degraded && tipoSenal !== "HOLD",
    estado: degraded ? ("DEGRADADA" as EstadoSenal) : "ACTIVA",
    vigencia: vigenciaIso(computedAt, input.timeframe, input.vigenciaBars ?? 5),
    fuente: "indicators-core",
    evidencia_refs: [`ohlc:${input.ticket}:${input.timeframe}:${input.candles.length}`],
    ia_revisada: false,
    delta_vs_anterior: deltaVsAnterior(tipoSenal, previous, degraded),
    observacion: observationFromComponent(component, subCore),
    algorithm_version: ALGORITHM_VERSION,
    computed_at: computedAt.toISOString(),
    source_input_hash: sourceInputHash
  };
}

// FIC: Genera la fila agregada de core A_INDICADORES (consolida los 5 subCores).
// FIC: Builds the aggregated A_INDICADORES row consolidating all subCores.
function buildAggregateRow(
  input: ConfluenceTableInput,
  score: number,
  components: ConfluenceComponent[],
  degraded: boolean,
  missing: string[],
  sourceInputHash: string,
  computedAt: Date
): ConfluenceSignalRow {
  const lastClose = input.candles[input.candles.length - 1]?.close ?? 0;
  const tipoSenal = degraded && components.every((c) => !c.available)
    ? "HOLD"
    : tipoSenalFromSignal(score);
  const previous = findPrevious(input.previousRows, "A_INDICADORES", undefined);
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);

  return {
    ticket: input.ticket,
    core: "A_INDICADORES",
    precio: lastClose,
    tipoSenal,
    fecha: computedAt.toISOString().slice(0, 10),
    timeframe: input.timeframe,
    tendencia: tendenciaFromSignal(score),
    score,
    peso: totalWeight,
    invertir: !degraded && tipoSenal !== "HOLD",
    estado: degraded ? ("DEGRADADA" as EstadoSenal) : "ACTIVA",
    vigencia: vigenciaIso(computedAt, input.timeframe, input.vigenciaBars ?? 5),
    fuente: "indicators-core",
    evidencia_refs: components
      .filter((c) => c.available)
      .map((c) => `subcore:A_INDICADORES:${c.indicator}`),
    ia_revisada: false,
    delta_vs_anterior: deltaVsAnterior(tipoSenal, previous, degraded),
    observacion: observationForAggregate(components, degraded, missing),
    algorithm_version: ALGORITHM_VERSION,
    computed_at: computedAt.toISOString(),
    source_input_hash: sourceInputHash
  };
}

/**
 * FIC: Construye la tabla canonica del core A_INDICADORES (FR-014, FR-017, US5).
 * FIC: Builds the canonical table for the A_INDICADORES core.
 *
 * Returns 1 row per enabled subCore (RSI/MACD/EMA/ADX/BB) + 1 aggregated A_INDICADORES row.
 * Idempotent: same candles + same params -> same rows (FR-008, US6.3, SC-003).
 * Never throws: a failing indicator degrades its row to DEGRADADA instead of bubbling 5xx.
 */
export function buildIndicatorsTable(input: ConfluenceTableInput): ConfluenceSignalRow[] {
  const enabled: SubCoreIndicador[] =
    input.enabledSubCores && input.enabledSubCores.length > 0
      ? input.enabledSubCores
      : ["RSI", "MACD", "EMA", "ADX", "BB"];

  const probes = probesForSubCores(enabled);
  const meta: ProbeMeta = { symbol: input.ticket, timeframe: input.timeframe };
  const verdict = computeConfluence(input.candles, meta, probes);

  const computedAt = input.now ?? new Date(verdict.computed_at);
  const probeNameToSubCore: Record<string, SubCoreIndicador> = {
    rsi: "RSI",
    macd: "MACD",
    ema: "EMA",
    adx: "ADX",
    bollinger: "BB"
  };

  const subCoreRows: ConfluenceSignalRow[] = verdict.components.map((component) => {
    const subCore = probeNameToSubCore[component.indicator];
    return buildSubCoreRow(input, component, subCore, verdict.source_input_hash, computedAt);
  });

  const aggregate = buildAggregateRow(
    input,
    verdict.score,
    verdict.components,
    verdict.degraded,
    verdict.missing,
    verdict.source_input_hash,
    computedAt
  );

  return [aggregate, ...subCoreRows];
}
