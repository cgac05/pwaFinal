// FIC: Cliente PWA Phase 5 — tabla canonica + simulacion (consume backend TEAM-02).

export type CoreId =
  | "A_INDICADORES"
  | "A_FUNDAMENTAL"
  | "A_TECNICO"
  | "A_INSTITUCIONAL"
  | "A_NOTICIAS"
  | "A_IA";

export type SubCoreIndicador = "RSI" | "MACD" | "EMA" | "ADX" | "BB";
export type TipoSenal = "CALL" | "PUT" | "HOLD";
export type Tendencia = "ALCISTA" | "BAJISTA" | "LATERAL";
export type EstadoSenal = "ACTIVA" | "EXPIRADA" | "INVALIDADA" | "DEGRADADA";
export type DeltaPrev = "NUEVA" | "CONFIRMADA" | "INVERTIDA" | "DEGRADADA";

export interface SignalObservation {
  objetivo: string;
  senal: string;
  explicacion: string;
  metricas: Record<string, number | string>;
}

export interface OptionGreeks {
  ala: "ALA1" | "ALA2";
  vencimiento: string;
  strike: number;
  gamma: number;
  theta: number;
  delta: number;
  posicion: "SHORT" | "LONG";
  tolerancia: "BAJO" | "MEDIO" | "ALTO";
}

export interface ConfluenceSignalRow {
  ticket: string;
  core: CoreId;
  subCore?: string;
  precio: number;
  tipoSenal: TipoSenal;
  fecha: string;
  timeframe: string;
  tendencia: Tendencia;
  score: number;
  peso: number;
  invertir: boolean;
  estado: EstadoSenal;
  vigencia: string;
  fuente: string;
  evidencia_refs: string[];
  ia_revisada: boolean;
  disclaimer_id?: string;
  delta_vs_anterior: DeltaPrev;
  observacion: SignalObservation;
  resumen_analisis?: string;
  optionLeg?: OptionGreeks;
  algorithm_version: string;
  computed_at: string;
  source_input_hash: string;
}

export interface ConfluenceTableResponse {
  rows: ConfluenceSignalRow[];
  generated_at: string;
  algorithm_version: string;
  ticket: string;
  timeframe: string;
}

export interface SimulationRequestPayload {
  ticket: string;
  rangoHistorico: "2A" | "1A" | "6M" | "3M" | "1M" | { from: string; to: string };
  rangoEstrategia: { from: string; to: string };
  temporalidad: string;
  runtimeMode: "ONLINE" | "OFFLINE";
  coresHabilitados: CoreId[];
  indicadoresHabilitados: SubCoreIndicador[];
  estrategia: string;
  toleranciaRiesgo: "BAJO" | "MEDIO" | "ALTO";
}

export interface SimulationResponse {
  verdict: any;
  table: ConfluenceSignalRow[];
  inputs_echo: SimulationRequestPayload;
  computed_at: string;
  algorithm_version: string;
}

function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("inversions.auth.token") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function getConfluenceTable(params: {
  ticket: string;
  timeframe?: string;
  cores?: CoreId[];
  from?: string;
  to?: string;
}): Promise<ConfluenceTableResponse> {
  const query = new URLSearchParams();
  query.set("ticket", params.ticket);
  if (params.timeframe) query.set("timeframe", params.timeframe);
  if (params.cores && params.cores.length > 0) query.set("cores", params.cores.join(","));
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  const res = await fetch(`/api/signals/confluence-table?${query.toString()}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`confluence-table ${res.status}`);
  return (await res.json()) as ConfluenceTableResponse;
}

export async function runSimulation(payload: SimulationRequestPayload): Promise<SimulationResponse> {
  const res = await fetch("/api/simulation/run", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? `simulation/run ${res.status}`);
  }
  return (await res.json()) as SimulationResponse;
}

export const CANONICAL_ESTRATEGIAS = [
  "IRON_CONDOR",
  "BULL_CALL_SPREAD",
  "BEAR_PUT_SPREAD",
  "LONG_CALL",
  "LONG_PUT",
  "SHORT_CALL",
  "SHORT_PUT",
  "STRADDLE",
  "STRANGLE",
  "BUTTERFLY",
  "COVERED_CALL",
  "CALENDAR_SPREAD",
  "DIAGONAL_SPREAD",
  "WHEEL",
] as const;

export const ALL_CORES: CoreId[] = [
  "A_INDICADORES",
  "A_FUNDAMENTAL",
  "A_TECNICO",
  "A_INSTITUCIONAL",
  "A_NOTICIAS",
  "A_IA"
];

export const ALL_SUBCORES: SubCoreIndicador[] = ["RSI", "MACD", "EMA", "ADX", "BB"];

export {
  buildCanonicalOutputString,
  buildSignalContextMD,
} from "@inversions/utils";
export type {
  CanonicalOutputRow,
  CanonicalCoreId,
  CanonicalTipoSenal,
  CanonicalSignalObservation,
} from "@inversions/utils";
