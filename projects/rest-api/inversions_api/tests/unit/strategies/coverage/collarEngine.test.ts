import { describe, expect, it } from "vitest";
import { analyzeCollar } from "../../../../src/modules/strategies/coverage/collarEngine";
import type { CoverageStrategyContract } from "../../../../src/modules/strategies/coverage/coverageStrategyContract";

function makeCollarContract(overrides: Partial<CoverageStrategyContract> = {}): CoverageStrategyContract {
  return {
    strategyId: "test-collar-1",
    kind: "collar_put",
    ticker: "TEST",
    shares: 100,
    underlyingPrice: 100,
    capital: 10_000,
    riskTolerancePct: 0.05,
    requestedAt: new Date().toISOString(),
    legs: [
      { type: "put", position: "long", strike: 90, premium: 2.0, expiry: "2025-12-19" },
      { type: "call", position: "short", strike: 110, premium: 2.0, expiry: "2025-12-19" },
    ],
    ...overrides,
  };
}

describe("analyzeCollar — net credit case", () => {
  // callPremium=9.26, putPremium=0.74, currentPrice=450.50, callStrike=460, shares=100
  // netPremiumPerShare = putPremium - callPremium = 0.74 - 9.26 = -8.52 (net credit)
  // maxProfit = max(0, callStrike - currentPrice - netPremiumPerShare) * shares
  //           = max(0, 460 - 450.50 - (-8.52)) * 100 = max(0, 18.02) * 100 = 1802
  // protectionCeilingPrice = callStrike - netPremiumPerShare = 460 - (-8.52) = 468.52

  const putPremium = 0.74;
  const callPremium = 9.26;
  const currentPrice = 450.50;
  const callStrike = 460;
  const putStrike = 430;
  const shares = 100;

  const contract = makeCollarContract({
    underlyingPrice: currentPrice,
    shares,
    capital: currentPrice * shares,
    riskTolerancePct: 0.05,
    legs: [
      { type: "put", position: "long", strike: putStrike, premium: putPremium, expiry: "2025-12-19" },
      { type: "call", position: "short", strike: callStrike, premium: callPremium, expiry: "2025-12-19" },
    ],
  });

  it("netPremiumPerShare is negative (net credit ≈ -8.52)", () => {
    const result = analyzeCollar(contract);
    expect(result.riskMetrics.netPremiumPerShare).toBeCloseTo(-8.52, 2);
  });

  it("protectionCeilingPrice = callStrike - netPremiumPerShare ≈ 468.52", () => {
    const result = analyzeCollar(contract);
    expect(result.riskMetrics.protectionCeilingPrice).toBeCloseTo(468.52, 1);
  });

  it("maxProfit computed by engine formula: (callStrike - currentPrice - netPremium) * shares", () => {
    const result = analyzeCollar(contract);
    const expectedNetPremiumPerShare = putPremium - callPremium; // -8.52
    const expectedMaxProfit = Math.max(0, callStrike - currentPrice - expectedNetPremiumPerShare) * shares;
    expect(result.maxProfit).toBeCloseTo(expectedMaxProfit, 0);
  });

  it("maxProfit is positive in net credit collar", () => {
    const result = analyzeCollar(contract);
    expect(result.maxProfit).toBeGreaterThan(0);
  });

  it("maxLoss = max(0, currentPrice - putStrike + netPremiumPerShare) * shares", () => {
    const result = analyzeCollar(contract);
    const netPrem = putPremium - callPremium;
    const expected = Math.max(0, currentPrice - putStrike + netPrem) * shares;
    expect(result.maxLoss).toBeCloseTo(expected, 0);
  });

  it("stopLossLowPrice and stopLossHighPrice are set", () => {
    const result = analyzeCollar(contract);
    expect(result.riskMetrics.stopLossLowPrice).toBeDefined();
    expect(result.riskMetrics.stopLossHighPrice).toBeDefined();
    expect(result.riskMetrics.stopLossLowPrice!).toBeLessThan(putStrike);
    expect(result.riskMetrics.stopLossHighPrice!).toBeGreaterThan(callStrike);
  });

  it("stopLossPrice equals stopLossLowPrice for backward compatibility", () => {
    const result = analyzeCollar(contract);
    expect(result.riskMetrics.stopLossPrice).toBe(result.riskMetrics.stopLossLowPrice);
  });
});

