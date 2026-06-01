// FIC: Canonical Output Standard — Generates the unified string format for all core signals.
// FIC: Estándar Canónico de Salida — Genera el formato string unificado para señales de todos los cores.
//
// Formato:
//   CORE=<core> || OBJETIVO=<objetivo> || SEÑAL=<bullish|bearish|neutral|mixed> ||
//   DECISIÓN=<buy|sell|wait> || OPCIÓN=<call|put|n/a> ||
//   EXPLICACIÓN_TÉCNICA=<razonamiento> ||
//   CONFLUENCIA=[SEÑAL_01=<fuente>|LECTURA=<valor>|IMPACTO=<positivo|negativo|neutral>|PESO=<peso>|JUSTIFICACIÓN=<texto>; ...] ||
//   RIESGO=<riesgo> || CONFIANZA=<0-100> || RESULTADO_FINAL=<conclusion>
//
// Reglas:
// - Mismo orden de campos en todos los equipos
// - No omitir campos; si no aplica, escribir "n/a"
// - No mezclar formatos por core
// - No usar lenguaje ambiguo sin métricas o evidencia

export type CanonicalCoreId =
	| "A_INDICADORES"
	| "A_FUNDAMENTAL"
	| "A_TECNICO"
	| "A_INSTITUCIONAL"
	| "A_NOTICIAS"
	| "A_IA"
	| "E_ESTRATEGIA";

export type CanonicalTipoSenal = "CALL" | "PUT" | "HOLD";

export interface CanonicalSignalObservation {
	objetivo: string;
	senal: string;
	explicacion: string;
	metricas: Record<string, number | string>;
}

export interface CanonicalOutputRow {
	core: CanonicalCoreId;
	subCore?: string;
	tipoSenal: CanonicalTipoSenal;
	score: number;
	peso: number;
	observacion: CanonicalSignalObservation;
}

const CORE_LABELS: Record<CanonicalCoreId, string> = {
	A_INDICADORES: "Indicadores Técnicos",
	A_FUNDAMENTAL: "Análisis Fundamental",
	A_TECNICO: "Análisis Técnico Soportes/Resistencias",
	A_INSTITUCIONAL: "Flujo Institucional",
	A_NOTICIAS: "Sentimiento de Noticias",
	A_IA: "Síntesis IA",
	E_ESTRATEGIA: "Estrategia de Opciones",
};

function riskFromScore(score: number, core: CanonicalCoreId): string {
	if (core === "A_IA") return "Riesgo inherente al uso de IA generativa — validar con fuentes primarias";
	const abs = Math.abs(score);
	if (abs > 0.7) return "Riesgo alto — señal fuerte pero requiere confirmación adicional";
	if (abs > 0.4) return "Riesgo moderado — señal direccional con margen de error";
	if (abs > 0.15) return "Riesgo bajo — señal débil, considerar stop-loss ajustado";
	return "Riesgo mínimo — señal neutral, sin sesgo direccional claro";
}

function conclusionFromRow(row: CanonicalOutputRow): string {
	const coreName = CORE_LABELS[row.core] || row.core;
	const objetivo = row.observacion.objetivo.replace(/\.+$/, "");
	if (row.tipoSenal === "CALL") {
		return `${coreName} emite señal alcista (score ${row.score.toFixed(3)}): ${objetivo}. Se recomienda evaluar entrada con gestión de riesgo.`;
	}
	if (row.tipoSenal === "PUT") {
		return `${coreName} emite señal bajista (score ${row.score.toFixed(3)}): ${objetivo}. Se recomienda evaluar cobertura o salida.`;
	}
	return `${coreName} emite señal neutral (score ${row.score.toFixed(3)}): ${objetivo}. Sin acción inmediata recomendada.`;
}

const CANONICAL_VERSION = "1.0.0";

/**
 * Builds the canonical output string for a signal row.
 * MUST be used by every core/team that generates signals.
 */
