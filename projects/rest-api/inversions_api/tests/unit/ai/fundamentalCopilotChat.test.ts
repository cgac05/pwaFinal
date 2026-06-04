import { describe, expect, it } from "vitest";
import { FundamentalCopilotChat } from "../../../src/modules/ai/fundamentalCopilotChat";

describe("FundamentalCopilotChat", () => {
  it("returns a baseline response structure", async () => {
    const copilot = new FundamentalCopilotChat();
    const response = await copilot.generateResponse({
      ticker: "AAPL",
      question: "¿Cuál es la fortaleza fundamental de esta acción?",
      includeStrategyRecommendation: true
    });

    expect(response.answer).toContain("AAPL");
    expect(response.sourceContext).toContain("Ticker: AAPL");
    expect(response.disclaimer).toContain("informativo");
    expect(response.answer.toLowerCase()).not.toContain("compra");
    expect(response.answer.toLowerCase()).not.toContain("vende");
  });

  it("includes scenario guidance for market change questions", async () => {
    const copilot = new FundamentalCopilotChat();
    const response = await copilot.generateResponse({
      ticker: "AAPL",
      question: "¿Qué puede cambiar si la volatilidad aumenta?",
      includeStrategyRecommendation: false
    });

    expect(response.answer).toContain("Escenarios de mercado a considerar:");
    expect(response.disclaimer).toContain("recomendación de inversión");
  });

  it("explains calculation steps when asked how it was calculated", async () => {
    const copilot = new FundamentalCopilotChat();
    const response = await copilot.generateResponse({
      ticker: "AAPL",
      question: "¿Cómo calculaste ese score?",
      includeStrategyRecommendation: false
    });

    expect(response.answer).toContain("Cómo se calculó el resultado:");
    expect(response.answer).toContain("score de viabilidad");
  });
});
