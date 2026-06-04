/**
 * Tests de termReportEngine.ts — T203 (cobertura branch >=80%)
 * Cobertura: curva de payoff, superficie tiempo-precio-IV, metricas de riesgo,
 * reporte estructurado para calendar y diagonal, casos borde (datos nulos/parciales).
 * Modulo bajo prueba: TermReportEngine
 */
import { describe, it, expect } from "vitest";
import { TermReportEngine } from "../../../../src/modules/strategies/term/termReportEngine";
import type { CalendarSpreadResult, CalendarStressTest } from "../../../../src/modules/strategies/term/calendarSpreadEngine";
import type { RiskProfile, DiagonalStressTest } from "../../../../src/modules/strategies/term/diagonalSpreadEngine";
import type { SimulationResult, MonteCarloResult } from "../../../../src/modules/strategies/term/termSimulationEngine";
import type { RiskAnalysis } from "../../../../src/modules/strategies/term/termRiskEngine";

const mockCalendarResult: CalendarSpreadResult = {
  shortDte: 30,
  longDte: 90,
  shortTheta: -5,
  longTheta: -3,
  netTheta: -2,
  greeks: { delta: 0, gamma: 0, theta: -2, vega: 0 },
  scenarios: [
    { underlyingPrice: 80, strategyValue: 2, pnl: -1, theta: -2, impliedVolatility: 0.2 },
    { underlyingPrice: 90, strategyValue: 2.5, pnl: -0.5, theta: -2.5, impliedVolatility: 0.2 },
    { underlyingPrice: 100, strategyValue: 3, pnl: 0, theta: -3, impliedVolatility: 0.2 },
    { underlyingPrice: 110, strategyValue: 2.5, pnl: -0.5, theta: -2.5, impliedVolatility: 0.2 },
    { underlyingPrice: 120, strategyValue: 2, pnl: -1, theta: -2, impliedVolatility: 0.2 },
  ],
  stressTests: [],
};

const mockDiagonalResult: RiskProfile = {
  shortDte: 30,
  longDte: 90,
  greeks: { delta: 0.15, gamma: -0.02, theta: -3.5, vega: 8.2 },
  directionalProfile: "bullish",
  adjustmentWindow: null,
  scenarios: [
    { underlyingPrice: 90, strategyValue: 1, pnl: -2, greeks: { delta: 0.1, gamma: -0.01, theta: -2, vega: 5 } },
    { underlyingPrice: 100, strategyValue: 3, pnl: 0, greeks: { delta: 0.15, gamma: -0.02, theta: -3.5, vega: 8 } },
    { underlyingPrice: 110, strategyValue: 5, pnl: 2, greeks: { delta: 0.2, gamma: -0.03, theta: -4, vega: 10 } },
  ],
  thetaDecayProfile: [],
  vegaShockProfile: [],
  stressTests: [],
};

const mockSimResult: SimulationResult = {
  strategy: "calendar",
  optionStyle: "call",
  deterministic: [
    { label: "Price-10%_IV-10%", price: 90, ivShock: -0.1, dteRemaining: 30, strategyValue: 1, pnl: -2 },
    { label: "Price+0%_IV+0%", price: 100, ivShock: 0, dteRemaining: 30, strategyValue: 3, pnl: 0 },
  ],
  monteCarlo: null,
  backtest: { sharpeRatio: 1.5, sortinoRatio: 1.2, maxDrawdown: 0.15, totalReturn: 0.25, winRate: 0.6, totalTrades: 10, returns: [0.1, -0.05, 0.2], equityCurve: [100, 110, 105, 125] },
  timestamp: new Date("2025-01-01"),
};

const mockRiskAnalysis: RiskAnalysis = {
  limitsViolation: true,
  violations: ["Theta limit exceeded"],
  earlyAssignmentRisk: null,
  stopLossRules: [
    { type: "fixed", value: 0.15, currentDrawdown: 0.12, triggered: false, message: "Drawdown limit" },
  ],
  alerts: [],
  portfolioExposure: 0.3,
  thetaExposure: -2,
};

