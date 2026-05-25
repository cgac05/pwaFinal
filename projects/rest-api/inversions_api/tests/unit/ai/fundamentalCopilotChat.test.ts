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
    expect(response.sourceContext).toContain("Requested ticker: AAPL");
    expect(response.disclaimer).toContain("informativo");
  });
});
