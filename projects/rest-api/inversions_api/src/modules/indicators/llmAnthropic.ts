// FIC: Phase 6 Bloque A (T120-T124) — Anthropic Claude Opus 4.7 explainer con prompt caching y degradacion.
// FIC: Anthropic Claude Opus 4.7 explainer with prompt caching + graceful degradation (Q1, Edge Cases).
//
// FIC: La dependencia `@anthropic-ai/sdk` se importa de forma perezosa para no romper CI (NODE_ENV=test).
// FIC: Si la dep no esta instalada o falla, se delega al DeterministicMockExplainer.

import {
  CHAT_DISCLAIMER,
  DeterministicMockExplainer,
  type LlmExplainer,
  type LlmExplainerResponse
} from "./chatExplainer";

export const ANTHROPIC_MODEL_ID = "claude-opus-4-7";

export interface AnthropicExplainerOptions {
  apiKey?: string;
  model?: string;
  /**
   * FIC: Numero de reintentos exponenciales antes de degradar (default 2 — 1s + 2s).
   */
  retries?: number;
  /**
   * FIC: Funcion de espera inyectable (test).
   */
  delay?: (ms: number) => Promise<void>;
}

export type LlmErrorCode = "LLM_UNAVAILABLE" | "LLM_RATE_LIMITED";

export interface AnthropicExplainerResponse extends LlmExplainerResponse {
  degraded?: boolean;
  error_code?: LlmErrorCode;
}

const defaultDelay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function classifyError(err: unknown): LlmErrorCode {
  const status = (err as any)?.status ?? (err as any)?.response?.status;
  if (status === 429) return "LLM_RATE_LIMITED";
  return "LLM_UNAVAILABLE";
}

// FIC: Implementacion concreta de LlmExplainer contra Anthropic. Cae a mock determinista si la SDK
// FIC: no esta presente o la API falla tras los reintentos.
export class AnthropicExplainer implements LlmExplainer {
  readonly model: string;
  private apiKey: string | undefined;
  private retries: number;
  private delay: (ms: number) => Promise<void>;
  private fallback = new DeterministicMockExplainer();
  private clientPromise: Promise<any> | null = null;

  constructor(opts: AnthropicExplainerOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
    this.model = opts.model ?? ANTHROPIC_MODEL_ID;
    this.retries = opts.retries ?? 2;
    this.delay = opts.delay ?? defaultDelay;
  }

  private async getClient(): Promise<any | null> {
    if (!this.apiKey) return null;
    if (this.clientPromise) return this.clientPromise;
    this.clientPromise = (async () => {
      try {
        // FIC: Import dinamico para no requerir la dep en CI.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = await import(/* @vite-ignore */ "@anthropic-ai/sdk" as string).catch(() => null);
        if (!mod) return null;
        const Anthropic = (mod as any).default ?? (mod as any).Anthropic;
        return new Anthropic({ apiKey: this.apiKey });
      } catch {
        return null;
      }
    })();
    return this.clientPromise;
  }

  async explain(prompt: string): Promise<AnthropicExplainerResponse> {
    const started = Date.now();
    const client = await this.getClient();
    if (!client) {
      const fallback = await this.fallback.explain(prompt);
      return { ...fallback, degraded: true, error_code: "LLM_UNAVAILABLE" };
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const resp = await client.messages.create({
          model: this.model,
          max_tokens: 800,
          // FIC: Prompt caching nativo de Anthropic en el system prompt (Q1).
          system: [
            {
              type: "text",
              text:
                "Eres un analista tecnico. Explicas en español, citas valores numericos, " +
                "NO recomiendas ni ejecutas operaciones, y siempre incluyes el disclaimer constitucional.",
              cache_control: { type: "ephemeral" }
            }
          ],
          messages: [{ role: "user", content: prompt }]
        });
        const text =
          (resp?.content?.[0]?.text as string | undefined) ??
          (typeof resp?.content === "string" ? resp.content : "") ??
          "";
        return {
          text: text || CHAT_DISCLAIMER,
          model: this.model,
          latency_ms: Date.now() - started
        };
      } catch (err) {
        lastError = err;
        if (attempt < this.retries) {
          await this.delay((attempt + 1) * 1000);
        }
      }
    }

    const fallback = await this.fallback.explain(prompt);
    return {
      ...fallback,
      degraded: true,
      error_code: classifyError(lastError)
    };
  }
}

// FIC: Factory — usa el mock determinista en NODE_ENV=test (T122).
export function createExplainerForRuntime(): LlmExplainer {
  if (process.env.NODE_ENV === "test" || !process.env.ANTHROPIC_API_KEY) {
    return new DeterministicMockExplainer();
  }
  return new AnthropicExplainer();
}
