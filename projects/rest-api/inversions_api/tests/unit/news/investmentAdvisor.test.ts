// FIC: Unit tests for the orchestrator verdict mapping and end-to-end evaluation.
// FIC: Tests unitarios del mapeo de veredicto del orquestador y la evaluacion de extremo a extremo.

import { describe, expect, it } from "vitest";
import { InvestmentAdvisor, resolveVerdict } from "../../../src/modules/news/investmentAdvisor";
import { NewsAdapter } from "../../../src/modules/news/newsAdapter";
import { NEWS_DISCLAIMER } from "../../../src/modules/news/types";

describe("resolveVerdict", () => {
  it("holds when confidence is below 0.4", () => {
    expect(resolveVerdict({ score: 0.9, label: "BULLISH", confidence: 0.3, reasoning: "", keyFactors: [] })).toBe(
      "HOLD"
    );
  });

  it("buys on positive score with enough confidence", () => {
    expect(resolveVerdict({ score: 0.5, label: "BULLISH", confidence: 0.8, reasoning: "", keyFactors: [] })).toBe(
      "BUY"
    );
  });

  it("sells on negative score with enough confidence", () => {
    expect(resolveVerdict({ score: -0.5, label: "BEARISH", confidence: 0.8, reasoning: "", keyFactors: [] })).toBe(
      "SELL"
    );
  });

  it("holds on neutral score", () => {
    expect(resolveVerdict({ score: 0.1, label: "NEUTRAL", confidence: 0.8, reasoning: "", keyFactors: [] })).toBe(
      "HOLD"
    );
  });
});

describe("InvestmentAdvisor.evaluate", () => {
  it("returns a structured verdict with the constitutional disclaimer (demo fallback)", async () => {
    // FIC: Sin credenciales Alpaca, el adapter degrada a noticias demo deterministas.
    const advisor = new InvestmentAdvisor({ adapter: new NewsAdapter({}) });
    const verdict = await advisor.evaluate("aapl");

    expect(verdict.symbol).toBe("AAPL");
    expect(["BUY", "SELL", "HOLD"]).toContain(verdict.verdict);
    expect(verdict.newsCount).toBeGreaterThan(0);
    expect(verdict.disclaimer).toBe(NEWS_DISCLAIMER);
    expect(verdict.ia_revisada).toBe(true);
    expect(typeof verdict.generatedAt).toBe("string");
  });
});