/** Tests de TermReportEngine: constructor, generatePayoffCurve, generateSurface, calculateRiskMetrics, generateReport, toJson */
describe("TermReportEngine", () => {
  /** Verifica que el constructor acepta calendar, diagonal o null */
  describe("constructor", () => {
    it("should accept calendar result", () => {
      const engine = new TermReportEngine(mockCalendarResult, null, null, null);
      expect(engine).toBeInstanceOf(TermReportEngine);
    });

    it("should accept diagonal result", () => {
      const engine = new TermReportEngine(null, mockDiagonalResult, null, null);
      expect(engine).toBeInstanceOf(TermReportEngine);
    });

    it("should accept null results", () => {
      const engine = new TermReportEngine(null, null, null, null);
      expect(engine).toBeInstanceOf(TermReportEngine);
    });
  });

  /** Tests de generatePayoffCurve: calendar, diagonal, preferencia calendar, sin datos */
  describe("generatePayoffCurve", () => {
    it("should generate payoff curve from calendar result", () => {
      const engine = new TermReportEngine(mockCalendarResult, null, null, null);
      const curve = engine.generatePayoffCurve();
      expect(curve.length).toBe(5);
      expect(curve[0]).toHaveProperty("price");
      expect(curve[0]).toHaveProperty("payoff");
      expect(curve[0]).toHaveProperty("pnl");
    });

    it("should generate payoff curve from diagonal result", () => {
      const engine = new TermReportEngine(null, mockDiagonalResult, null, null);
      const curve = engine.generatePayoffCurve();
      expect(curve.length).toBe(3);
      expect(curve[0].price).toBe(90);
    });

    it("should prefer calendar over diagonal when both present", () => {
      const engine = new TermReportEngine(mockCalendarResult, mockDiagonalResult, null, null);
      const curve = engine.generatePayoffCurve();
      expect(curve.length).toBe(5);
    });

    it("should return empty array when no results", () => {
      const engine = new TermReportEngine(null, null, null, null);
      const curve = engine.generatePayoffCurve();
      expect(curve).toEqual([]);
    });
  });

  /** Tests de generateSurface: calendar, null sin calendar, empty scenarios, precios duplicados */
  describe("generateSurface", () => {
    it("should generate time-price-IV surface from calendar result", () => {
      const engine = new TermReportEngine(mockCalendarResult, null, null, null);
      const surface = engine.generateSurface();
      expect(surface).not.toBeNull();
      expect(surface!.priceAxis.length).toBeGreaterThan(0);
      expect(surface!.dteAxis).toEqual([30, 90]);
      expect(surface!.pnlMatrix.length).toBe(2);
      expect(surface!.ivMatrix.length).toBe(2);
    });

    it("should return null when no calendar result", () => {
      const engine = new TermReportEngine(null, null, null, null);
      expect(engine.generateSurface()).toBeNull();
    });

    it("should return null when calendar has empty scenarios", () => {
      const emptyCal: CalendarSpreadResult = {
        shortDte: 30, longDte: 90, shortTheta: 0, longTheta: 0, netTheta: 0, greeks: { delta: 0, gamma: 0, theta: 0, vega: 0 }, scenarios: [], stressTests: [],
      };
      const engine = new TermReportEngine(emptyCal, null, null, null);
      expect(engine.generateSurface()).toBeNull();
    });

    it("should handle duplicate prices in price axis", () => {
      const dupCal: CalendarSpreadResult = {
        shortDte: 30,
        longDte: 90,
        shortTheta: -5,
        longTheta: -3,
        netTheta: -2,
        greeks: { delta: 0, gamma: 0, theta: -2, vega: 0 },
        scenarios: [
          { underlyingPrice: 100, strategyValue: 3, pnl: 0, theta: -3, impliedVolatility: 0.2 },
          { underlyingPrice: 100, strategyValue: 3, pnl: 0, theta: -3, impliedVolatility: 0.2 },
          { underlyingPrice: 110, strategyValue: 2, pnl: -1, theta: -2, impliedVolatility: 0.25 },
        ],
        stressTests: [],
      };
      const engine = new TermReportEngine(dupCal, null, null, null);
      const surface = engine.generateSurface();
      expect(surface!.priceAxis.length).toBe(2);
    });
  });

  /** Tests de calculateRiskMetrics: calendar, diagonal, Sharpe de backtest, maxDrawdown de riskAnalysis, zeros sin datos, PoP calendar/diagonal */
  describe("calculateRiskMetrics", () => {
    it("should return risk metrics from calendar result", () => {
      const engine = new TermReportEngine(mockCalendarResult, null, null, null);
      const metrics = engine.calculateRiskMetrics();
      expect(metrics).toHaveProperty("netDelta");
      expect(metrics).toHaveProperty("netGamma");
      expect(metrics).toHaveProperty("netTheta");
      expect(metrics).toHaveProperty("netVega");
      expect(metrics).toHaveProperty("probabilityOfProfit");
      expect(metrics).toHaveProperty("maxDrawdown");
      expect(metrics).toHaveProperty("sharpeRatio");
    });

    it("should return risk metrics from diagonal result", () => {
      const engine = new TermReportEngine(null, mockDiagonalResult, null, null);
      const metrics = engine.calculateRiskMetrics();
      expect(metrics.netDelta).toBe(0.15);
      expect(metrics.netGamma).toBe(-0.02);
      expect(metrics.netTheta).toBe(-3.5);
      expect(metrics.netVega).toBe(8.2);
    });

    it("should use backtest sharpeRatio when available", () => {
      const engine = new TermReportEngine(mockCalendarResult, null, mockSimResult, null);
      const metrics = engine.calculateRiskMetrics();
      expect(metrics.sharpeRatio).toBe(1.5);
    });

    it("should use riskAnalysis maxDrawdown when available", () => {
      const engine = new TermReportEngine(mockCalendarResult, null, null, mockRiskAnalysis);
      const metrics = engine.calculateRiskMetrics();
      expect(metrics.maxDrawdown).toBe(0.12);
    });

    it("should return zero maxDrawdown when no riskAnalysis", () => {
      const engine = new TermReportEngine(mockCalendarResult, null, null, null);
      const metrics = engine.calculateRiskMetrics();
      expect(metrics.maxDrawdown).toBe(0);
    });

    it("should return zero sharpeRatio when no simulation backtest", () => {
      const engine = new TermReportEngine(mockCalendarResult, null, null, null);
      const metrics = engine.calculateRiskMetrics();
      expect(metrics.sharpeRatio).toBe(0);
    });

    it("should handle riskAnalysis with multiple stopLossRules", () => {
      const multiRuleRisk: RiskAnalysis = {
        limitsViolation: true,
        violations: [],
        earlyAssignmentRisk: null,
        stopLossRules: [
          { type: "fixed", value: 0.1, currentDrawdown: 0.05, triggered: false, message: "Drawdown limit" },
          { type: "fixed", value: 0.15, currentDrawdown: 0.2, triggered: true, message: "Drawdown limit" },
        ],
        alerts: [],
        portfolioExposure: 0.3,
        thetaExposure: -2,
      };
      const engine = new TermReportEngine(mockCalendarResult, null, null, multiRuleRisk);
      const metrics = engine.calculateRiskMetrics();
      expect(metrics.maxDrawdown).toBe(0.2);
    });

    it("should use calendar probabilityOfProfit based on delta=0", () => {
      const engine = new TermReportEngine(mockCalendarResult, null, null, null);
      const metrics = engine.calculateRiskMetrics();
      expect(metrics.probabilityOfProfit).toBe(0.5);
    });

    it("should use diagonal probabilityOfProfit based on delta", () => {
      const engine = new TermReportEngine(null, mockDiagonalResult, null, null);
      const metrics = engine.calculateRiskMetrics();
      expect(metrics.probabilityOfProfit).toBeGreaterThan(0.5);
      expect(metrics.probabilityOfProfit).toBeLessThan(0.95);
    });

    it("should return zeros when no results", () => {
      const engine = new TermReportEngine(null, null, null, null);
      const metrics = engine.calculateRiskMetrics();
      expect(metrics.netDelta).toBe(0);
      expect(metrics.netTheta).toBe(0);
    });
  });

  /** Tests de generateReport: calendar, diagonal, unknown, deterministic scenarios, optionStyle put, surface null para diagonal */
  describe("generateReport", () => {
    it("should generate full structured report for calendar", () => {
      const engine = new TermReportEngine(mockCalendarResult, null, null, null);
      const report = engine.generateReport();
      expect(report.strategy).toBe("calendar");
      expect(report.payoffCurve.length).toBeGreaterThan(0);
      expect(report.generatedAt).toBeTruthy();
    });

    it("should generate full structured report for diagonal", () => {
      const engine = new TermReportEngine(null, mockDiagonalResult, null, null);
      const report = engine.generateReport();
      expect(report.strategy).toBe("diagonal");
      expect(report.optionStyle).toBe("call");
    });

    it("should generate report with unknown strategy when no results", () => {
      const engine = new TermReportEngine(null, null, null, null);
      const report = engine.generateReport();
      expect(report.strategy).toBe("unknown");
      expect(report.payoffCurve).toEqual([]);
    });

    it("should include deterministic scenarios in report", () => {
      const engine = new TermReportEngine(mockCalendarResult, null, mockSimResult, null);
      const report = engine.generateReport();
      expect(report.deterministic.length).toBe(2);
    });

    it("should return empty deterministic when no simulation", () => {
      const engine = new TermReportEngine(mockCalendarResult, null, null, null);
      const report = engine.generateReport();
      expect(report.deterministic).toEqual([]);
    });

    it("should set optionStyle to put for diagonal with negative delta", () => {
      const bearishDiagonal: RiskProfile = {
        ...mockDiagonalResult,
        greeks: { delta: -0.3, gamma: 0.01, theta: -2, vega: 5 },
      };
      const engine = new TermReportEngine(null, bearishDiagonal, null, null);
      const report = engine.generateReport();
      expect(report.optionStyle).toBe("put");
    });

    it("should return surface null for diagonal results", () => {
      const engine = new TermReportEngine(null, mockDiagonalResult, null, null);
      const report = engine.generateReport();
      expect(report.surface).toBeNull();
    });
  });

  /** Tests de toJson: serializa correctamente calendar y diagonal */
  describe("toJson", () => {
    it("should return valid JSON string from calendar result", () => {
      const engine = new TermReportEngine(mockCalendarResult, null, null, null);
      const json = engine.toJson();
      const parsed = JSON.parse(json);
      expect(parsed.strategy).toBe("calendar");
    });

    it("should return valid JSON string from diagonal result", () => {
      const engine = new TermReportEngine(null, mockDiagonalResult, null, null);
      const json = engine.toJson();
      const parsed = JSON.parse(json);
      expect(parsed.strategy).toBe("diagonal");
    });
  });

  /** Tests de generateStressTestSummary: con stress tests, sin stress tests */
  describe("generateStressTestSummary", () => {
    it("should return empty array when no stress tests in calendar", () => {
      const engine = new TermReportEngine(mockCalendarResult, null, null, null);
      expect(engine.generateStressTestSummary()).toEqual([]);
    });

    it("should return empty array when no stress tests in diagonal", () => {
      const engine = new TermReportEngine(null, mockDiagonalResult, null, null);
      expect(engine.generateStressTestSummary()).toEqual([]);
    });

    it("should return stress tests from calendar result with data", () => {
      const calWithStress: CalendarSpreadResult = {
        ...mockCalendarResult,
        stressTests: [
          { label: "Crash", description: "Market down 20%", underlyingPrice: 80, shortIv: 0.3, longIv: 0.3, strategyValue: 1, pnl: -2, theta: 0 },
          { label: "Rally", description: "Market up 15%", underlyingPrice: 115, shortIv: 0.2, longIv: 0.2, strategyValue: 4, pnl: 1, theta: 0 },
        ],
      };
      const engine = new TermReportEngine(calWithStress, null, null, null);
      const summary = engine.generateStressTestSummary();
      expect(summary).toHaveLength(2);
      expect(summary[0].label).toBe("Crash");
      expect(summary[0].pnl).toBe(-2);
    });

    it("should return stress tests from diagonal result with data", () => {
      const diagWithStress: RiskProfile = {
        ...mockDiagonalResult,
        stressTests: [
          { label: "Crash", description: "Market down 20%", underlyingPrice: 80, shortIv: 0.3, longIv: 0.3, strategyValue: 0.5, pnl: -2.5, greeks: { delta: -0.1, gamma: 0.01, theta: -1, vega: 3 } },
        ],
      };
      const engine = new TermReportEngine(null, diagWithStress, null, null);
      const summary = engine.generateStressTestSummary();
      expect(summary).toHaveLength(1);
      expect(summary[0].greeks).toBeDefined();
      expect(summary[0].greeks!.delta).toBe(-0.1);
    });
  });

  /** Tests de generateProbabilityCone: con MC, sin MC, sin DTE */
  describe("generateProbabilityCone", () => {
    it("should return empty array when no Monte Carlo data", () => {
      const engine = new TermReportEngine(mockCalendarResult, null, null, null);
      expect(engine.generateProbabilityCone()).toEqual([]);
    });

    it("should return empty array when pnlDistribution is too small", () => {
      const simWithSmallMc: SimulationResult = {
        strategy: "calendar",
        optionStyle: "call",
        deterministic: [],
        monteCarlo: {
          iterations: 10, distribution: "normal", meanPnl: 0, medianPnl: 0,
          percentile5: -1, percentile95: 1, var95: -1, pnlDistribution: [0, 1, -1],
        },
        backtest: mockSimResult.backtest,
        timestamp: mockSimResult.timestamp,
      };
      const engine = new TermReportEngine(mockCalendarResult, null, simWithSmallMc, null);
      expect(engine.generateProbabilityCone()).toEqual([]);
    });

    it("should return cone point when Monte Carlo has sufficient data", () => {
      const dist: number[] = [];
      for (let i = 0; i < 200; i++) dist.push((Math.random() - 0.5) * 10);
      const simWithMc: SimulationResult = {
        strategy: "calendar",
        optionStyle: "call",
        deterministic: [],
        monteCarlo: {
          iterations: 200, distribution: "normal", meanPnl: 0, medianPnl: 0,
          percentile5: -3, percentile95: 3, var95: -3, pnlDistribution: dist,
        },
        backtest: mockSimResult.backtest,
        timestamp: mockSimResult.timestamp,
      };
      const engine = new TermReportEngine(mockCalendarResult, null, simWithMc, null);
      const cone = engine.generateProbabilityCone();
      expect(cone.length).toBe(1);
      expect(cone[0].dte).toBe(30);
      expect(cone[0].percentile5).toBeDefined();
      expect(cone[0].median).toBeDefined();
      expect(cone[0].percentile95).toBeDefined();
    });
  });

  /** Tests de generatePayoffAtExpiration: static method for comparator overlay chart */
  describe("generatePayoffAtExpiration", () => {
    const mockLegs = [
      { strike: 100, expiration: new Date("2026-06-19"), premium: 2.5, contracts: 1, optionStyle: "call" as const },
      { strike: 100, expiration: new Date("2026-09-18"), premium: 5.0, contracts: 1, optionStyle: "call" as const },
    ];
    const riskFreeRate = 0.05;
    const longIv = 0.2;
    const remainingDte = 60;

    it("should return empty array when fewer than 2 legs", () => {
      const curve = TermReportEngine.generatePayoffAtExpiration([mockLegs[0]], 7.5, riskFreeRate, longIv, remainingDte);
      expect(curve).toEqual([]);
    });

    it("should return empty array when no legs", () => {
      const curve = TermReportEngine.generatePayoffAtExpiration([], 7.5, riskFreeRate, longIv, remainingDte);
      expect(curve).toEqual([]);
    });

    it("should generate curve with default 50 points", () => {
      const curve = TermReportEngine.generatePayoffAtExpiration(mockLegs, 7.5, riskFreeRate, longIv, remainingDte);
      expect(curve.length).toBe(50);
    });

    it("should generate curve with custom price range", () => {
      const curve = TermReportEngine.generatePayoffAtExpiration(mockLegs, 7.5, riskFreeRate, longIv, remainingDte, { min: 80, max: 120, steps: 10 });
      expect(curve.length).toBe(10);
      expect(curve[0].price).toBe(80);
      expect(curve[curve.length - 1].price).toBe(120);
    });

    it("should compute correct pnl = strategyValue - initialCost", () => {
      const curve = TermReportEngine.generatePayoffAtExpiration(mockLegs, 7.5, riskFreeRate, longIv, remainingDte, { min: 99, max: 101, steps: 3 });
      for (const point of curve) {
        expect(point.pnl).toBeCloseTo(point.payoff - 7.5, 1);
      }
    });

    it("should return points with price, payoff, and pnl fields", () => {
      const curve = TermReportEngine.generatePayoffAtExpiration(mockLegs, 7.5, riskFreeRate, longIv, remainingDte, { min: 90, max: 110, steps: 5 });
      for (const point of curve) {
        expect(point).toHaveProperty("price");
        expect(point).toHaveProperty("payoff");
        expect(point).toHaveProperty("pnl");
        expect(typeof point.price).toBe("number");
        expect(typeof point.payoff).toBe("number");
        expect(typeof point.pnl).toBe("number");
      }
    });

    it("should increase payoff as price moves in-the-money for calls", () => {
      const curve = TermReportEngine.generatePayoffAtExpiration(mockLegs, 7.5, riskFreeRate, longIv, remainingDte, { min: 80, max: 120, steps: 10 });
      const midIdx = Math.floor(curve.length / 2);
      expect(curve[curve.length - 1].payoff).toBeGreaterThan(curve[0].payoff);
    });

    it("should handle put options", () => {
      const putLegs = [
        { strike: 100, expiration: new Date("2026-06-19"), premium: 2.5, contracts: 1, optionStyle: "put" as const },
        { strike: 100, expiration: new Date("2026-09-18"), premium: 5.0, contracts: 1, optionStyle: "put" as const },
      ];
      const curve = TermReportEngine.generatePayoffAtExpiration(putLegs, 7.5, riskFreeRate, longIv, remainingDte, { min: 80, max: 120, steps: 10 });
      expect(curve.length).toBe(10);
      // For puts, payoff should be higher at lower prices
      expect(curve[0].payoff).toBeGreaterThan(curve[curve.length - 1].payoff);
    });

    it("should handle remainingDte = 0 (long leg at expiration)", () => {
      const curve = TermReportEngine.generatePayoffAtExpiration(mockLegs, 7.5, riskFreeRate, longIv, 0, { min: 80, max: 120, steps: 5 });
      expect(curve.length).toBe(5);
      expect(curve.every(p => typeof p.pnl === "number")).toBe(true);
    });

    it("should handle multi-contract legs", () => {
      const multiContractLegs = [
        { strike: 100, expiration: new Date("2026-06-19"), premium: 2.5, contracts: 2, optionStyle: "call" as const },
        { strike: 100, expiration: new Date("2026-09-18"), premium: 5.0, contracts: 2, optionStyle: "call" as const },
      ];
      const curve = TermReportEngine.generatePayoffAtExpiration(multiContractLegs, 15.0, riskFreeRate, longIv, remainingDte, { min: 105, max: 115, steps: 3 });
      // At S > strike=100, calls have intrinsic value; 2 contracts scales payoff
      for (const point of curve) {
        expect(point.payoff).toBeGreaterThan(0);
      }
    });
  });

  /** Tests de calculateRiskMetrics: stress test fields, expected shortfall */
  describe("riskMetrics extended fields", () => {
    it("should return stressTestMaxLoss and stressTestMaxGain with data", () => {
      const calWithStress: CalendarSpreadResult = {
        ...mockCalendarResult,
        stressTests: [
          { label: "Crash", description: "Crash", underlyingPrice: 80, shortIv: 0.3, longIv: 0.3, strategyValue: 1, pnl: -5, theta: 0 },
          { label: "Rally", description: "Rally", underlyingPrice: 115, shortIv: 0.2, longIv: 0.2, strategyValue: 4, pnl: 3, theta: 0 },
        ],
      };
      const engine = new TermReportEngine(calWithStress, null, null, null);
      const metrics = engine.calculateRiskMetrics();
      expect(metrics.stressTestMaxLoss).toBe(-5);
      expect(metrics.stressTestMaxGain).toBe(3);
    });

    it("should return zero stress test metrics when no stress tests", () => {
      const engine = new TermReportEngine(mockCalendarResult, null, null, null);
      const metrics = engine.calculateRiskMetrics();
      expect(metrics.stressTestMaxLoss).toBe(0);
      expect(metrics.stressTestMaxGain).toBe(0);
    });

    it("should include expectedShortfall in diagonal metrics", () => {
      const dist: number[] = [];
      for (let i = 0; i < 200; i++) dist.push(-Math.abs(Math.random()) * 5);
      const simWithMc: SimulationResult = {
        strategy: "calendar",
        optionStyle: "call",
        deterministic: [],
        monteCarlo: {
          iterations: 200, distribution: "normal", meanPnl: -2, medianPnl: -1.5,
          percentile5: -4, percentile95: 0, var95: -4, pnlDistribution: dist,
        },
        backtest: mockSimResult.backtest,
        timestamp: mockSimResult.timestamp,
      };
      const engine = new TermReportEngine(null, mockDiagonalResult, simWithMc, null);
      const metrics = engine.calculateRiskMetrics();
      expect(metrics.expectedShortfall).toBeLessThan(0);
    });
  });

  /** Tests de generateReport: incluye stressTests y probabilityCone */
  describe("generateReport extended fields", () => {
    it("should include stressTests array in report", () => {
      const engine = new TermReportEngine(mockCalendarResult, null, null, null);
      const report = engine.generateReport();
      expect(report).toHaveProperty("stressTests");
      expect(Array.isArray(report.stressTests)).toBe(true);
    });

    it("should include probabilityCone array in report", () => {
      const engine = new TermReportEngine(mockCalendarResult, null, null, null);
      const report = engine.generateReport();
      expect(report).toHaveProperty("probabilityCone");
      expect(Array.isArray(report.probabilityCone)).toBe(true);
    });
  });
});
