/**
 * Tests de termRiskEngine.ts — T197 (tests unitarios simulacion y orquestador)
 * Cobertura: limites de concentracion/expiracion/theta, asignacion temprana,
 * stop-loss (fixed/percentage/trailing), alertas, portfolio exposure.
 * Modulo bajo prueba: TermRiskEngine
 */
import { describe, it, expect } from "vitest";
import { TermStrategyContract } from "../../../../src/modules/strategies/term/termStrategyContract";
import { TermRiskEngine, calculatePortfolioExposure } from "../../../../src/modules/strategies/term/termRiskEngine";

/** Tests de TermRiskEngine: constructor, analyze (limites concentracion/expiracion/theta, sin violaciones, alertas), stopLossRules, calculatePortfolioExposure */
describe("TermRiskEngine", () => {
  const now = new Date();
  const shortExpiration = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const longExpiration = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  /** Helper: crea un contrato calendar valido para pruebas de riesgo */
  function makeValidContract(): TermStrategyContract {
    return new TermStrategyContract({
      legs: [
        { strike: 100, expiration: shortExpiration, premium: 5.0, contracts: 1, optionStyle: "call" },
        { strike: 100, expiration: longExpiration, premium: 8.0, contracts: 1, optionStyle: "call" },
      ],
      underlying: "SPY",
    });
  }

  /** Verifica que el constructor acepta contratos y limites personalizados */
  describe("constructor", () => {
    it("should accept a valid contract", () => {
      const engine = new TermRiskEngine(makeValidContract());
      expect(engine).toBeInstanceOf(TermRiskEngine);
    });

    it("should accept custom risk limits", () => {
      const engine = new TermRiskEngine(makeValidContract(), 50000, { maxConcentrationPct: 0.05 });
      expect(engine).toBeInstanceOf(TermRiskEngine);
    });
  });

  /** Tests de analyze: estructura, concentracion, expiracion, theta, sin violaciones, alertas */
  describe("analyze", () => {
    it("should return risk analysis", () => {
      const engine = new TermRiskEngine(makeValidContract());
      const result = engine.analyze(-3);
      expect(result).toHaveProperty("limitsViolation");
      expect(result).toHaveProperty("violations");
      expect(result).toHaveProperty("stopLossRules");
      expect(result).toHaveProperty("alerts");
    });

    it("should detect concentration limit violation", () => {
      const engine = new TermRiskEngine(
        makeValidContract(),
        100,
        { maxConcentrationPct: 0.01 }
      );
      const result = engine.analyze(-3);
      expect(result.limitsViolation).toBe(true);
      expect(result.violations.some(v => v.includes("concentration"))).toBe(true);
    });

    it("should detect expiration limit violation", () => {
      const pastLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const engine = new TermRiskEngine(
        makeValidContract(),
        100000,
        { maxExpirationDate: pastLimit }
      );
      const result = engine.analyze(-3);
      expect(result.limitsViolation).toBe(true);
      expect(result.violations.some(v => v.includes("expiration"))).toBe(true);
    });

    it("should detect theta limit violation", () => {
      const engine = new TermRiskEngine(
        makeValidContract(),
        100000,
        { maxNegativeTheta: -1 }
      );
      const result = engine.analyze(-5);
      expect(result.limitsViolation).toBe(true);
      expect(result.violations.some(v => v.includes("theta"))).toBe(true);
    });

    it("should return no violations for normal parameters", () => {
      const engine = new TermRiskEngine(makeValidContract(), 1000000);
      const result = engine.analyze(-3);
      expect(result.violations.length).toBe(0);
      expect(result.limitsViolation).toBe(false);
    });

    it("should generate alerts on violations", () => {
      const engine = new TermRiskEngine(
        makeValidContract(),
        100,
        { maxConcentrationPct: 0.01 }
      );
      const result = engine.analyze(-5);
      expect(result.alerts.length).toBeGreaterThan(0);
    });
  });

  /** Tests de stopLossRules: tipos (fixed/percentage/trailing) y estado triggered */
  describe("stopLossRules", () => {
    it("should include fixed, percentage, and trailing rules", () => {
      const engine = new TermRiskEngine(makeValidContract());
      const result = engine.analyze(-3);
      const types = result.stopLossRules.map(r => r.type);
      expect(types).toContain("fixed");
      expect(types).toContain("percentage");
      expect(types).toContain("trailing");
    });

    it("should have triggered state", () => {
      const engine = new TermRiskEngine(makeValidContract(), 100);
      const result = engine.analyze(-3);
      result.stopLossRules.forEach(rule => {
        expect(typeof rule.triggered).toBe("boolean");
      });
    });
  });

  /** Tests de calculatePortfolioExposure: ratio prima/portafolio y portfolio=0 */
  describe("calculatePortfolioExposure", () => {
    it("should calculate premium-to-portfolio ratio", () => {
      const legs = [
        { strike: 100, expiration: new Date(), premium: 5, contracts: 2, optionStyle: "call" as const },
      ];
      const exposure = calculatePortfolioExposure(legs, 1000);
      expect(exposure).toBe(0.01);
    });

    it("should return 0 for zero portfolio value", () => {
      const legs = [
        { strike: 100, expiration: new Date(), premium: 5, contracts: 1, optionStyle: "call" as const },
      ];
      const exposure = calculatePortfolioExposure(legs, 0);
      expect(exposure).toBe(0);
    });
  });
});
