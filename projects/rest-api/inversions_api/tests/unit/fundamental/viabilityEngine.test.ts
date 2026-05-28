import { describe, it, expect } from "vitest";
import { ViabilityEngine } from "../../../src/modules/fundamental/viabilityEngine";

const sampleData = {
  ticker: "TEST",
  companyName: "Test Co",
  metrics: {
    marketCap: { value: 5_000_000_000 },
    priceHistory: { currentPrice: 100, pricePoints: new Array(252).fill(100) },
    volatility: { annualizedVolatility: 20 },
    financialRatios: { roe: 20, peRatio: 15 },
    beta: { value: 1.0 },
    eps: { epsGrowthYoYPercent: 10 },
    dividend: { dividendYieldPercent: 1 }
  },
  metadata: { fetchTimestamp: new Date().toISOString() }
};

describe("ViabilityEngine", () => {
  it("calculates a viability score within expected bounds and classification", () => {
    const engine = new ViabilityEngine();
    const score = engine.calculateViability(sampleData as any);

    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(1);
    expect(["VIABLE", "NEUTRAL", "NOT_VIABLE"]).toContain(score.classification);
    expect(score.componentScores).toHaveProperty("marketCap");
    expect(typeof score.justifications).toBe("object");
  });

  it("returns HIGH confidence for complete data", () => {
    const engine = new ViabilityEngine();
    const score = engine.calculateViability(sampleData as any);
    expect(score.confidence).toBe("HIGH");
  });
});
