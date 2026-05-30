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

// FIC: Cadena canónica requerida por estandarizacion_de_salida.txt. (ES)
// FIC: Canonical string required by estandarizacion_de_salida.txt. (EN)
export function buildCanonicalOutputString(row: ConfluenceSignalRow): string {
  const señal = row.tipoSenal === "CALL" ? "bullish"
              : row.tipoSenal === "PUT" ? "bearish" : "neutral";
  const decision = row.tipoSenal === "CALL" ? "buy"
                 : row.tipoSenal === "PUT" ? "sell" : "wait";
  const opcion = row.tipoSenal === "CALL" ? "call"
               : row.tipoSenal === "PUT" ? "put" : "n/a";
  const confianza = Math.round(Math.abs(row.score) * 100);
  const riesgo = row.score < 0
    ? "Señal débil o inversa"
    : row.score > 0.5 ? "Riesgo moderado" : "Riesgo bajo";
  const resultadoFinal = `Señal ${row.tipoSenal} — ${row.observacion.senal}`;

  const metricEntries = Object.entries(row.observacion.metricas)
    .filter(([, v]) => v != null);
  const confluenciaStr = metricEntries.length > 0
    ? metricEntries.map(([k, v], i) => {
        const num = typeof v === "number" ? v : parseFloat(String(v));
        const impacto = isNaN(num) ? "neutral"
                      : num > 0 ? "positivo" : num < 0 ? "negativo" : "neutral";
        return `SEÑAL_${String(i + 1).padStart(2, "0")}=${k}|LECTURA=${String(v)}|IMPACTO=${impacto}|PESO=${row.peso.toFixed(3)}|JUSTIFICACIÓN=${k} del análisis institucional`;
      }).join("; ")
    : "n/a";

  return (
    `CORE=${row.core}` +
    ` || OBJETIVO=${row.observacion.objetivo}` +
    ` || SEÑAL=${señal}` +
    ` || DECISIÓN=${decision}` +
    ` || OPCIÓN=${opcion}` +
    ` || EXPLICACIÓN_TÉCNICA=${row.observacion.explicacion}` +
    ` || CONFLUENCIA=[${confluenciaStr}]` +
    ` || RIESGO=${riesgo}` +
    ` || CONFIANZA=${confianza}` +
    ` || RESULTADO_FINAL=${resultadoFinal}`
  );
}

// FIC: Contexto de señal en formato markdown para exportación y trazabilidad. (ES)
// FIC: Signal context in markdown table format for export and traceability. (EN)
export function buildSignalContextMD(row: ConfluenceSignalRow, activeStrategy?: string): string {
  const lines: string[] = [
    `## Señal de Confluencia: ${row.ticket}`,
    ``,
    `| Campo | Valor |`,
    `|-------|-------|`,
    `| Core | ${row.core}${row.subCore ? ` / ${row.subCore}` : ""} |`,
    `| Tipo Señal | **${row.tipoSenal}** |`,
    `| Tendencia | ${row.tendencia} |`,
    `| Score | ${row.score.toFixed(3)} |`,
    `| Peso | ${row.peso.toFixed(3)} |`,
    `| Invertir | ${row.invertir ? "SI" : "NO"} |`,
    `| Estado | ${row.estado} |`,
    `| Timeframe | ${row.timeframe} |`,
    `| Fecha | ${row.fecha} |`,
    activeStrategy ? `| Estrategia activa | ${activeStrategy.replace(/_/g, " ")} |` : "",
    ``,
    `### Observación`,
    `**Objetivo:** ${row.observacion.objetivo}`,
    ``,
    `**Señal:** ${row.observacion.senal}`,
    ``,
    `**Explicación:** ${row.observacion.explicacion}`,
  ];

  const metricEntries = Object.entries(row.observacion.metricas)
    .filter(([, v]) => v != null);
  if (metricEntries.length > 0) {
    lines.push(``, `### Métricas consideradas`);
    for (const [k, v] of metricEntries) {
      lines.push(`- **${k}:** ${String(v)}`);
    }
  }

  const metricList = metricEntries.map(([k, v]) => `${k}=${String(v)}`).join(", ");
  lines.push(
    ``,
    `### Razonamiento`,
    `- El core **${row.core}**${row.subCore ? ` / **${row.subCore}**` : ""} evaluó ${metricEntries.length > 0 ? `las métricas (${metricList})` : "sus indicadores"}.`,
    `- Esas métricas produjeron un score de **${row.score.toFixed(3)}** (peso ${row.peso.toFixed(3)}) con tendencia **${row.tendencia}**.`,
    `- Por eso la observación concluye una señal **${row.tipoSenal}**${row.invertir ? " (invertida)" : ""}: ${row.observacion.explicacion}`,
    activeStrategy
      ? `- Esto sustenta la estrategia **${activeStrategy.replace(/_/g, " ")}**, coherente con un sesgo ${row.tipoSenal === "CALL" ? "alcista" : row.tipoSenal === "PUT" ? "bajista" : "neutral"}.`
      : "",
  );

  lines.push(
    ``,
    `### Qué se usó para el cálculo`,
    `- **Insumos del score:** ${metricEntries.length > 0 ? `las métricas listadas (${metricList})` : "los indicadores del core"}, ponderadas por peso ${row.peso.toFixed(3)}.`,
    `- **Objetivo del análisis:** ${row.observacion.objetivo}`,
    `- **Algoritmo / versión:** ${row.algorithm_version}`,
    `- **Fuente de datos:** ${row.fuente}`,
    `- **Timeframe evaluado:** ${row.timeframe}`,
    `- **Calculado:** ${row.computed_at}${row.ia_revisada ? " · revisado por IA" : ""}`,
    row.source_input_hash ? `- **Hash de insumos:** ${row.source_input_hash}` : "",
  );

  if (row.evidencia_refs?.length) {
    lines.push(``, `### Evidencia`);
    for (const ref of row.evidencia_refs) {
      lines.push(`- ${ref}`);
    }
  }

  return lines.filter((l) => l !== undefined).join("\n");
}
