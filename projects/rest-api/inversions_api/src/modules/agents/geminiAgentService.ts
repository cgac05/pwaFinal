import { GoogleGenAI } from "@google/genai";
import { getEnvironmentConfig } from "../../config/environment";
import type { EnvironmentConfig } from "../../config/environment";
import type {
  AgentRole,
  IAgentMessage,
  IGeminiResponse,
  IAgentOutput,
  IGeminiStrategyAssessmentResponse,
} from "../../types";

// Legacy aliases for backwards compatibility
export type GeminiAgentRequest = IAgentMessage;
export type GeminiAgentResponse = IGeminiResponse;
export { IGeminiStrategyAssessmentResponse } from "../../types";

export function createGeminiPrompt(role: AgentRole, userPrompt: string): string {
  const systemInstructions =
    role === "analyzer"
      ? "You are a Gemini-powered market volatility analyzer. Produce both structured market insight and a short opinion summary."
      : role === "strategist"
      ? "You are a Gemini-powered strategist. Generate a recommended options strategy with a clear rationale and a structured decision payload."
      : "You are a Gemini-powered executor advisor. Confirm execution readiness and describe any pre-trade checks required in structured form.";

  return `System Instructions:\n${systemInstructions}\n\nUser Input:\n${userPrompt}\n\nResponse Requirements:\n- Answer with a concise natural language analysis.\n- Include a valid JSON object under an "analysis" key.\n- Do not wrap JSON in markdown code fences.\n- If JSON cannot be produced, return {"analysis": {}} and explain why.\n- Keep the opinion summary short and specific.`;
}

/**
 * Build the exact CSV prompt required by the T151 task.
 * Inserts the provided table string inside the required template block.
 */
export function createGeminiCSVPrompt(tableString: string): string {
  const header =
    "A continuación se presentan las estrategias de trading activas. La tabla está en formato CSV con los siguientes campos:\nstrategy_id, name, symbol, asset_type, timeframe, direction, indicators, entry_conditions, stop_loss_pct, take_profit_pct, risk_reward_ratio, win_rate_pct, max_drawdown_pct, total_trades\n\n";

  const instructions = `Para cada estrategia, proporciona:\n\n1. VIABILIDAD: Alta / Media / Baja\n2. FORTALEZAS: máximo 2 puntos concretos\n3. DEBILIDADES: máximo 2 puntos concretos\n4. ACCIÓN RECOMENDADA: Operar / Pausar / Descartar\n5. JUSTIFICACIÓN: 2-3 líneas explicando la recomendación\n\nAl final, incluye un RESUMEN GLOBAL con:\n- Número de estrategias por acción recomendada\n- La estrategia con mejor relación riesgo/beneficio\n- La estrategia con mayor riesgo\n- Una observación general del portafolio de estrategias\n\nLa salida esperada de Gemini debe estar en el siguiente formato Markdown:\n\n## Estrategia: {{name}} ({{symbol}})\n\n- Viabilidad: Alta\n- Fortalezas: ...\n- Debilidades: ...\n- Acción recomendada: Operar\n- Justificación: ...\n\n---\n\n## Resumen global\n\n- Operar: X | Pausar: Y | Descartar: Z\n- Mejor riesgo/beneficio: name — ratio N.N\n- Mayor riesgo: name — drawdown N.N%\n- Observación: ...\n\nPor favor responda únicamente en Markdown siguiendo estrictamente el formato anterior.`;

  return `${header}--- INICIO DE TABLA ---\n${tableString}\n--- FIN DE TABLA ---\n\n${instructions}`;
}

function getResponseText(response: unknown): string {
  if (!response || typeof response !== "object") {
    return String(response ?? "");
  }

  const entry = response as Record<string, unknown>;
  const candidates = entry.candidates;
  if (Array.isArray(candidates) && candidates.length > 0) {
    const firstCandidate = candidates[0] as Record<string, unknown>;
    const content = firstCandidate.content;
    if (typeof content === "string") {
      return content;
    }
  }

  const text = entry.text;
  if (typeof text === "string") {
    return text;
  }

  return JSON.stringify(response);
}

function extractJsonPayload(text: string): unknown {
  const jsonCandidate = text.match(/\{[\s\S]*\}/);
  if (!jsonCandidate) {
    return {};
  }

  try {
    return JSON.parse(jsonCandidate[0]);
  } catch {
    return { raw: jsonCandidate[0] };
  }
}

async function backoffRetry<T>(action: () => Promise<T>, attempts = 3, initialDelayMs = 300): Promise<T> {
  let lastError: unknown;
  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }

  throw lastError;
}

export class GeminiAgentService {
  private readonly ai: GoogleGenAI | null;
  private readonly primaryModel: string;
  private readonly fallbackModel: string;
  private readonly timeoutMs: number;

  constructor() {
    let config: EnvironmentConfig["gemini"] | undefined;
    try {
      const env = getEnvironmentConfig();
      config = env.gemini;
    } catch (err) {
      // Environment not initialized — treat Gemini as not configured for tests
      this.ai = null;
      this.primaryModel = "gemini-2.5-flash";
      this.fallbackModel = "gemini-2.0-pro";
      this.timeoutMs = 12000;
      return;
    }

    this.primaryModel = config?.model ?? "gemini-2.5-flash";
    this.fallbackModel = config?.fallbackModel ?? "gemini-2.0-pro";
    this.timeoutMs = config?.timeoutMs ?? 12000;

    if (config?.enabled && config.apiKey && config.apiKey.length > 0) {
      this.ai = new GoogleGenAI({ apiKey: config.apiKey });
    } else {
      this.ai = null;
    }
  }

  public isEnabled(): boolean {
    return this.ai !== null;
  }

  private async callModel(prompt: string, model: string): Promise<string> {
    if (!this.ai) {
      throw new Error("Gemini is not configured. Set GEMINI_API_KEY to enable AI agent execution.");
    }

    const response = await this.ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    return getResponseText(response);
  }

  public async generateAgentResponse(request: IAgentMessage): Promise<IGeminiResponse> {
    const prompt = createGeminiPrompt(request.role, request.userPrompt);

    try {
      const text = await backoffRetry(() => this.callModel(prompt, this.primaryModel), 3, 400);
      return {
        model: this.primaryModel,
        text,
        structured: extractJsonPayload(text),
        raw: text,
        timestampUtc: new Date().toISOString(),
      };
    } catch (primaryError) {
      if (this.primaryModel === this.fallbackModel) {
        throw primaryError;
      }

      const text = await backoffRetry(() => this.callModel(prompt, this.fallbackModel), 3, 800);
      return {
        model: this.fallbackModel,
        text,
        structured: extractJsonPayload(text),
        raw: text,
        timestampUtc: new Date().toISOString(),
      };
    }
  }
}
