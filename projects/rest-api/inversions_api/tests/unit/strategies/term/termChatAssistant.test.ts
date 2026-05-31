/**
 * Tests de termChatAssistant.ts — T202 (cobertura >=80%)
 * Cobertura: buildPurpose, buildRiskProfile, buildUsageConditions,
 * buildScenarioSummary, extractMetrics, disclaimer RNF-001.
 * Modulo bajo prueba: TermChatAssistant
 */
import { describe, it, expect } from "vitest";
import { TermChatAssistant } from "../../../../src/modules/strategies/term/termChatAssistant";
import type { CalendarSpreadResult } from "../../../../src/modules/strategies/term/calendarSpreadEngine";
import type { RiskProfile } from "../../../../src/modules/strategies/term/diagonalSpreadEngine";
import type { SimulationResult } from "../../../../src/modules/strategies/term/termSimulationEngine";
import type { RiskAnalysis } from "../../../../src/modules/strategies/term/termRiskEngine";

const mockCalendarResult: CalendarSpreadResult = {
  shortDte: 30,
  longDte: 90,
  shortTheta: -5,
  longTheta: -3,
  netTheta: -2,
  greeks: { delta: 0, gamma: 0, theta: -2, vega: 0 },
  scenarios: [
    { underlyingPrice: 100, strategyValue: 3, pnl: 0, theta: -2, impliedVolatility: 0.2 },
    { underlyingPrice: 110, strategyValue: 2, pnl: -1, theta: -1.5, impliedVolatility: 0.25 },
  ],
  stressTests: [],
};

const mockDiagonalResult: RiskProfile = {
  shortDte: 30,
  longDte: 90,
  greeks: { delta: 0.15, gamma: -0.02, theta: -3.5, vega: 8.2 },
  directionalProfile: "bullish",
  adjustmentWindow: null,
  scenarios: [],
  thetaDecayProfile: [],
  vegaShockProfile: [],
  stressTests: [],
};

const mockSimResult: SimulationResult = {
  strategy: "calendar",
  optionStyle: "call",
  deterministic: [
    { label: "Price-10%_IV-10%", price: 90, ivShock: -0.1, dteRemaining: 30, strategyValue: 0.5, pnl: -2.5 },
    { label: "Price+0%_IV+0%", price: 100, ivShock: 0, dteRemaining: 30, strategyValue: 3, pnl: 0 },
    { label: "Price+10%_IV+10%", price: 110, ivShock: 0.1, dteRemaining: 30, strategyValue: 5, pnl: 2 },
  ],
  monteCarlo: {
    iterations: 1000,
    distribution: "normal",
    meanPnl: 0.5,
    medianPnl: 0.3,
    percentile5: -2.1,
    percentile95: 3.2,
    var95: -2.1,
    pnlDistribution: [],
  },
  backtest: null,
  timestamp: new Date("2025-01-01"),
};

const mockRiskAnalysis: RiskAnalysis = {
  limitsViolation: true,
  violations: ["Theta limit exceeded", "Concentration limit breached"],
  earlyAssignmentRisk: { isAtRisk: true, probability: 0.35, reason: "Short leg is deep ITM", leg: { strike: 100, expiration: new Date("2025-02-01"), premium: 3, contracts: 1, optionStyle: "call" } },
  stopLossRules: [],
  alerts: [],
  portfolioExposure: 0.3,
  thetaExposure: -2,
};

