// FIC: Shared types for technical indicators module (TEAM-02 CocaDe6Lts).
// FIC: Tipos compartidos para el modulo de indicadores tecnicos (TEAM-02 CocaDe6Lts).

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export interface OhlcBar {
  time: number; // unix seconds, UTC
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorMeta {
  symbol: string;
  timeframe: Timeframe;
  indicator: string;
  params: Record<string, number | string>;
  algorithm_version: string;
  computed_at: string; // ISO UTC
  source_input_hash: string; // sha256 truncated
  bars_used: number;
}

export interface IndicatorResult<TValue, TPoint = TValue> extends IndicatorMeta {
  current_value: TValue;
  series: Array<{ time: number } & TPoint>;
  zone?: string;
}

export interface IndicatorError {
  error_code: string;
  message: string;
  hint?: string;
}

export type ConfluenceVerdictLabel = "alcista" | "neutral" | "bajista";

// FIC: Per-indicator contribution breakdown inside a consolidated confluence verdict.
// FIC: Desglose de la contribucion por indicador dentro de un veredicto de confluencia.
export interface ConfluenceComponent {
  indicator: string;
  available: boolean;
  signal: number; // directional reading in [-1, 1] before weighting
  weight: number; // nominal weight assigned to the indicator
  contribution: number; // normalized weighted contribution to the score
  value: number | null; // headline raw value for traceability
  detail: string; // Spanish human-readable explanation
}

// FIC: Consolidated confluence verdict with full traceability (US3 / FR-006 / FR-008).
// FIC: Veredicto de confluencia consolidado con trazabilidad completa (US3 / FR-006 / FR-008).
export interface ConfluenceVerdict {
  symbol: string;
  timeframe: Timeframe;
  verdict: ConfluenceVerdictLabel;
  score: number; // consolidated score in [-1, 1]
  components: ConfluenceComponent[];
  degraded: boolean;
  missing: string[]; // indicators that could not be evaluated
  inputs_used: string[]; // indicators that contributed to the score
  algorithm_version: string;
  computed_at: string; // ISO UTC
  source_input_hash: string; // sha256 truncated, identical input -> identical hash
  bars_used: number;
}

export const ALGORITHM_VERSION = "1.0.0";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 5 — Tabla canonica de confluencia de senales (PDF v1)
// Phase 5 — Confluence signals canonical table (PDF v1)
// ─────────────────────────────────────────────────────────────────────────────

// FIC: Cores soportados por la tabla canonica. Indicadores tecnicos del core actual,
// FIC: mas 5 stubs degradados hasta que existan sus features dedicados (FR-016).
export type CoreId =
  | "A_INDICADORES"
  | "A_FUNDAMENTAL"
  | "A_TECNICO"
  | "A_INSTITUCIONAL"
  | "A_NOTICIAS"
  | "A_IA";

export const ALL_CORE_IDS: readonly CoreId[] = [
  "A_INDICADORES",
  "A_FUNDAMENTAL",
  "A_TECNICO",
  "A_INSTITUCIONAL",
  "A_NOTICIAS",
  "A_IA"
] as const;

export type SubCoreIndicador = "RSI" | "MACD" | "EMA" | "ADX" | "BB";

export const ALL_SUBCORES_INDICADOR: readonly SubCoreIndicador[] = [
  "RSI",
  "MACD",
  "EMA",
  "ADX",
  "BB"
] as const;

export type TipoSenal = "CALL" | "PUT" | "HOLD";
export type Tendencia = "ALCISTA" | "BAJISTA" | "LATERAL";
export type EstadoSenal = "ACTIVA" | "EXPIRADA" | "INVALIDADA" | "DEGRADADA";
export type DeltaPrev = "NUEVA" | "CONFIRMADA" | "INVERTIDA" | "DEGRADADA";

// FIC: Claves canonicas de metricas por core (Fundamental, Institucional, Noticias, IA).
// FIC: Tipadas para evitar volver al `Record<string, unknown>` deprecado por FR-020.
export type MetricKey =
  | "MARKET_CAP"
  | "CASH"
  | "DIVIDENDO"
  | "EMPLEADOS"
  | "VOLATILIDAD"
  | "VOLUMEN"
  | "SENTIMIENTO"
  | "MONTO_USD"
  | "FONDO"
  | "FILING_DATE"
  | "PERIODO"
  | "MODEL_VERSION"
  // FIC: A_INSTITUCIONAL engine metrics (TEAM-05).
  | "INST_SCORE"
  | "SMA_50"
  | "SMA_200"
  | "TREND_STRENGTH"
  | "CONTINUITY_PROB"
  | "VOLUME_CORR"
  | "DAYS_TO_OPEX"
  | "THETA"
  | "GAMMA"
  | "EXPIRY_BIAS"
  | "CALL_PUT_SKEW"
  | "SOPORTES"
  | "RESISTENCIAS"
  | "ATR"
  | "CANDLES_ANALYZED"
  | "PREPROMPT"
  | "VALOR_ENTRADA";

// FIC: Observacion estructurada que reemplaza el texto libre de la confluencia v1.
// FIC: Replaces the free-form metadata bag with a typed observation (FR-020).
export interface SignalObservation {
  objetivo: string;
  senal: string;
  explicacion: string;
  metricas: Partial<Record<MetricKey, number | string>>;
}

// FIC: Greeks opcionales por fila (solo cuando la senal apunta a una opcion).
export interface OptionGreeks {
  ala: "ALA1" | "ALA2";
  vencimiento: string; // ISO date
  strike: number;
  gamma: number;
  theta: number;
  delta: number;
  posicion: "SHORT" | "LONG";
  tolerancia: "BAJO" | "MEDIO" | "ALTO";
}

// FIC: Fila canonica de la tabla de confluencia (1 por core, o 1 por subCore en A_INDICADORES).
// FIC: Canonical row of the confluence table consumed 1:1 by the dashboard (FR-014, US5).
export interface ConfluenceSignalRow {
  ticket: string;
  core: CoreId;
  subCore?: SubCoreIndicador | string;
  precio: number;
  tipoSenal: TipoSenal;
  fecha: string; // ISO date
  timeframe: Timeframe;
  tendencia: Tendencia;
  score: number; // [-1, 1]
  peso: number; // contribucion al verdict consolidado
  invertir: boolean;
  estado: EstadoSenal;
  vigencia: string; // ISO timestamp
  fuente: string;
  evidencia_refs: string[];
  ia_revisada: boolean;
  disclaimer_id?: string;
  delta_vs_anterior: DeltaPrev;
  observacion: SignalObservation;
  optionLeg?: OptionGreeks;
  algorithm_version: string;
  computed_at: string;
  source_input_hash: string;
}

export type RangoHistoricoPreset = "2A" | "1A" | "6M" | "3M" | "1M";

// FIC: Payload de `POST /api/simulation/run` (FR-015, US6).
export interface SimulationRequest {
  ticket: string;
  rangoHistorico: RangoHistoricoPreset | { from: string; to: string };
  rangoEstrategia: { from: string; to: string };
  temporalidad: Timeframe;
  runtimeMode: "ONLINE" | "OFFLINE";
  coresHabilitados: CoreId[];
  indicadoresHabilitados: SubCoreIndicador[];
  estrategia: string; // "IRON_CONDOR" | ... — lista canonica abierta (T111)
  toleranciaRiesgo: "BAJO" | "MEDIO" | "ALTO";
}

// FIC: Config metadata-driven de columnas. Persiste en `confluence_columns` y se sirve al PWA.
export interface ConfluenceColumnConfig {
  field_key: string;
  label: string;
  data_type: "string" | "number" | "boolean" | "timestamp" | "json" | "enum";
  visible: boolean;
  order_index: number;
  applies_to_cores: CoreId[];
}

// FIC: Disclaimer constitucional para filas con `core = A_IA` (RNF-001, FR-019, SC-009).
export const IA_DISCLAIMER_TEXT =
  "esta explicacion no constituye orden ni recomendacion ejecutable";
export const IA_DISCLAIMER_ID = "disclaimer-ia-constitucional-v1";
