/**
 * FIC: English/Español
 * Unit tests for complex options strategy engines (Iron Condor, Iron Butterfly, Butterfly Spread, Condor).
 * Pruebas unitarias para los motores de estrategias de opciones complejas (Iron Condor, Iron Butterfly, Butterfly Spread, Condor).
 */

import { describe, expect, it } from "vitest";
import { calculateIronCondor } from "../../../../src/modules/strategies/complex/ironCondorEngine";
import { calculateIronButterfly } from "../../../../src/modules/strategies/complex/ironButterflyEngine";
import { calculateButterflySpread } from "../../../../src/modules/strategies/complex/butterflySpreadEngine";
import { calculateCondor } from "../../../../src/modules/strategies/complex/condorEngine";
import { simulateStrategy } from "../../../../src/modules/strategies/complex/complexSimulationEngine";
import { evaluateStrategyRisk } from "../../../../src/modules/strategies/complex/complexRiskEngine";
import { generateFullReport } from "../../../../src/modules/strategies/complex/complexReportEngine";
import { ComplexStrategyInput } from "../../../../src/modules/strategies/complex/complexStrategyContract";

describe("Complex Options Strategy Engines", () => {

  describe("Iron Condor Engine", () => {
    it("should calculate correct parameters for a standard Iron Condor", () => {
      const input: ComplexStrategyInput = {
        ticker: "COCA",
        underlyingPrice: 100,
        legs: [
          { id: "ic-lp", type: "put", action: "buy", strike: 90, premium: 0.5, contracts: 1, expiration: "2026-06-20" },
          { id: "ic-sp", type: "put", action: "sell", strike: 95, premium: 1.5, contracts: 1, expiration: "2026-06-20" },
          { id: "ic-sc", type: "call", action: "sell", strike: 105, premium: 1.4, contracts: 1, expiration: "2026-06-20" },
          { id: "ic-lc", type: "call", action: "buy", strike: 110, premium: 0.4, contracts: 1, expiration: "2026-06-20" }
        ]
      };

      const result = calculateIronCondor(input);

      // netCredit = (1.5 + 1.4) - (0.5 + 0.4) = 2.9 - 0.9 = 2.0
      expect(result.netPremium).toBe(2.0);
      expect(result.isCredit).toBe(true);
      expect(result.maxProfit).toBe(200); // 2.0 * 100 * 1
      // maxLoss = (maxWing - netPremium) * 100 = (5 - 2) * 100 = 300
      expect(result.maxLoss).toBe(300);
      expect(result.breakEvens).toEqual([93, 107]); // 95 - 2, 105 + 2
      expect(result.greeks.delta).toBeDefined();
    });

    it("should fail if leg counts are not exactly 4", () => {
      const input: ComplexStrategyInput = {
        ticker: "COCA",
        underlyingPrice: 100,
        legs: [
          { id: "ic-lp", type: "put", action: "buy", strike: 90, premium: 0.5, contracts: 1, expiration: "2026-06-20" }
        ]
      };
      expect(() => calculateIronCondor(input)).toThrow("Iron Condor requiere exactamente 4 patas");
    });
  });

  describe("Iron Butterfly Engine", () => {
    it("should calculate correct parameters for symmetric Iron Butterfly", () => {
      const input: ComplexStrategyInput = {
        ticker: "COCA",
        underlyingPrice: 100,
        legs: [
          { id: "ib-lp", type: "put", action: "buy", strike: 90, premium: 0.8, contracts: 1, expiration: "2026-06-20" },
          { id: "ib-sp", type: "put", action: "sell", strike: 100, premium: 3.5, contracts: 1, expiration: "2026-06-20" },
          { id: "ib-sc", type: "call", action: "sell", strike: 100, premium: 3.5, contracts: 1, expiration: "2026-06-20" },
          { id: "ib-lc", type: "call", action: "buy", strike: 110, premium: 0.8, contracts: 1, expiration: "2026-06-20" }
        ]
      };

      const result = calculateIronButterfly(input);

      // netCredit = (3.5 + 3.5) - (0.8 + 0.8) = 7.0 - 1.6 = 5.4
      expect(result.netPremium).toBeCloseTo(5.4, 4);
      expect(result.maxProfit).toBeCloseTo(540, 4);
      // maxLoss = (10 - 5.4) * 100 = 460
      expect(result.maxLoss).toBeCloseTo(460, 4);
      expect(result.breakEvens).toEqual([94.6, 105.4]);
    });

    it("should fail if short legs do not share the same strike", () => {
      const input: ComplexStrategyInput = {
        ticker: "COCA",
        underlyingPrice: 100,
        legs: [
          { id: "ib-lp", type: "put", action: "buy", strike: 90, premium: 0.8, contracts: 1, expiration: "2026-06-20" },
          { id: "ib-sp", type: "put", action: "sell", strike: 99, premium: 3.5, contracts: 1, expiration: "2026-06-20" },
          { id: "ib-sc", type: "call", action: "sell", strike: 100, premium: 3.5, contracts: 1, expiration: "2026-06-20" },
          { id: "ib-lc", type: "call", action: "buy", strike: 110, premium: 0.8, contracts: 1, expiration: "2026-06-20" }
        ]
      };
      expect(() => calculateIronButterfly(input)).toThrow("Las patas cortas de Iron Butterfly deben compartir el mismo strike");
    });
  });

  describe("Butterfly Spread Engine", () => {
    it("should calculate correct parameters for Call Butterfly Spread", () => {
      const input: ComplexStrategyInput = {
        ticker: "COCA",
        underlyingPrice: 100,
        legs: [
          { id: "bs-l1", type: "call", action: "buy", strike: 95, premium: 5.5, contracts: 1, expiration: "2026-06-20" },
          { id: "bs-s2", type: "call", action: "sell", strike: 100, premium: 2.2, contracts: 2, expiration: "2026-06-20" },
          { id: "bs-l3", type: "call", action: "buy", strike: 105, premium: 0.5, contracts: 1, expiration: "2026-06-20" }
        ]
      };

      const result = calculateButterflySpread(input);

      // debitPaid = (5.5 + 0.5) - (2 * 2.2) = 6.0 - 4.4 = 1.6
      expect(result.netPremium).toBeCloseTo(-1.6, 4);
      expect(result.isCredit).toBe(false);
      // maxProfit = (width - debit) * 100 = (5 - 1.6) * 100 = 340
      expect(result.maxProfit).toBeCloseTo(340, 4);
      expect(result.maxLoss).toBeCloseTo(160, 4);
      expect(result.breakEvens).toEqual([96.6, 103.4]);
    });
  });

  describe("Condor Engine", () => {
    it("should calculate correct parameters for a Call Condor", () => {
      const input: ComplexStrategyInput = {
        ticker: "COCA",
        underlyingPrice: 100,
        legs: [
          { id: "c-l1", type: "call", action: "buy", strike: 90, premium: 9.5, contracts: 1, expiration: "2026-06-20" },
          { id: "c-s2", type: "call", action: "sell", strike: 95, premium: 5.2, contracts: 1, expiration: "2026-06-20" },
          { id: "c-s3", type: "call", action: "sell", strike: 105, premium: 1.2, contracts: 1, expiration: "2026-06-20" },
          { id: "c-l4", type: "call", action: "buy", strike: 110, premium: 0.3, contracts: 1, expiration: "2026-06-20" }
        ]
      };

      const result = calculateCondor(input);

      // debitPaid = (9.5 + 0.3) - (5.2 + 1.2) = 9.8 - 6.4 = 3.4
      expect(result.netPremium).toBeCloseTo(-3.4, 4);
      // maxProfit = (5 - 3.4) * 100 = 160
      expect(result.maxProfit).toBeCloseTo(160, 4);
      expect(result.maxLoss).toBeCloseTo(340, 4);
    });
  });

  describe("Simulation, Risk, and Report Engines", () => {
    it("should run complete Monte Carlo simulation, evaluate risk, and output ASCII charts", () => {
      const input: ComplexStrategyInput = {
        ticker: "COCA",
        underlyingPrice: 100,
        legs: [
          { id: "ic-lp", type: "put", action: "buy", strike: 90, premium: 0.5, contracts: 1, expiration: "2026-06-20" },
          { id: "ic-sp", type: "put", action: "sell", strike: 95, premium: 1.5, contracts: 1, expiration: "2026-06-20" },
          { id: "ic-sc", type: "call", action: "sell", strike: 105, premium: 1.4, contracts: 1, expiration: "2026-06-20" },
          { id: "ic-lc", type: "call", action: "buy", strike: 110, premium: 0.4, contracts: 1, expiration: "2026-06-20" }
        ]
      };

      const profile = calculateIronCondor(input);
      const sim = simulateStrategy(input, profile, 30, 0.25, 0.01);
      const risk = evaluateStrategyRisk(input, profile, 25000);
      const report = generateFullReport(input, profile, sim, risk);

      expect(sim.probabilityOfProfit).toBeGreaterThanOrEqual(0);
      expect(sim.probabilityOfProfit).toBeLessThanOrEqual(1);
      expect(risk.riskScore).toBeGreaterThanOrEqual(1);
      expect(risk.riskScore).toBeLessThanOrEqual(10);
      expect(report.strategyName).toBe("Iron Condor");
      expect(report.asciiChart).toBeDefined();
    });
  });

});