export function buildCanonicalOutputString(row: CanonicalOutputRow): string {
	const señal =
		row.tipoSenal === "CALL" ? "bullish"
		: row.tipoSenal === "PUT" ? "bearish"
		: "neutral";

	const decision =
		row.tipoSenal === "CALL" ? "buy"
		: row.tipoSenal === "PUT" ? "sell"
		: "wait";

	const opcion =
		row.tipoSenal === "CALL" ? "call"
		: row.tipoSenal === "PUT" ? "put"
		: "n/a";

	const confianza = Math.round(Math.abs(row.score) * 100);
	const riesgo = riskFromScore(row.score, row.core);
	const resultadoFinal = conclusionFromRow(row);

	const metricEntries = Object.entries(row.observacion.metricas)
		.filter(([, v]) => v != null);

	const confluenciaStr = metricEntries.length > 0
		? metricEntries.map(([k, v], i) => {
				const num = typeof v === "number" ? v : Number.parseFloat(String(v));
				const impacto = Number.isNaN(num) ? "neutral"
											: num > 0 ? "positivo"
											: num < 0 ? "negativo"
											: "neutral";
				const fuente = row.subCore
					? `${row.core}/${row.subCore}`
					: row.core;
				return [
					`SEÑAL_${String(i + 1).padStart(2, "0")}=${fuente}`,
					`LECTURA=${String(v)}`,
					`IMPACTO=${impacto}`,
					`PESO=${row.peso.toFixed(3)}`,
					`JUSTIFICACIÓN=${k}: ${row.observacion.explicacion}`,
				].join("|");
			}).join("; ")
		: "n/a";

	const coreDisplay = row.subCore
		? `${row.core}/${row.subCore}`
		: row.core;

	return [
		`CORE=${coreDisplay}`,
		`OBJETIVO=${row.observacion.objetivo}`,
		`SEÑAL=${señal}`,
		`DECISIÓN=${decision}`,
		`OPCIÓN=${opcion}`,
		`EXPLICACIÓN_TÉCNICA=${row.observacion.explicacion}`,
		`CONFLUENCIA=[${confluenciaStr}]`,
		`RIESGO=${riesgo}`,
		`CONFIANZA=${confianza}`,
		`RESULTADO_FINAL=${resultadoFinal}`,
	].join(" || ");
}

/**
 * Builds markdown context from a canonical row for traceability and export.
 */
export function buildSignalContextMD(
	row: CanonicalOutputRow & { ticket?: string; timeframe?: string; fecha?: string; tendencia?: string; invertir?: boolean; estado?: string; fuente?: string; algorithm_version?: string; computed_at?: string; source_input_hash?: string; ia_revisada?: boolean; evidencia_refs?: string[] },
	activeStrategy?: string
): string {
	const lines: string[] = [
		`## Señal de Confluencia: ${row.ticket ?? "N/A"}`,
		``,
		`| Campo | Valor |`,
		`|-------|-------|`,
		`| Core | ${row.core}${row.subCore ? ` / ${row.subCore}` : ""} |`,
		`| Tipo Señal | **${row.tipoSenal}** |`,
		`| Tendencia | ${row.tendencia ?? "N/A"} |`,
		`| Score | ${row.score.toFixed(3)} |`,
		`| Peso | ${row.peso.toFixed(3)} |`,
		`| Invertir | ${row.invertir !== undefined ? (row.invertir ? "SI" : "NO") : "N/A"} |`,
		`| Estado | ${row.estado ?? "N/A"} |`,
		`| Timeframe | ${row.timeframe ?? "N/A"} |`,
		`| Fecha | ${row.fecha ?? "N/A"} |`,
		activeStrategy ? `| Estrategia activa | ${activeStrategy.replace(/_/g, " ")} |` : "",
		``,
		`### Observación`,
		`**Objetivo:** ${row.observacion.objetivo}`,
		``,
		`**Señal:** ${row.observacion.senal}`,
		``,
		`**Explicación:** ${row.observacion.explicacion}`,
	].filter(Boolean);

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
		`- Esas métricas produjeron un score de **${row.score.toFixed(3)}** (peso ${row.peso.toFixed(3)}) con tendencia **${row.tendencia ?? "N/A"}**.`,
		`- Por eso la observación concluye una señal **${row.tipoSenal}**: ${row.observacion.explicacion}`,
		activeStrategy
			? `- Esto sustenta la estrategia **${activeStrategy.replace(/_/g, " ")}**, coherente con un sesgo ${row.tipoSenal === "CALL" ? "alcista" : row.tipoSenal === "PUT" ? "bajista" : "neutral"}.`
			: "",
	);

	lines.push(
		``,
		`### Qué se usó para el cálculo`,
		`- **Insumos del score:** ${metricEntries.length > 0 ? `las métricas listadas (${metricList})` : "los indicadores del core"}, ponderadas por peso ${row.peso.toFixed(3)}.`,
		`- **Objetivo del análisis:** ${row.observacion.objetivo}`,
		`- **Algoritmo / versión:** ${row.algorithm_version ?? CANONICAL_VERSION}`,
		`- **Fuente de datos:** ${row.fuente ?? "N/A"}`,
		`- **Timeframe evaluado:** ${row.timeframe ?? "N/A"}`,
		`- **Calculado:** ${row.computed_at ?? "N/A"}${row.ia_revisada ? " · revisado por IA" : ""}`,
		row.source_input_hash ? `- **Hash de insumos:** ${row.source_input_hash}` : "",
	);

	if (row.evidencia_refs?.length) {
		lines.push(``, `### Evidencia`);
		for (const ref of row.evidencia_refs) {
			lines.push(`- ${ref}`);
		}
	}

	return lines.filter((l): l is string => typeof l === "string" && l !== "").join("\n");
}
