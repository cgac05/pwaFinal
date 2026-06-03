import type {
  AgentRole,
  IAgentMessage,
  IGeminiResponse,
  IGeminiStrategyAssessmentResponse,
} from "../../types";

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
  // Usamos 'any' para la instancia y así evitamos importar el tipo estático de genai que causa conflictos
  private aiInstance: any | null = null;
  private readonly primaryModel: string;
  private readonly fallbackModel: string;
  private readonly timeoutMs: number;
  private readonly apiKey: string | undefined;
  private readonly enabled: boolean;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.enabled = process.env.GEMINI_ENABLED !== "false";

    this.primaryModel = process.env.GEMINI_PRIMARY_MODEL ?? "gemini-2.5-flash";
    this.fallbackModel = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-2.5-flash";
this.timeoutMs = parseInt(process.env.GEMINI_TIMEOUT_MS ?? "30000", 10);
  }

  public isEnabled(): boolean {
    return this.enabled && (this.apiKey !== undefined && this.apiKey.length > 0);
  }

  // Carga perezosa (Lazy Load) de la librería con importación dinámica
  private async getAiInstance(): Promise<any> {
    if (!this.isEnabled()) return null;
    
    if (!this.aiInstance) {
      // Esta es la línea mágica que evita el error TS1479
      const { GoogleGenAI } = await import("@google/genai");
      this.aiInstance = new GoogleGenAI({ apiKey: this.apiKey as string });
    }
    return this.aiInstance;
  }

private async callModel(
    prompt: string, 
    model: string, 
    systemInstruction?: string,
    generationConfig?: { temperature?: number; topP?: number; maxOutputTokens?: number }
  ): Promise<string> {
    const ai = await this.getAiInstance();
    if (!ai) {
      throw new Error("Gemini is not configured. Set GEMINI_API_KEY to enable AI agent execution.");
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const config: any = {
        temperature: generationConfig?.temperature ?? 0.2,
        topP: generationConfig?.topP ?? 0.9,
        maxOutputTokens: generationConfig?.maxOutputTokens ?? 8192,
        abortSignal: controller.signal
      };

      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }

      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config
      });

      return getResponseText(response);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  public async generateAgentResponse(
    request: IAgentMessage,
    systemInstruction?: string,
    generationConfig?: { temperature?: number; topP?: number; maxOutputTokens?: number }
  ): Promise<IGeminiResponse> {
    const role = request.role;
    const systemPrompt = role === "analyzer"
      ? "You are a Gemini-powered market volatility analyzer. Produce both structured market insight and a short opinion summary."
      : role === "strategist"
        ? "You are a Gemini-powered strategist. Generate a recommended options strategy with a clear rationale and a structured decision payload."
        : "You are a Gemini-powered executor advisor. Confirm execution readiness and describe any pre-trade checks required in structured form.";

    const requirements = `Response Requirements:\n- Answer with a concise natural language analysis.\n- Include a valid JSON object under an "analysis" key.\n- Do not wrap JSON in markdown code fences.\n- If JSON cannot be produced, return {"analysis": {}} and explain why.\n- Keep the opinion summary short and specific.`;

    const finalSystemInstruction = systemInstruction ?? `${systemPrompt}\n\n${requirements}`;
    const userPrompt = request.userPrompt;

    try {
      const text = await backoffRetry(() => this.callModel(userPrompt, this.primaryModel, finalSystemInstruction, generationConfig), 3, 400);
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

      const text = await backoffRetry(() => this.callModel(userPrompt, this.fallbackModel, finalSystemInstruction, generationConfig), 3, 800);
      return {
        model: this.fallbackModel,
        text,
        structured: extractJsonPayload(text),
        raw: text,
        timestampUtc: new Date().toISOString(),
      };
    }
  }

public async generateSimpleResponse(
    prompt: string, 
    modelType: 'primary' | 'fallback' = 'primary',
    systemInstruction?: string,
    generationConfig?: { temperature?: number; topP?: number; maxOutputTokens?: number }
  ): Promise<{ model: string; text: string }> {
    if (!this.isEnabled()) {
      throw new Error("Gemini is not configured. Set GEMINI_API_KEY to enable AI agent execution.");
    }

    const targetModel = modelType === 'fallback' ? this.fallbackModel : this.primaryModel;

    try {
      const text = await backoffRetry(() => this.callModel(prompt, targetModel, systemInstruction, generationConfig), 3, 400);
      return { model: targetModel, text };
    } catch (primaryError) {
      const fallback = targetModel === this.primaryModel ? this.fallbackModel : this.primaryModel;
      if (fallback === targetModel) {
        throw primaryError;
      }

      console.warn(`Selected model ${targetModel} failed. Switching to fallback ${fallback}.`);
      const text = await backoffRetry(() => this.callModel(prompt, fallback, systemInstruction, generationConfig), 3, 800);
      return { model: fallback, text };
    }
  }
}