import { describe, expect, it, beforeEach } from "vitest";
import { resetEnvironment } from "../../../src/config/environment";
import { createGeminiPrompt, GeminiAgentService } from "../../../src/modules/agents/geminiAgentService";

describe("GeminiAgentService", () => {
  beforeEach(() => {
    resetEnvironment();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_FALLBACK_MODEL;
    delete process.env.GEMINI_TIMEOUT_MS;
  });

  it("builds a prompt for strategist role", () => {
    const prompt = createGeminiPrompt("strategist", "Recommend a short volatility strategy.");
    expect(prompt).toContain("strategist");
    expect(prompt).toContain("Recommend a short volatility strategy.");
    expect(prompt).toContain("valid JSON object");
  });

  it("fails gracefully when Gemini is not configured", async () => {
    const service = new GeminiAgentService();
    await expect(
      service.generateAgentResponse({
        role: "analyzer",
        userPrompt: "Test market opinion.",
      })
    ).rejects.toThrow("Gemini is not configured");
  });
});