describe("analyzeCollar — net debit case", () => {
  // putPremium=5.0, callPremium=2.0 → netPremiumPerShare = 3.0 (debit: we pay more than we receive)
  const putPremium = 5.0;
  const callPremium = 2.0;
  const currentPrice = 100;
  const callStrike = 110;
  const putStrike = 90;
  const shares = 100;
  const riskTolerancePct = 0.05;

  const contract = makeCollarContract({
    underlyingPrice: currentPrice,
    shares,
    riskTolerancePct,
    legs: [
      { type: "put", position: "long", strike: putStrike, premium: putPremium, expiry: "2025-12-19" },
      { type: "call", position: "short", strike: callStrike, premium: callPremium, expiry: "2025-12-19" },
    ],
  });

  it("netPremiumPerShare is positive (net debit = 3.0)", () => {
    const result = analyzeCollar(contract);
    expect(result.riskMetrics.netPremiumPerShare).toBeCloseTo(3.0, 4);
  });

  it("maxProfit = (callStrike - currentPrice - netDebit) * shares = 700", () => {
    const result = analyzeCollar(contract);
    // max(0, 110 - 100 - 3.0) * 100 = 700
    expect(result.maxProfit).toBeCloseTo(700, 0);
  });

  it("maxLoss = (currentPrice - putStrike + netDebit) * shares = 1300", () => {
    const result = analyzeCollar(contract);
    // max(0, 100 - 90 + 3.0) * 100 = 1300
    expect(result.maxLoss).toBeCloseTo(1300, 0);
  });

  it("stopLossLowPrice = putStrike * (1 - buffer)", () => {
    const result = analyzeCollar(contract);
    // buffer = clamp(0.05 * 0.4, 0.02, 0.08) = 0.02
    const expectedBuffer = Math.min(Math.max(riskTolerancePct * 0.4, 0.02), 0.08);
    const expectedLow = putStrike * (1 - expectedBuffer);
    expect(result.riskMetrics.stopLossLowPrice).toBeCloseTo(expectedLow, 2);
  });

  it("stopLossHighPrice = callStrike * (1 + buffer)", () => {
    const result = analyzeCollar(contract);
    const expectedBuffer = Math.min(Math.max(riskTolerancePct * 0.4, 0.02), 0.08);
    const expectedHigh = callStrike * (1 + expectedBuffer);
    expect(result.riskMetrics.stopLossHighPrice).toBeCloseTo(expectedHigh, 2);
  });
});

describe("analyzeCollar — alerts", () => {
  it("COLLAR_CALL_BELOW_MARKET fires when callStrike ≤ currentPrice", () => {
    const contract = makeCollarContract({
      underlyingPrice: 115,
      legs: [
        { type: "put", position: "long", strike: 100, premium: 2.0, expiry: "2025-12-19" },
        { type: "call", position: "short", strike: 110, premium: 3.0, expiry: "2025-12-19" },
      ],
    });
    const result = analyzeCollar(contract);
    expect(result.alerts.some((a) => a.code === "COLLAR_CALL_BELOW_MARKET")).toBe(true);
  });

  it("COLLAR_LOWER_BAND_BROKEN fires when price ≤ stopLossLow", () => {
    // riskTolerancePct=0 → buffer=4%, putStrike=95 → stopLossLow=91.2
    // underlyingPrice=85 < 91.2 → alert fires
    const contract = makeCollarContract({
      underlyingPrice: 85,
      riskTolerancePct: 0,
      legs: [
        { type: "put", position: "long", strike: 95, premium: 2.0, expiry: "2025-12-19" },
        { type: "call", position: "short", strike: 110, premium: 1.0, expiry: "2025-12-19" },
      ],
    });
    const result = analyzeCollar(contract);
    expect(result.alerts.some((a) => a.code === "COLLAR_LOWER_BAND_BROKEN")).toBe(true);
  });

  it("no alert when price is comfortably inside the bands", () => {
    const result = analyzeCollar(makeCollarContract());
    const critical = result.alerts.filter((a) => a.severity === "critical");
    expect(critical).toHaveLength(0);
  });
});

describe("analyzeCollar — structure", () => {
  it("kind is collar_put", () => {
    expect(analyzeCollar(makeCollarContract()).kind).toBe("collar_put");
  });

  it("riskProfile is limited", () => {
    expect(analyzeCollar(makeCollarContract()).riskMetrics.riskProfile).toBe("limited");
  });

  it("payoffPoints has 21 entries", () => {
    expect(analyzeCollar(makeCollarContract()).payoffPoints).toHaveLength(21);
  });
});
