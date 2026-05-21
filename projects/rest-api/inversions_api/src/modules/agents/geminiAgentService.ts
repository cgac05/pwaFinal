import { GoogleGenAI } from "@google/genai";
import { PromptTemplate } from "langchain/prompts";
import { getEnvironmentConfig } from "../../config/environment";

export type AgentRole = "analyzer" | "strategist" | "executor";

export interface GeminiAgentRequest {
  role: AgentRole;
  userPrompt: string;
  context?: string;
}

export interface GeminiAgentResponse {
  model: string;
  text: string;
  structured: unknown;
  raw: unknown;
  timestampUtc: string;
}

export function createGeminiPrompt(role: AgentRole, userPrompt: string): string {
  const prompt = new PromptTemplate({
    template: `System Instructions:\n{systemInstructions}\n\nUser Input:\n{userPrompt}\n\nResponse Requirements:\n- Answer with a concise natural language analysis.
- Include a valid JSON object under an "analysis" key.
- Do not wrap JSON in markdown code fences.
- If JSON cannot be produced, return {\"analysis\": {}} and explain why.
- Keep the opinion summary short and specific.`,
    inputVariables: ["systemInstructions", "userPrompt"],
  });

  const systemInstructions =
    role === "analyzer"
      ? "You are a Gemini-powered market volatility analyzer. Produce both structured market insight and a short opinion summary."
      : role === "strategist"
      ? "You are a Gemini-powered strategist. Generate a recommended options strategy with a clear rationale and a structured decision payload."
      : "You are a Gemini-powered executor advisor. Confirm execution readiness and describe any pre-trade checks required in structured form.";

  return prompt.format({ systemInstructions, userPrompt });
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
    const config = getEnvironmentConfig().gemini;
    this.primaryModel = config?.model ?? "gemini-2.5-flash";
    this.fallbackModel = config?.fallbackModel ?? "gemini-2.0-pro";
    this.timeoutMs = config?.timeoutMs ?? 12000;

    if (config?.enabled && config.apiKey.length > 0) {
      this.ai = new GoogleGenAI({ apiKey: config.apiKey, timeout: this.timeoutMs });
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
      contents: [prompt],
      temperature: 0.25,
      topP: 0.95,
      maxOutputTokens: 1024,
    });

    return getResponseText(response);
  }

  public async generateAgentResponse(request: GeminiAgentRequest): Promise<GeminiAgentResponse> {
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
