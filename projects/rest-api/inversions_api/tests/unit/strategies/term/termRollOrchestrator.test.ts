/**
 * Tests de termRollOrchestrator.ts — T197 (tests unitarios simulacion y orquestador)
 * Cobertura: triggers de roll (theta residual, gamma, DTE, violacion riesgo),
 * costos de roll, recomendacion de cierre anticipado, timing sugerido.
 * Modulo bajo prueba: TermRollOrchestrator
 */
import { describe, it, expect } from "vitest";
import { TermStrategyContract } from "../../../../src/modules/strategies/term/termStrategyContract";
import { TermRollOrchestrator } from "../../../../src/modules/strategies/term/termRollOrchestrator";

/** Tests de TermRollOrchestrator: constructor, evaluate (triggers theta/gamma/DTE/riesgo, costos, timing, no-roll) */
describe("TermRollOrchestrator", () => {
  const now = new Date();
  const shortExpiration = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const longExpiration = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  /** Helper: crea contrato calendar para pruebas de roll */
  function makeValidContract(): TermStrategyContract {
    return new TermStrategyContract({
      legs: [
        { strike: 100, expiration: shortExpiration, premium: 5.0, contracts: 1, optionStyle: "call" },
        { strike: 100, expiration: longExpiration, premium: 8.0, contracts: 1, optionStyle: "call" },
      ],
      underlying: "SPY",
    });
  }

  /** Verifica que el constructor acepta contratos y parametros personalizados */
  describe("constructor", () => {
    it("should accept a valid contract", () => {
      const orch = new TermRollOrchestrator(makeValidContract(), null, -2);
      expect(orch).toBeInstanceOf(TermRollOrchestrator);
    });

    it("should accept custom parameters", () => {
      const orch = new TermRollOrchestrator(
        makeValidContract(), null, -2, 0.01,
        { type: "trigger", daysBeforeExpiration: [5], periodicDays: 3 },
        0.3, 5
      );
      expect(orch).toBeInstanceOf(TermRollOrchestrator);
    });
  });

  /** Tests de evaluate: estructura, triggers theta/gamma/DTE/riesgo, costos, timing, no-roll */
  describe("evaluate", () => {
    it("should return roll recommendation", () => {
      const orch = new TermRollOrchestrator(makeValidContract(), null, -2);
      const result = orch.evaluate();
      expect(result).toHaveProperty("shouldRoll");
      expect(result).toHaveProperty("shouldCloseEarly");
      expect(result).toHaveProperty("triggers");
      expect(result).toHaveProperty("recommendation");
    });

    it("should detect theta residual trigger", () => {
      const orch = new TermRollOrchestrator(
        makeValidContract(), null, 0.1,
        0, undefined, 0.5
      );
      const result = orch.evaluate();
      expect(result.triggers.thetaResidualTriggered).toBe(true);
    });

    it("should detect DTE trigger with short expiration", () => {
      const veryShortExp = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const contract = new TermStrategyContract({
        legs: [
          { strike: 100, expiration: veryShortExp, premium: 5.0, contracts: 1, optionStyle: "call" },
          { strike: 100, expiration: longExpiration, premium: 8.0, contracts: 1, optionStyle: "call" },
        ],
        underlying: "SPY",
      });
      const orch = new TermRollOrchestrator(contract, null, -2, 0, undefined, 0.5, 7);
      const result = orch.evaluate();
      expect(result.triggers.dteMinTriggered).toBe(true);
      expect(result.triggers.triggered).toBe(true);
    });

    it("should detect gamma exposure trigger", () => {
      const orch = new TermRollOrchestrator(makeValidContract(), null, -2, 0.1);
      const result = orch.evaluate();
      expect(result.triggers.gammaExposureTriggered).toBe(true);
    });

    it("should detect risk limit violation", () => {
      const riskAnalysis = {
        limitsViolation: true,
        violations: ["Concentration limit exceeded"],
        earlyAssignmentRisk: null,
        stopLossRules: [],
        alerts: [],
        portfolioExposure: 0.5,
        thetaExposure: -10,
      };
      const orch = new TermRollOrchestrator(makeValidContract(), riskAnalysis, -5);
      const result = orch.evaluate();
      expect(result.triggers.riskLimitViolationTriggered).toBe(true);
      expect(result.shouldCloseEarly).toBe(true);
    });

    it("should estimate roll cost", () => {
      const orch = new TermRollOrchestrator(makeValidContract(), null, -2);
      const result = orch.evaluate();
      if (result.cost) {
        expect(result.cost).toHaveProperty("premiumDifferential");
        expect(result.cost).toHaveProperty("totalCost");
      }
    });

    it("should suggest timing based on DTE", () => {
      const orch = new TermRollOrchestrator(makeValidContract(), null, -2);
      const result = orch.evaluate();
      expect(typeof result.timing).toBe("string");
      expect(result.timing.length).toBeGreaterThan(0);
    });

    it("should recommend no roll when everything is fine", () => {
      const farExp = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      const contract = new TermStrategyContract({
        legs: [
          { strike: 100, expiration: farExp, premium: 5.0, contracts: 1, optionStyle: "call" },
          { strike: 100, expiration: longExpiration, premium: 8.0, contracts: 1, optionStyle: "call" },
        ],
        underlying: "SPY",
      });
      const orch = new TermRollOrchestrator(contract, null, -3, 0.01, undefined, 0.5, 7);
      const result = orch.evaluate();
      expect(result.shouldRoll).toBe(false);
      expect(result.recommendation).toContain("No roll needed");
    });
  });
});
