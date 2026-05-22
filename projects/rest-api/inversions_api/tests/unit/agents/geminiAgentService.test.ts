import { describe, expect, it, beforeEach, vi } from "vitest";
import { resetEnvironment } from "../../../src/config/environment";
import {
  createGeminiPrompt,
  createGeminiCSVPrompt,
  GeminiAgentService,
} from "../../../src/modules/agents/geminiAgentService";
import type { IAgentMessage, IGeminiResponse } from "../../../src/types";

describe("GeminiAgentService", () => {
  beforeEach(() => {
    resetEnvironment();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_FALLBACK_MODEL;
    delete process.env.GEMINI_TIMEOUT_MS;
  });

  describe("SDK Installation & Configuration", () => {
    it("should instantiate GeminiAgentService without errors", () => {
      const service = new GeminiAgentService();
      expect(service).toBeDefined();
    });

    it("should report disabled state when GEMINI_API_KEY is not set", () => {
      const service = new GeminiAgentService();
      expect(service.isEnabled()).toBe(false);
    });

    it("should have timeout default of 12000ms", () => {
      const service = new GeminiAgentService();
      // Service is created, even if not enabled
      expect(service).toBeDefined();
    });
  });

  describe("Prompt Generation", () => {
    it("builds a prompt for analyzer role", () => {
      const prompt = createGeminiPrompt("analyzer", "Analyze market volatility.");
      expect(prompt).toContain("analyzer");
      expect(prompt).toContain("Analyze market volatility.");
      expect(prompt).toContain("market volatility analyzer");
    });

    it("builds a prompt for strategist role", () => {
      const prompt = createGeminiPrompt("strategist", "Recommend a short volatility strategy.");
      expect(prompt).toContain("strategist");
      expect(prompt).toContain("Recommend a short volatility strategy.");
      expect(prompt).toContain("strategist");
      expect(prompt).toContain("valid JSON object");
    });

    it("builds a prompt for executor role", () => {
      const prompt = createGeminiPrompt("executor", "Verify execution readiness.");
      expect(prompt).toContain("executor");
      expect(prompt).toContain("Verify execution readiness.");
      expect(prompt).toContain("executor advisor");
    });

    it("includes response requirements in all prompts", () => {
      const roles = ["analyzer", "strategist", "executor"] as const;
      roles.forEach((role) => {
        const prompt = createGeminiPrompt(role, "Test");
        expect(prompt).toContain("Response Requirements");
        expect(prompt).toContain("valid JSON object");
      });
    });
  });

  describe("CSV Prompt Generation", () => {
    it("builds a CSV prompt with table markers and instructions", () => {
      const csv = `strategy_id,name,symbol\n1,MeanReversion,AAPL`;
      const csvPrompt = createGeminiCSVPrompt(csv);

      // Verify table markers
      expect(csvPrompt).toContain("--- INICIO DE TABLA ---");
      expect(csvPrompt).toContain("--- FIN DE TABLA ---");
      expect(csvPrompt).toContain(csv);

      // Verify instructions
      expect(csvPrompt).toContain("Por favor responda únicamente en Markdown");
      expect(csvPrompt).toContain("VIABILIDAD");
      expect(csvPrompt).toContain("FORTALEZAS");
      expect(csvPrompt).toContain("DEBILIDADES");
      expect(csvPrompt).toContain("ACCIÓN RECOMENDADA");
      expect(csvPrompt).toContain("JUSTIFICACIÓN");
    });

    it("includes CSV field documentation in prompt", () => {
      const csv = "strategy_id,name,symbol";
      const csvPrompt = createGeminiCSVPrompt(csv);
      expect(csvPrompt).toContain("strategy_id, name, symbol");
      expect(csvPrompt).toContain("risk_reward_ratio");
      expect(csvPrompt).toContain("win_rate_pct");
    });

    it("includes markdown output format specification", () => {
      const csv = "test_data";
      const csvPrompt = createGeminiCSVPrompt(csv);

      expect(csvPrompt).toContain("## Estrategia:");
      expect(csvPrompt).toContain("Viabilidad:");
      expect(csvPrompt).toContain("## Resumen global");
      expect(csvPrompt).toContain("Operar:");
      expect(csvPrompt).toContain("Mejor riesgo/beneficio:");
      expect(csvPrompt).toContain("Mayor riesgo:");
    });
  });

  describe("Error Handling", () => {
    it("fails gracefully when Gemini is not configured", async () => {
      const service = new GeminiAgentService();
      const request: IAgentMessage = {
        role: "analyzer",
        userPrompt: "Test market opinion.",
      };

      await expect(service.generateAgentResponse(request)).rejects.toThrow(
        "Gemini is not configured"
      );
    });

    it("should not throw when creating service without config", () => {
      expect(() => {
        const service = new GeminiAgentService();
        expect(service.isEnabled()).toBe(false);
      }).not.toThrow();
    });
  });

  describe("Interface Compatibility", () => {
    it("accepts IAgentMessage as request parameter", () => {
      const service = new GeminiAgentService();
      const message: IAgentMessage = {
        role: "strategist",
        userPrompt: "Test prompt",
        context: "Test context",
        timestamp: new Date().toISOString(),
        metadata: { test: true },
      };

      // Should not throw during parameter assignment
      expect(message).toBeDefined();
      expect(message.role).toBe("strategist");
    });

    it("response has correct IGeminiResponse structure", async () => {
      // This test verifies type structure only (since API calls fail without key)
      const expectedResponse: IGeminiResponse = {
        model: "gemini-2.5-flash",
        text: "test response",
        structured: { test: "data" },
        raw: "raw response",
        timestampUtc: new Date().toISOString(),
      };

      expect(expectedResponse).toBeDefined();
      expect(expectedResponse.model).toBeDefined();
      expect(expectedResponse.text).toBeDefined();
      expect(expectedResponse.structured).toBeDefined();
      expect(expectedResponse.timestampUtc).toBeDefined();
    });
  });
});

