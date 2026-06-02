import { GeminiAgentService } from "../agents/geminiAgentService";
import { CHAT_DISCLAIMER, LlmExplainer, LlmExplainerResponse, DeterministicMockExplainer } from "./chatExplainer";

export class GeminiExplainer implements LlmExplainer {
  readonly model: string;
  private geminiService: GeminiAgentService;
  private fallback = new DeterministicMockExplainer();

  constructor() {
    this.geminiService = new GeminiAgentService();
    this.model = process.env.GEMINI_PRIMARY_MODEL ?? "gemini-2.5-flash";
  }

  async explain(prompt: string): Promise<LlmExplainerResponse> {
    const started = Date.now();
    
    if (!this.geminiService.isEnabled()) {
      const fallback = await this.fallback.explain(prompt);
      return {
        ...fallback,
        degraded: true,
        error_code: "LLM_UNAVAILABLE"
      } as any;
    }

    try {
      const response = await this.geminiService.generateSimpleResponse(prompt, "primary");
      return {
        text: response.text || CHAT_DISCLAIMER,
        model: response.model || this.model,
        latency_ms: Date.now() - started
      };
    } catch (err: any) {
      console.warn("GeminiExplainer failed, falling back to deterministic explanation:", err);
      const fallback = await this.fallback.explain(prompt);
      return {
        ...fallback,
        degraded: true,
        error_code: err.status === 429 ? "LLM_RATE_LIMITED" : "LLM_UNAVAILABLE"
      } as any;
    }
  }
}
