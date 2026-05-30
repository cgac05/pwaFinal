import { GeminiAgentService } from "../agents/geminiAgentService";
import { mockDb } from "../volatility/mockDb";
import {
  ALGORITHM_VERSION,
  IA_DISCLAIMER_ID,
  type ConfluenceSignalRow,
  type Timeframe
} from "../indicators/types";
import { buildIaDegradedStub } from "../indicators/coreStubs";

/**
 * Parsea el texto devuelto por Gemini para extraer decisión y justificación.
 */
function parseAiDecision(rawText: string): { decision: "CALL" | "PUT" | "HOLD"; justificacion: string; confidence: number } {
  const upperText = rawText.toUpperCase();
  let decision: "CALL" | "PUT" | "HOLD" = "HOLD";

  if (upperText.includes("DECISION: CALL") || upperText.includes("DECISION: SÍ") || upperText.includes("DECISIÓN: SÍ") || upperText.includes("DECISION: BUY")) {
    decision = "CALL";
  } else if (upperText.includes("DECISION: PUT") || upperText.includes("DECISION: NO") || upperText.includes("DECISIÓN: NO") || upperText.includes("DECISION: SELL")) {
    decision = "PUT";
  }

  const lines = rawText.split("\n");
  let justificacion = "Sin justificación estructurada devuelta por el modelo.";
  const justificacionLine = lines.find(l => l.toUpperCase().includes("JUSTIFICACION:") || l.toUpperCase().includes("JUSTIFICACIÓN:"));
  if (justificacionLine) {
    justificacion = justificacionLine.replace(/^.*JUSTIFICACIÓ?N:\s*/i, "").trim();
  } else if (rawText.length > 0) {
    justificacion = rawText.length > 250 ? rawText.slice(0, 250) + "..." : rawText;
  }

  return { decision, justificacion, confidence: 0.85 };
}

/**
 * Ejecuta el Core de Inteligencia Artificial evaluando las filas de los demás cores.
 */
export async function runAiCore(params: {
  ticket: string;
  timeframe: Timeframe;
  sourceInputHash: string;
  computedAt: Date;
  previousRows?: ConfluenceSignalRow[];
  precalculatedRows: ConfluenceSignalRow[];
}): Promise<ConfluenceSignalRow> {
  const geminiService = new GeminiAgentService();

  // 1. Si no está configurado Gemini, devolver stub degradado.
  if (!geminiService.isEnabled()) {
    console.warn("A_IA: Gemini no está habilitado (faltan credenciales o GEMINI_ENABLED=false)");
    return buildIaDegradedStub({
      ticket: params.ticket,
      timeframe: params.timeframe as any,
      sourceInputHash: params.sourceInputHash,
      previousRows: params.previousRows,
      now: params.computedAt,
    }, "LLM_UNAVAILABLE");
  }

  // 2. Extraer el preprompt de la base de datos (usando mockDb por el momento)
  const currentPrompt = mockDb.prompts && mockDb.prompts.length > 0
    ? mockDb.prompts[0].basePrompt
    : "Eres un analista financiero. Analiza los siguientes datos y responde en formato DECISION: [CALL|PUT|HOLD] y JUSTIFICACION: [explicación].";

  // 3. Serializar la tabla pre-calculada
  let rowsContext = "No se encontraron filas de otros cores.";
  if (params.precalculatedRows.length > 0) {
    // Nota: el buildCanonicalOutputString no está exportado igual en backend. 
    // Usaremos un formateo nativo.
    rowsContext = params.precalculatedRows.map((r, i) => {
      const metricEntries = Object.entries(r.observacion.metricas || {}).filter(([, v]) => v != null);
      const metricsStr = metricEntries.length > 0 ? metricEntries.map(([k, v]) => `${k}=${v}`).join(", ") : "N/A";
      return `Fila ${i + 1}: CORE=${r.core} | SEÑAL=${r.tipoSenal} | TENDENCIA=${r.tendencia} | SCORE=${r.score.toFixed(3)} | METRICAS=[${metricsStr}]`;
    }).join("\n");
  }

  const fullPrompt = `${currentPrompt}

Ticker: ${params.ticket}
Timeframe: ${params.timeframe}

DATOS DE ENTRADA (Cores pre-calculados):
${rowsContext}

Por favor, entrega tu análisis incluyendo la decisión y justificación técnica.`;

  try {
    // 4. Llamar a Gemini con el prompt combinado
    const response = await geminiService.generateAgentResponse({
      role: "analyzer",
      userPrompt: fullPrompt,
    });

    // 5. Parsear la respuesta
    const aiResult = parseAiDecision(response.text || "");

    // 6. Construir la fila final ConfluenceSignalRow
    const vigenciaSeconds = params.timeframe === "1d" ? 86400 * 5 : 3600 * 5; // Aproximación
    const vigenciaDate = new Date(params.computedAt.getTime() + vigenciaSeconds * 1000);

    return {
      ticket: params.ticket,
      core: "A_IA",
      precio: 0,
      tipoSenal: aiResult.decision,
      fecha: params.computedAt.toISOString().slice(0, 10),
      timeframe: params.timeframe,
      tendencia: aiResult.decision === "CALL" ? "ALCISTA" : aiResult.decision === "PUT" ? "BAJISTA" : "LATERAL",
      score: aiResult.decision === "CALL" ? aiResult.confidence : aiResult.decision === "PUT" ? -aiResult.confidence : 0,
      peso: 1.0, // Alta ponderación al ser la IA la capa final
      invertir: false,
      estado: "ACTIVA",
      vigencia: vigenciaDate.toISOString(),
      fuente: `gemini-2.5-flash`,
      evidencia_refs: [],
      ia_revisada: true,
      disclaimer_id: IA_DISCLAIMER_ID,
      delta_vs_anterior: "NUEVA",
      observacion: {
        objetivo: "Sintetizar la señal global con LLM y emitir veredicto final.",
        senal: `Decisión consolidada: ${aiResult.decision}`,
        explicacion: aiResult.justificacion,
        metricas: {
          MODEL_VERSION: "gemini-2.5-flash",
          PREPROMPT: currentPrompt,
          VALOR_ENTRADA: rowsContext
        }
      },
      algorithm_version: ALGORITHM_VERSION,
      computed_at: params.computedAt.toISOString(),
      source_input_hash: params.sourceInputHash,
    };
  } catch (error: any) {
    console.error("A_IA: Error ejecutando Gemini:", error.message || error);
    // 7. Fallback si el LLM falla
    return buildIaDegradedStub({
      ticket: params.ticket,
      timeframe: params.timeframe as any,
      sourceInputHash: params.sourceInputHash,
      previousRows: params.previousRows,
      now: params.computedAt,
    }, "LLM_RATE_LIMITED");
  }
}
