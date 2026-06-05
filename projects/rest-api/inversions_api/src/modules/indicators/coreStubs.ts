// FIC: Stubs Phase 5 — filas DEGRADADA para cores aun no implementados (Mauricio, TEAM-02).
// FIC: Phase 5 stubs — emits DEGRADADA rows for cores not yet implemented (FR-016).
//
// FIC: Mantener stubs en lugar de omitir los cores preserva el contrato visual del PDF v1
// FIC: y permite al PWA renderizar 1:1 desde el dia 1. Cuando llegue el feature dedicado
// FIC: para un core, basta con borrar su stub aqui.

import {
  ALGORITHM_VERSION,
  IA_DISCLAIMER_ID,
  type ConfluenceSignalRow,
  type CoreId,
  type DeltaPrev,
  type SignalObservation,
  type Timeframe
} from "./types";

export interface CoreStubInput {
  ticket: string;
  timeframe: Timeframe;
  /**
   * FIC: Cores cuyo stub se debe emitir. Si se omite, se emiten los 5 cores no implementados.
   */
  cores?: CoreId[];
  /**
   * FIC: Hash de la corrida (compartido con la fila agregada) para mantener idempotencia.
   */
  sourceInputHash: string;
  /**
   * FIC: Filas previas para calcular `delta_vs_anterior` (defaults a NUEVA si no se proveen).
   */
  previousRows?: ConfluenceSignalRow[];
  /**
   * FIC: Override de la fecha de calculo (testing).
   */
  now?: Date;
}

const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400
};

// FIC: Cores que ESTE feature stubea — A_INDICADORES queda fuera (lo cubre confluenceTable.ts).
// FIC: A_IA aparece aqui solo cuando el LLM no respondio; el caller decide cuando llamarlo.
// FIC: A_TECNICO removed — now served by buildTechnicalTable() in technicalTable.ts. (EN)
// FIC: A_TECNICO removido — ahora servido por buildTechnicalTable() en technicalTable.ts. (ES)
const DEFAULT_STUB_CORES: CoreId[] = [
  "A_FUNDAMENTAL",
  "A_INSTITUCIONAL",
  "A_NOTICIAS"
];

function vigenciaIso(now: Date, timeframe: Timeframe): string {
  const seconds = TIMEFRAME_SECONDS[timeframe] * 5;
  return new Date(now.getTime() + seconds * 1000).toISOString();
}

function deltaVsAnterior(
  rows: ConfluenceSignalRow[] | undefined,
  core: CoreId
): DeltaPrev {
  const prev = rows?.find((r) => r.core === core && !r.subCore);
  if (!prev) return "NUEVA";
  // FIC: Stub siempre degrada vs cualquier valor anterior salvo que el anterior tambien fuera DEGRADADA.
  return prev.estado === "DEGRADADA" ? "CONFIRMADA" : "DEGRADADA";
}

function observationFor(core: CoreId): SignalObservation {
  const objetivosPorCore: Record<CoreId, string> = {
    A_INDICADORES: "Evaluar indicadores tecnicos sobre la serie OHLC.",
    A_FUNDAMENTAL: "Evaluar fundamentales (P/E, margenes, cash, dividendos) del emisor.",
    A_TECNICO: "Identificar soportes, resistencias y tendencias estructurales.",
    A_INSTITUCIONAL: "Detectar acumulacion institucional (13F, dark pools, UOA).",
    A_NOTICIAS: "Medir sentimiento de noticias en tiempo real.",
    A_ESTRATEGIA: "Evaluar viabilidad de estrategias complejas segun condiciones de mercado.",
    A_NOTICIAS_2: "006-noticias-2: análisis de sentimiento con fuentes financieras independientes (Yahoo RSS + fallback contextual).",
    A_IA: "Sintetizar la senal global con LLM y producir disclaimer no operativo."
  };
  return {
    objetivo: objetivosPorCore[core],
    senal: "Core no implementado en este feature — fila DEGRADADA.",
    explicacion:
      "El core sera servido por un feature dedicado. Mientras tanto, se emite una fila DEGRADADA con score=0/peso=0 para no romper el contrato visual del PDF v1.",
    metricas: {}
  };
}

function buildStubRow(
  input: CoreStubInput,
  core: CoreId,
  computedAt: Date
): ConfluenceSignalRow {
  const isIa = core === "A_IA";
  return {
    ticket: input.ticket,
    core,
    precio: 0,
    tipoSenal: "HOLD",
    fecha: computedAt.toISOString().slice(0, 10),
    timeframe: input.timeframe,
    tendencia: "LATERAL",
    score: 0,
    peso: 0,
    invertir: false,
    estado: "DEGRADADA",
    vigencia: vigenciaIso(computedAt, input.timeframe),
    fuente: "stub-core-pendiente",
    evidencia_refs: [],
    // FIC: FR-019 / SC-009 — toda fila con core=A_IA exige ia_revisada=true + disclaimer_id no nulo.
    ia_revisada: isIa,
    disclaimer_id: isIa ? IA_DISCLAIMER_ID : undefined,
    delta_vs_anterior: deltaVsAnterior(input.previousRows, core),
    observacion: observationFor(core),
    algorithm_version: ALGORITHM_VERSION,
    computed_at: computedAt.toISOString(),
    source_input_hash: input.sourceInputHash
  };
}

/**
 * FIC: Emite filas DEGRADADA para cores no implementados (FR-016).
 * FIC: Emits DEGRADADA rows for cores not yet implemented.
 *
 * Default cubre A_FUNDAMENTAL, A_TECNICO, A_INSTITUCIONAL, A_NOTICIAS.
 * Para incluir A_IA degradada, pasarlo explicitamente en `cores` (cuando el LLM no respondio).
 */
export function buildCoreStubs(input: CoreStubInput): ConfluenceSignalRow[] {
  const cores = input.cores ?? DEFAULT_STUB_CORES;
  const computedAt = input.now ?? new Date();
  return cores.map((core) => buildStubRow(input, core, computedAt));
}

/**
 * FIC: Emite la fila degradada del core IA cuando el LLM externo cae o agota tokens (Edge Case spec).
 * FIC: Helper for the LLM-down edge case — produces an A_IA DEGRADADA row with disclaimer present.
 */
export function buildIaDegradedStub(
  input: Omit<CoreStubInput, "cores">,
  errorCode: "LLM_UNAVAILABLE" | "LLM_RATE_LIMITED"
): ConfluenceSignalRow {
  const computedAt = input.now ?? new Date();
  const row = buildStubRow(input, "A_IA", computedAt);
  return {
    ...row,
    observacion: {
      objetivo: row.observacion.objetivo,
      senal: `Core IA degradado (${errorCode}).`,
      explicacion: "No pudimos conectarnos con el modelo, inténtalo de nuevo.",
      metricas: { MODEL_VERSION: errorCode }
    }
  };
}