/** Tests de TermChatAssistant: constructor, getContext, explain, buildPurpose, buildRiskProfile, buildUsageConditions, buildScenarioSummary, extractMetrics, structuredOutput, disclaimer RNF-001 */
describe("TermChatAssistant", () => {
  /** Verifica que el constructor acepta cualquier combinacion de resultados */
  describe("constructor", () => {
    it("should accept calendar result", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, null, null);
      expect(chat).toBeInstanceOf(TermChatAssistant);
    });

    it("should accept diagonal result", () => {
      const chat = new TermChatAssistant(null, mockDiagonalResult, null, null);
      expect(chat).toBeInstanceOf(TermChatAssistant);
    });

    it("should accept all results", () => {
      const chat = new TermChatAssistant(mockCalendarResult, mockDiagonalResult, mockSimResult, mockRiskAnalysis);
      expect(chat).toBeInstanceOf(TermChatAssistant);
    });

    it("should accept no results", () => {
      const chat = new TermChatAssistant(null, null, null, null);
      expect(chat).toBeInstanceOf(TermChatAssistant);
    });
  });

  /** Tests de getContext: calendar, diagonal, preferencia calendar sobre diagonal, null sin datos */
  describe("getContext", () => {
    it("should return context from calendar result", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, null, null);
      const ctx = chat.getContext();
      expect(ctx).not.toBeNull();
      expect(ctx!.strategyType).toBe("calendar");
      expect(ctx!.shortDte).toBe(30);
      expect(ctx!.netTheta).toBe(-2);
    });

    it("should return context from diagonal result", () => {
      const chat = new TermChatAssistant(null, mockDiagonalResult, null, null);
      const ctx = chat.getContext();
      expect(ctx).not.toBeNull();
      expect(ctx!.strategyType).toBe("diagonal");
      expect(ctx!.netDelta).toBe(0.15);
      expect(ctx!.directionalProfile).toBe("bullish");
    });

    it("should prefer calendar over diagonal when both present", () => {
      const chat = new TermChatAssistant(mockCalendarResult, mockDiagonalResult, null, null);
      const ctx = chat.getContext();
      expect(ctx!.strategyType).toBe("calendar");
    });

    it("should return null when no data", () => {
      const chat = new TermChatAssistant(null, null, null, null);
      expect(chat.getContext()).toBeNull();
    });
  });

  /** Tests de explain: purpose, risk profile, usage conditions, disclaimer, structured output */
  describe("explain", () => {
    it("should generate explanation with purpose", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, null, null);
      const explanation = chat.explain();
      expect(explanation.purpose.length).toBeGreaterThan(0);
      expect(explanation.purpose).toContain("Calendar Spread");
    });

    it("should include risk profile", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, null, null);
      const explanation = chat.explain();
      expect(explanation.riskProfile.length).toBeGreaterThan(0);
      expect(explanation.riskProfile).toContain("theta");
    });

    it("should include usage conditions", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, null, null);
      const explanation = chat.explain();
      expect(explanation.usageConditions.length).toBeGreaterThan(0);
    });

    it("should include disclaimer (RNF-001)", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, null, null);
      const explanation = chat.explain();
      expect(explanation.disclaimer).toContain("financial advice");
      expect(explanation.disclaimer).toContain("informational");
    });

    it("should include structured output", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, null, null);
      const explanation = chat.explain();
      expect(explanation.structuredOutput).toHaveProperty("purpose");
      expect(explanation.structuredOutput).toHaveProperty("conditions");
      expect(explanation.structuredOutput).toHaveProperty("risks");
      expect(explanation.structuredOutput).toHaveProperty("metrics");
    });

    it("should include disclaimer that it does not authorize execution", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, null, null);
      const explanation = chat.explain();
      expect(explanation.disclaimer).toContain("does not constitute financial advice");
      expect(explanation.disclaimer).toContain("informational");
    });
  });

  /** Tests de buildPurpose: calendar, diagonal, sin datos */
  describe("buildPurpose", () => {
    it("should describe calendar spread purpose", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, null, null);
      const exp = chat.explain();
      expect(exp.purpose).toContain("same strike price");
      expect(exp.purpose).toContain("time decay");
    });

    it("should describe diagonal spread purpose", () => {
      const chat = new TermChatAssistant(null, mockDiagonalResult, null, null);
      const exp = chat.explain();
      expect(exp.purpose).toContain("different strike prices");
      expect(exp.purpose).toContain("bullish");
    });

    it("should handle no data", () => {
      const chat = new TermChatAssistant(null, null, null, null);
      const exp = chat.explain();
      expect(exp.purpose).toBe("No strategy data available.");
    });
  });

  /** Tests de buildRiskProfile: theta, delta, risk analysis, early assignment, sin datos */
  describe("buildRiskProfile", () => {
    it("should describe theta in risk profile for calendar", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, null, null);
      const exp = chat.explain();
      expect(exp.riskProfile).toContain("Net theta");
      expect(exp.riskProfile).toContain("loses value");
    });

    it("should include delta when non-zero", () => {
      const chat = new TermChatAssistant(null, mockDiagonalResult, null, null);
      const exp = chat.explain();
      expect(exp.riskProfile).toContain("Net delta");
      expect(exp.riskProfile).toContain("0.150");
    });

    it("should include risk analysis when provided", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, null, mockRiskAnalysis);
      const exp = chat.explain();
      expect(exp.riskProfile).toContain("Risk limit violations");
      expect(exp.riskProfile).toContain("Theta limit exceeded");
    });

    it("should include early assignment risk when at risk", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, null, mockRiskAnalysis);
      const exp = chat.explain();
      expect(exp.riskProfile).toContain("Early assignment risk");
    });

    it("should handle no data", () => {
      const chat = new TermChatAssistant(null, null, null, null);
      const exp = chat.explain();
      expect(exp.riskProfile).toBe("No strategy data available.");
    });
  });

  /** Tests de buildUsageConditions: calendar, diagonal, condiciones comunes, sin datos */
  describe("buildUsageConditions", () => {
    it("should include calendar-specific conditions", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, null, null);
      const exp = chat.explain();
      expect(exp.usageConditions).toContain("low to moderate volatility");
      expect(exp.usageConditions).toContain("earnings plays");
    });

    it("should include diagonal-specific conditions", () => {
      const chat = new TermChatAssistant(null, mockDiagonalResult, null, null);
      const exp = chat.explain();
      expect(exp.usageConditions).toContain("bullish");
      expect(exp.usageConditions).toContain("moderate to high volatility");
    });

    it("should include common conditions (rolling, monitoring)", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, null, null);
      const exp = chat.explain();
      expect(exp.usageConditions).toContain("early assignment");
      expect(exp.usageConditions).toContain("rolling the short leg");
    });

    it("should handle no data", () => {
      const chat = new TermChatAssistant(null, null, null, null);
      const exp = chat.explain();
      expect(exp.usageConditions).toBe("No strategy data available.");
    });
  });

  /** Tests de buildScenarioSummary: deterministic, Monte Carlo, sin datos, sin Price label, solo MC */
  describe("buildScenarioSummary", () => {
    it("should return deterministic scenario summary", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, mockSimResult, null);
      const exp = chat.explain();
      expect(exp.scenarioSummary).toContain("Deterministic scenarios");
    });

    it("should include Monte Carlo data when available", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, mockSimResult, null);
      const exp = chat.explain();
      expect(exp.scenarioSummary).toContain("Monte Carlo");
      expect(exp.scenarioSummary).toContain("1000 iterations");
    });

    it("should handle no simulation data", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, null, null);
      const exp = chat.explain();
      expect(exp.scenarioSummary).toBe("No simulation data available.");
    });

    it("should handle empty deterministic scenarios", () => {
      const emptySim: SimulationResult = { strategy: "calendar", optionStyle: "call", deterministic: [], monteCarlo: null, backtest: null, timestamp: new Date("2025-01-01") };
      const chat = new TermChatAssistant(mockCalendarResult, null, emptySim, null);
      const exp = chat.explain();
      expect(exp.scenarioSummary).toBe("No simulation data available.");
    });

    it("should handle deterministic scenarios without Price label", () => {
      const noPriceSim: SimulationResult = {
        strategy: "calendar",
        optionStyle: "call",
        deterministic: [
          { label: "TimeStep_15d", price: 100, ivShock: 0, dteRemaining: 15, strategyValue: 3, pnl: 0 },
        ],
        monteCarlo: null,
        backtest: null,
        timestamp: new Date("2025-01-01"),
      };
      const chat = new TermChatAssistant(mockCalendarResult, null, noPriceSim, null);
      const exp = chat.explain();
      expect(exp.scenarioSummary).toBe("No simulation data available.");
    });

    it("should return summary with Monte Carlo only (no deterministic with Price)", () => {
      const mcOnlySim: SimulationResult = {
        strategy: "calendar",
        optionStyle: "call",
        deterministic: [
          { label: "TimeStep_15d", price: 100, ivShock: 0, dteRemaining: 15, strategyValue: 3, pnl: 0 },
        ],
        monteCarlo: {
          iterations: 500, distribution: "lognormal",
          meanPnl: 1.2, medianPnl: 0.8, percentile5: -1.5, percentile95: 3.8, var95: -1.5,
          pnlDistribution: [],
        },
        backtest: null,
        timestamp: new Date("2025-01-01"),
      };
      const chat = new TermChatAssistant(mockCalendarResult, null, mcOnlySim, null);
      const exp = chat.explain();
      expect(exp.scenarioSummary).toContain("Monte Carlo");
      expect(exp.scenarioSummary).not.toContain("Deterministic");
    });
  });

  /** Tests de extractMetrics: calendar, diagonal, Monte Carlo, N/A, empty context, rounding */
  describe("extractMetrics", () => {
    it("should extract metrics for calendar strategy", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, null, null);
      const exp = chat.explain();
      expect(exp.structuredOutput.metrics["Strategy Type"]).toBe("calendar");
      expect(exp.structuredOutput.metrics["Short DTE"]).toBe(30);
      expect(exp.structuredOutput.metrics["Net Theta"]).toBe(-2);
    });

    it("should extract metrics for diagonal strategy", () => {
      const chat = new TermChatAssistant(null, mockDiagonalResult, null, null);
      const exp = chat.explain();
      expect(exp.structuredOutput.metrics["Strategy Type"]).toBe("diagonal");
      expect(exp.structuredOutput.metrics["Net Delta"]).toBe(0.15);
    });

    it("should include Monte Carlo metrics when available", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, mockSimResult, null);
      const exp = chat.explain();
      expect(exp.structuredOutput.metrics["Monte Carlo Iterations"]).toBe(1000);
      expect(exp.structuredOutput.metrics["VaR (95%)"]).toBe(-2.1);
    });

    it("should return N/A for Monte Carlo when not available", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, null, null);
      const exp = chat.explain();
      expect(exp.structuredOutput.metrics["Monte Carlo Iterations"]).toBe("N/A");
      expect(exp.structuredOutput.metrics["VaR (95%)"]).toBe("N/A");
    });

    it("should return empty object when no context", () => {
      const chat = new TermChatAssistant(null, null, null, null);
      const exp = chat.explain();
      expect(exp.structuredOutput.metrics).toEqual({});
    });

    it("should round delta to 3 decimal places", () => {
      const preciseDelta: RiskProfile = {
        ...mockDiagonalResult,
        greeks: { ...mockDiagonalResult.greeks, delta: 0.123456 },
      };
      const chat = new TermChatAssistant(null, preciseDelta, null, null);
      const exp = chat.explain();
      expect(exp.structuredOutput.metrics["Net Delta"]).toBe(0.123);
    });
  });

  /** Tests del structuredOutput: purpose, conditions array, risks array */
  describe("structuredOutput", () => {
    it("should have purpose in structured output", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, null, null);
      const exp = chat.explain();
      expect(exp.structuredOutput.purpose).toContain("CALL");
    });

    it("should have conditions array in structured output", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, null, null);
      const exp = chat.explain();
      expect(Array.isArray(exp.structuredOutput.conditions)).toBe(true);
      expect(exp.structuredOutput.conditions.length).toBeGreaterThan(0);
    });

    it("should have risks array in structured output", () => {
      const chat = new TermChatAssistant(mockCalendarResult, null, null, null);
      const exp = chat.explain();
      expect(Array.isArray(exp.structuredOutput.risks)).toBe(true);
      expect(exp.structuredOutput.risks.length).toBeGreaterThan(0);
    });
  });
});
