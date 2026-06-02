import { describe, expect, it } from "vitest";
import { analyzeProtectivePut } from "../../../../src/modules/strategies/coverage/protectivePutEngine";
import { estimateOptionPremium } from "../../../../src/modules/strategies/coverage/coverageTypes";
import type { CoverageStrategyContract } from "../../../../src/modules/strategies/coverage/coverageStrategyContract";

function makeContract(overrides: Partial<CoverageStrategyContract> = {}): CoverageStrategyContract {
  const underlyingPrice = overrides.underlyingPrice ?? 100;
  const putStrike = 95;
  const premium = estimateOptionPremium("put", putStrike, 0.25, 90, underlyingPrice);
  return {
    strategyId: "test-pp-1",
    kind: "protective_put",
    ticker: "TEST",
    shares: 100,
    underlyingPrice,
    capital: underlyingPrice * 100,
    riskTolerancePct: 0.05,
    requestedAt: new Date().toISOString(),
    legs: [{ type: "put", position: "long", strike: putStrike, premium, expiry: "2025-12-19" }],
    ...overrides,
  };
}

describe("analyzeProtectivePut", () => {
  describe("break-even price", () => {
    it("OTM put: breakEven = currentPrice + premium", () => {
      const contract = makeContract({ underlyingPrice: 100 });
      const result = analyzeProtectivePut(contract);
      const premium = contract.legs[0].premium;
      expect(result.riskMetrics.breakEvenPrice).toBeCloseTo(100 + premium, 4);
    });

    it("ATM put (strike = price): breakEven = currentPrice + premium", () => {
      const underlyingPrice = 95;
      const premium = estimateOptionPremium("put", 95, 0.25, 90, underlyingPrice);
      const contract = makeContract({
        underlyingPrice,
        legs: [{ type: "put", position: "long", strike: 95, premium, expiry: "2025-12-19" }],
      });
      const result = analyzeProtectivePut(contract);
      expect(result.riskMetrics.breakEvenPrice).toBeCloseTo(underlyingPrice + premium, 4);
    });

    it("ITM put (strike > price): breakEven = currentPrice + premium", () => {
      const underlyingPrice = 88;
      const premium = estimateOptionPremium("put", 95, 0.25, 90, underlyingPrice);
      const contract = makeContract({
        underlyingPrice,
        legs: [{ type: "put", position: "long", strike: 95, premium, expiry: "2025-12-19" }],
      });
      const result = analyzeProtectivePut(contract);
      expect(result.riskMetrics.breakEvenPrice).toBeCloseTo(underlyingPrice + premium, 4);
    });
  });

  describe("stop-loss price", () => {
    it("riskTolerancePct=0 → buffer=3%, stopLoss = putStrike * 0.97, STOP_LOSS_TRIGGERED fires", () => {
      // currentPrice=90, putStrike=95, riskTolerancePct=0
      // buffer = 0.03, stopLossPrice = 95 * 0.97 = 92.15 > 90 → alert triggers ✅
      const underlyingPrice = 90;
      const putStrike = 95;
      const premium = estimateOptionPremium("put", putStrike, 0.25, 90, underlyingPrice);
      const contract = makeContract({
        underlyingPrice,
        riskTolerancePct: 0,
        legs: [{ type: "put", position: "long", strike: putStrike, premium, expiry: "2025-12-19" }],
      });
      const result = analyzeProtectivePut(contract);

      expect(result.riskMetrics.stopLossPrice).toBeCloseTo(putStrike * 0.97, 4);
      expect(result.alerts.some((a) => a.code === "STOP_LOSS_TRIGGERED")).toBe(true);
    });

    it("riskTolerancePct=0.3 → buffer=10%, stopLoss = putStrike * 0.90, STOP_LOSS_TRIGGERED does NOT fire", () => {
      // currentPrice=90, putStrike=95, riskTolerancePct=0.3
      // buffer = clamp(0.15, 0.01, 0.10) = 0.10, stopLossPrice = 95 * 0.90 = 85.5 < 90 → no alert
      const underlyingPrice = 90;
      const putStrike = 95;
      const premium = estimateOptionPremium("put", putStrike, 0.25, 90, underlyingPrice);
      const contract = makeContract({
        underlyingPrice,
        riskTolerancePct: 0.3,
        legs: [{ type: "put", position: "long", strike: putStrike, premium, expiry: "2025-12-19" }],
      });
      const result = analyzeProtectivePut(contract);

      expect(result.riskMetrics.stopLossPrice).toBeCloseTo(putStrike * 0.90, 4);
      expect(result.alerts.some((a) => a.code === "STOP_LOSS_TRIGGERED")).toBe(false);
    });
  });

  describe("max profit and loss", () => {
    it("maxProfit is Infinity for pure protection strategy", () => {
      const result = analyzeProtectivePut(makeContract());
      expect(result.maxProfit).toBe(Infinity);
    });

    it("maxLoss = max(0, currentPrice - putStrike + premium) * shares", () => {
      const underlyingPrice = 100;
      const putStrike = 95;
      const premium = estimateOptionPremium("put", putStrike, 0.25, 90, underlyingPrice);
      const contract = makeContract({ underlyingPrice });
      const result = analyzeProtectivePut(contract);
      const expected = Math.max(0, underlyingPrice - putStrike + premium) * 100;
      expect(result.maxLoss).toBeCloseTo(expected, 2);
    });
  });

  describe("alerts", () => {
    it("MARRIED_PUT_BASIS_CHECK fires for kind=married_put", () => {
      const contract = makeContract({ kind: "married_put" });
      const result = analyzeProtectivePut(contract);
      expect(result.alerts.some((a) => a.code === "MARRIED_PUT_BASIS_CHECK")).toBe(true);
    });

    it("STOP_LOSS_NEAR_STRIKE fires when price is within 3% of strike", () => {
      const putStrike = 95;
      const underlyingPrice = 95; // exactly at strike → triggers near_strike
      const premium = estimateOptionPremium("put", putStrike, 0.25, 90, underlyingPrice);
      const contract = makeContract({
        underlyingPrice,
        riskTolerancePct: 0.3, // large buffer so TRIGGERED doesn't fire
        legs: [{ type: "put", position: "long", strike: putStrike, premium, expiry: "2025-12-19" }],
      });
      const result = analyzeProtectivePut(contract);
      expect(result.alerts.some((a) => a.code === "STOP_LOSS_NEAR_STRIKE")).toBe(true);
    });
  });
});
