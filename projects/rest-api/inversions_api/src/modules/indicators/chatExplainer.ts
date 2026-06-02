// FIC: Chat IA explainer orchestrator — explains technical signals, never executes orders (Hansel, TEAM-02).
// FIC: Orquestador del Chat IA explicativo — explica señales tecnicas, nunca ejecuta ordenes (Hansel, TEAM-02).

import { computeConfluence } from "./confluence";
import {
  IA_DISCLAIMER_ID,
  type ConfluenceVerdict,
  type OhlcBar,
  type SignalObservation,
  type Timeframe
} from "./types";

// FIC: Constitutional disclaimer — MUST be present in every Chat IA response.
// FIC: Disclaimer constitucional — DEBE estar presente en toda respuesta del Chat IA.
export const CHAT_DISCLAIMER = "esta explicacion no constituye orden ni recomendacion ejecutable";

export interface LlmExplainerResponse {
  text: string;
  model: string;
  latency_ms: number;
}

// FIC: Neutral LLM interface so the concrete provider stays swappable (clarify T070).
// FIC: Interfaz LLM neutral para que el proveedor concreto sea intercambiable (clarify T070).
export interface LlmExplainer {
  explain(prompt: string): Promise<LlmExplainerResponse>;
}

export interface ChatExplainRequest {
  symbol: string;
  timeframe: Timeframe;
  question: string;
  context?: string;
}

export interface IndicatorCitation {
  indicator: string;
  value: number | null;
  reading: string;
}

export interface ChatExplanationResponse {
  explanation_text: string;
  indicators_cited: IndicatorCitation[];
  disclaimer: string;
  model_version: string;
  computed_at: string;
  refused: boolean;
  // FIC: Phase 5 Bloque D (T104) — observacion estructurada para alimentar la fila A_IA.
  observation?: SignalObservation;
  // FIC: Phase 5 Bloque D (T105) — flag y disclaimer_id presentes en respuestas IA (FR-019, SC-009).
  ia_revisada?: boolean;
  disclaimer_id?: string;
  degraded?: boolean;
  error_code?: "LLM_UNAVAILABLE" | "LLM_RATE_LIMITED";
}

// FIC: Construye una SignalObservation tipada desde la confluencia (T104).
// FIC: Build a typed SignalObservation from confluence (FR-020).
export function buildObservationFromVerdict(
  verdict: ConfluenceVerdict,
  question: string
): SignalObservation {
  const cited = verdict.components
    .filter((c) => c.available)
    .map((c) => `${c.indicator.toUpperCase()}=${c.value ?? "n/a"}`)
    .join(", ");
  return {
    objetivo: `Responder en lenguaje natural: "${question}".`,
    senal: `Veredicto ${verdict.verdict} (score ${verdict.score}).`,
    explicacion: `Indicadores citados: ${cited || "ninguno disponible"}.`,
    metricas: {
      MODEL_VERSION: verdict.algorithm_version
    }
  };
}

// FIC: Detects user questions that imply executing/placing an order (ES + EN).
// FIC: Detecta preguntas del usuario que implican ejecutar/colocar una orden (ES + EN).
export const EXECUTION_INTENT_PATTERN =
  /\b(ejecut\w*|coloc\w*|lanz\w*|abr\w*\s+(una\s+)?(orden|posici[oó]n)|compr\w+|vend\w+|invier\w+|invert\w+|operar|execute|buy|sell|short\s+the|place\s+an?\s+order)\b/iu;

// FIC: Narrower guard for model OUTPUT that recommends acting (avoids false positives).
// FIC: Guarda mas estrecha para la SALIDA del modelo que recomienda actuar (evita falsos positivos).
const OUTPUT_RECOMMENDATION_PATTERN =
  /\b(deber[ií]as?\s+(comprar|vender)|te\s+recomiendo\s+(comprar|vender)|ejecut\w*\s+(la\s+|una\s+)?(orden|compra|venta)|coloca\w*\s+(una\s+)?orden|abre\s+(una\s+)?posici[oó]n)\b/iu;

export function hasExecutionIntent(text: string): boolean {
  return EXECUTION_INTENT_PATTERN.test(text);
}

