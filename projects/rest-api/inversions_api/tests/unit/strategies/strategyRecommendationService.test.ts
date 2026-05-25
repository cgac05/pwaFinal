import { describe, expect, it } from "vitest";
import { rankOptionStrategies } from "../../../src/modules/strategies/strategyRecommendationService";
import type { OptionStrategyContract } from "../../../src/modules/strategies/optionsStrategyContract";

describe("Strategy Recommendation Service", () => {
  const baseParams: OptionStrategyContract = {
    ticker: "AAPL",
    optionType: "call",
    strikePrice: 150,
    expirationDate: "2026-12-31",
    premium: 3,
    quantity: 1,
    direction: "long",
    capitalAvailable: 10000,
    riskTolerance: "medium"
  };

  it("returns a ranked recommendation list for a viable ticker", () => {
    const result = rankOptionStrategies(baseParams, 0.78);

    expect(result.warning).toBeUndefined();
    expect(result.chosen).not.toBeNull();
    expect(result.ranking).toHaveLength(4);
    expect(result.alternative).not.toBeUndefined();
    expect(result.ranking[0].riskAdjustedReturn).toBeGreaterThanOrEqual(result.ranking[1].riskAdjustedReturn);
  });

  it("returns a warning when viability score is below threshold", () => {
    const result = rankOptionStrategies(baseParams, 0.4);

    expect(result.chosen).toBeNull();
    expect(result.ranking).toHaveLength(0);
    expect(result.warning).toContain("Viabilidad insuficiente");
  });
});
