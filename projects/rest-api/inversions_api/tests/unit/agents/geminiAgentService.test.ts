import { describe, expect, it, beforeEach } from "vitest";
import { resetEnvironment } from "../../../src/config/environment";
import { createGeminiPrompt, createGeminiCSVPrompt, GeminiAgentService } from "../../../src/modules/agents/geminiAgentService";

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

  it("builds a CSV prompt with table markers and instructions", () => {
    const csv = `strategy_id,name,symbol\n1,MeanReversion,AAPL`;
    const prompt = createGeminiPrompt("strategist", "placeholder");
    // ensure the general prompt builder still includes system role text
    expect(prompt).toContain("strategist");

    // Now test the CSV-specific prompt generator
    const csvPrompt = createGeminiCSVPrompt(csv);
    expect(csvPrompt).toContain("strategy_id, name, symbol");
    expect(csvPrompt).toContain("--- INICIO DE TABLA ---");
    expect(csvPrompt).toContain("--- FIN DE TABLA ---");
    expect(csvPrompt).toContain(csv);
    expect(csvPrompt).toContain("Por favor responda únicamente en Markdown");
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