// FIC: Guarantee the constitutional disclaimer is present, appending it if missing.
// FIC: Garantiza que el disclaimer constitucional este presente, anexandolo si falta.
export function enforceDisclaimer(text: string): string {
  if (text.toLowerCase().includes(CHAT_DISCLAIMER)) return text;
  return `${text.trim()}\n\n${CHAT_DISCLAIMER}`;
}

function extractData(prompt: string): Record<string, unknown> | null {
  const open = "[DATOS]";
  const close = "[/DATOS]";
  const start = prompt.indexOf(open);
  const end = prompt.indexOf(close);
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(prompt.slice(start + open.length, end).trim()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

interface PromptFact {
  indicator: string;
  detail: string;
}

// FIC: Build a Spanish prompt that cites concrete indicator values for the LLM.
// FIC: Construye un prompt en español que cita valores concretos de indicadores para el LLM.
export function buildExplanationPrompt(verdict: ConfluenceVerdict, request: ChatExplainRequest): string {
  const facts: PromptFact[] = verdict.components
    .filter((c) => c.available)
    .map((c) => ({ indicator: c.indicator, detail: c.detail }));
  const data = {
    symbol: verdict.symbol,
    timeframe: verdict.timeframe,
    verdict: verdict.verdict,
    score: verdict.score,
    degraded: verdict.degraded,
    facts
  };
  return [
    "Eres un analista tecnico. Explica en español, de forma clara y neutral, por que la",
    "señal tecnica actual tiene el veredicto indicado, citando los valores numericos reales.",
    "No recomiendes ni ejecutes operaciones; solo explica.",
    "Si el usuario hace una pregunta que no está estrictamente relacionada con el análisis financiero o los reportes proveídos, DEBES responder textualmente: 'Soy un modelo de análisis financiero limitado a los análisis realizados aquí.', y no decir nada más.",
    `Pregunta del usuario: ${request.question}`,
    request.context ? `Contexto adicional: ${request.context}` : "",
    "[DATOS]",
    JSON.stringify(data),
    "[/DATOS]"
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

function renderDeterministicExplanation(prompt: string): string {
  const data = extractData(prompt);
  if (!data) {
    return "No fue posible construir una explicacion detallada con los datos disponibles.";
  }
  const facts = Array.isArray(data.facts) ? (data.facts as PromptFact[]) : [];
  const lines: string[] = [
    `El analisis tecnico de ${data.symbol} en ${data.timeframe} arroja un veredicto ${data.verdict} (score ${data.score}).`
  ];
  for (const fact of facts) {
    lines.push(`- ${String(fact.indicator).toUpperCase()}: ${fact.detail}`);
  }
  if (data.degraded === true) {
    lines.push("Nota: la lectura es parcial porque algun indicador no estuvo disponible.");
  }
  lines.push(
    "En conjunto, estos indicadores sustentan el veredicto descrito; esta lectura es solo informativa."
  );
  return lines.join("\n");
}

function deterministicLatency(prompt: string): number {
  return 5 + (prompt.length % 20);
}

// FIC: Deterministic mock LLM for CI — no network, identical prompt -> identical output.
// FIC: LLM mock determinista para CI — sin red, mismo prompt -> misma salida.
export class DeterministicMockExplainer implements LlmExplainer {
  readonly model = "mock-explainer-deterministic-v1";

  async explain(prompt: string): Promise<LlmExplainerResponse> {
    return {
      text: renderDeterministicExplanation(prompt),
      model: this.model,
      latency_ms: deterministicLatency(prompt)
    };
  }
}

function buildCitations(verdict: ConfluenceVerdict): IndicatorCitation[] {
  return verdict.components
    .filter((c) => c.available)
    .map((c) => ({ indicator: c.indicator, value: c.value, reading: c.detail }));
}

function sanitizedExplanation(verdict: ConfluenceVerdict): string {
  const cited = verdict.components
    .filter((c) => c.available)
    .map((c) => `${c.indicator.toUpperCase()} (${c.detail})`)
    .join("; ");
  return (
    `El veredicto tecnico de ${verdict.symbol} en ${verdict.timeframe} es ${verdict.verdict} ` +
    `con score ${verdict.score}. Indicadores considerados: ${cited}.`
  );
}

function buildRefusal(computedAt: string): ChatExplanationResponse {
  const text = enforceDisclaimer(
    "No puedo ejecutar ni recomendar operaciones. Mi funcion es unicamente explicar la " +
      "señal tecnica con base en los indicadores. Puedo describir por que la señal actual " +
      "es alcista, neutral o bajista, pero no puedo colocar ordenes ni sugerir comprar o vender."
  );
  return {
    explanation_text: text,
    indicators_cited: [],
    disclaimer: CHAT_DISCLAIMER,
    model_version: "refusal-guard",
    computed_at: computedAt,
    refused: true,
    ia_revisada: true,
    disclaimer_id: IA_DISCLAIMER_ID
  };
}

export interface ExplainDeps {
  explainer: LlmExplainer;
}

// FIC: Orchestrate the Chat IA explanation: confluence -> prompt -> LLM -> safeguards.
// FIC: Orquesta la explicacion del Chat IA: confluencia -> prompt -> LLM -> salvaguardas.
export async function explainSignal(
  request: ChatExplainRequest,
  candles: OhlcBar[],
  deps: ExplainDeps
): Promise<ChatExplanationResponse> {
  const computedAt = new Date().toISOString();

  // FIC: A question implying order execution is refused with a 200 structured message.
  // FIC: Una pregunta que implica ejecutar una orden se rechaza con un mensaje estructurado 200.
  if (hasExecutionIntent(request.question)) {
    return buildRefusal(computedAt);
  }

  // FINANCIAL_CONTEXT_GUARD (core): bloquea en el nucleo antes de cualquier llamada al LLM.
  // Normaliza el texto quitando acentos para una comparación más robusta
  const promptMsg = (request.question || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const financialKeywords = [
      'analiz',     // Atrapa analiza, analizar, analizando
      'analisis', 
      'por que',    // Sin acento para evitar bloqueos por mala ortografía
      'score',
      'viabil',     // Atrapa viable, viabilidad
      'ticker',
      'opcion',     // Sin acento (opcion, opciones)
      'comprar',
      'vender',
      'resumen',
      'report',     // Atrapa reporte, reportes
      'detalle',
      'simulaci',   // Atrapa simulacion, simulaciones (sin acento)
      'grafic',     // Atrapa grafica, grafico, graficar (sin acento)
      'explica'     // Atrapa explica, explicar, explícame
    ];
  const hasKeyword = financialKeywords.some((word) => promptMsg.includes(word));
  if (promptMsg.length < 10 || !hasKeyword) {
    return {
      explanation_text: "Soy un modelo de análisis financiero limitado a los análisis realizados aquí.",
      indicators_cited: [],
      disclaimer: CHAT_DISCLAIMER,
      model_version: "context-guard",
      computed_at: computedAt,
      refused: true,
      ia_revisada: true,
      disclaimer_id: IA_DISCLAIMER_ID
    };
  }

  const verdict = computeConfluence(candles, { symbol: request.symbol, timeframe: request.timeframe });
  const prompt = buildExplanationPrompt(verdict, request);
  const llm = await deps.explainer.explain(prompt);

  // FIC: Post-process — reject model output that suggests acting, then enforce disclaimer.
  // FIC: Post-proceso — rechaza salida del modelo que sugiera actuar, luego fuerza el disclaimer.
  let text = llm.text;
  if (OUTPUT_RECOMMENDATION_PATTERN.test(text)) {
    text = sanitizedExplanation(verdict);
  }
  text = enforceDisclaimer(text);

  return {
    explanation_text: text,
    indicators_cited: buildCitations(verdict),
    disclaimer: CHAT_DISCLAIMER,
    model_version: llm.model,
    computed_at: computedAt,
    refused: false,
    // FIC: T104/T105 — observacion estructurada + flags constitucionales para fila A_IA.
    observation: buildObservationFromVerdict(verdict, request.question),
    ia_revisada: true,
    disclaimer_id: IA_DISCLAIMER_ID,
    degraded: (llm as any).degraded === true ? true : undefined,
    error_code: (llm as any).error_code
  };
}
