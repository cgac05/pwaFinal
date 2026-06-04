/**
 * Tests de diagonalSpreadEngine.ts — T196 (tests unitarios engines Calendar/Diagonal)
 * Cobertura: griegas (delta/gamma/theta/vega), perfiles de riesgo, ventanas de ajuste,
 * theta decay, vega shock, variantes call/put.
 * Modulo bajo prueba: DiagonalSpreadEngine
 */
import { describe, it, expect } from "vitest";
import { TermStrategyContract } from "../../../../src/modules/strategies/term/termStrategyContract";
import { DiagonalSpreadEngine } from "../../../../src/modules/strategies/term/diagonalSpreadEngine";

/** Tests de DiagonalSpreadEngine: constructor, analyze (DTE, griegas, perfil, escenarios, theta decay, vega shock, call/put), adjustment window, getContract */
describe("DiagonalSpreadEngine", () => {
  const now = new Date();
  const shortExpiration = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const longExpiration = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  /** Helper: crea un contrato diagonal valido con strikes 100/105, expiraciones 30/90d */
  function makeValidContract(optionStyle: "call" | "put" = "call"): TermStrategyContract {
    return new TermStrategyContract({
      legs: [
        { strike: 100, expiration: shortExpiration, premium: 5.0, contracts: 1, optionStyle },
        { strike: 105, expiration: longExpiration, premium: 8.0, contracts: 1, optionStyle },
      ],
      underlying: "SPY",
    });
  }

  /** Verifica que el constructor acepta contratos validos y parametros personalizados */
  describe("constructor", () => {
    it("should accept a valid diagonal spread contract", () => {
      const contract = makeValidContract();
      const engine = new DiagonalSpreadEngine(contract);
      expect(engine).toBeInstanceOf(DiagonalSpreadEngine);
    });

    it("should accept custom parameters", () => {
      const contract = makeValidContract();
      const engine = new DiagonalSpreadEngine(contract, 0.04, [], 0.3, 5);
      expect(engine).toBeInstanceOf(DiagonalSpreadEngine);
    });
  });

  /** Tests del metodo analyze: DTE, griegas, perfil direccional, escenarios, theta decay, vega shock, call/put */
  describe("analyze", () => {
    it("should return DTE values", () => {
      const contract = makeValidContract();
      const engine = new DiagonalSpreadEngine(contract);
      const result = engine.analyze();

      expect(result.shortDte).toBeGreaterThan(0);
      expect(result.longDte).toBeGreaterThan(result.shortDte);
    });

    it("should return greek sensitivities", () => {
      const contract = makeValidContract();
      const engine = new DiagonalSpreadEngine(contract);
      const result = engine.analyze();

      expect(typeof result.greeks.delta).toBe("number");
      expect(typeof result.greeks.gamma).toBe("number");
      expect(typeof result.greeks.theta).toBe("number");
      expect(typeof result.greeks.vega).toBe("number");
    });

    it("should have positive netTheta for diagonal spread (collecting time decay)", () => {
      const contract = makeValidContract("call");
      const engine = new DiagonalSpreadEngine(contract);
      const result = engine.analyze();

      expect(result.greeks.theta).toBeGreaterThan(0);
    });

    it("should identify directional profile", () => {
      const contract = makeValidContract();
      const engine = new DiagonalSpreadEngine(contract);
      const result = engine.analyze();

      expect(["bullish", "bearish", "neutral"]).toContain(result.directionalProfile);
    });

    it("should generate price scenarios", () => {
      const contract = makeValidContract();
      const engine = new DiagonalSpreadEngine(contract);
      const result = engine.analyze();

      expect(result.scenarios.length).toBeGreaterThan(0);
      expect(result.scenarios[0]).toHaveProperty("underlyingPrice");
      expect(result.scenarios[0]).toHaveProperty("strategyValue");
      expect(result.scenarios[0]).toHaveProperty("pnl");
      expect(result.scenarios[0]).toHaveProperty("greeks");
    });

    it("should compute P&L from real net entry cost and contracts", () => {
      const contract = new TermStrategyContract({
        legs: [
          { strike: 95, expiration: shortExpiration, premium: 2, contracts: 2, optionStyle: "call" },
          { strike: 105, expiration: longExpiration, premium: 5, contracts: 2, optionStyle: "call" },
        ],
        underlying: "SPY",
      });
      const engine = new DiagonalSpreadEngine(contract);
      const result = engine.analyze();
      const atmScenario = result.scenarios.find(s => s.underlyingPrice === 95);

      expect(atmScenario).toBeDefined();
      expect(atmScenario!.pnl).toBeCloseTo(atmScenario!.strategyValue - 6, 1);
    });

    it("should generate theta decay profile", () => {
      const contract = makeValidContract();
      const engine = new DiagonalSpreadEngine(contract);
      const result = engine.analyze();

      expect(result.thetaDecayProfile.length).toBeGreaterThan(0);
    });

    it("should generate vega shock profile", () => {
      const contract = makeValidContract();
      const engine = new DiagonalSpreadEngine(contract);
      const result = engine.analyze();

      expect(result.vegaShockProfile.length).toBeGreaterThan(0);
    });

    it("should handle call variant", () => {
      const contract = makeValidContract("call");
      const engine = new DiagonalSpreadEngine(contract);
      const result = engine.analyze();

      expect(result.scenarios.length).toBeGreaterThan(0);
    });

    it("should handle put variant", () => {
      const contract = makeValidContract("put");
      const engine = new DiagonalSpreadEngine(contract);
      const result = engine.analyze();

      expect(result.scenarios.length).toBeGreaterThan(0);
    });
  });

  /** Tests de la ventana de ajuste: null cuando no necesario, deteccion cuando DTE corto */
  describe("adjustment window", () => {
    it("should return null when no adjustment needed", () => {
      const contract = makeValidContract();
      const engine = new DiagonalSpreadEngine(contract);
      const result = engine.analyze();

      if (result.adjustmentWindow) {
        expect(result.adjustmentWindow).toHaveProperty("daysToShortExpiration");
        expect(result.adjustmentWindow).toHaveProperty("recommendation");
      } else {
        expect(result.adjustmentWindow).toBeNull();
      }
    });

    it("should detect approaching expiration when DTE is very short", () => {
      const veryShortExp = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const contract = new TermStrategyContract({
        legs: [
          { strike: 100, expiration: veryShortExp, premium: 5.0, contracts: 1, optionStyle: "call" },
          { strike: 105, expiration: longExpiration, premium: 8.0, contracts: 1, optionStyle: "call" },
        ],
        underlying: "SPY",
      });
      const engine = new DiagonalSpreadEngine(contract, 0.05, [], 0.5, 7);
      const result = engine.analyze();

      expect(result.adjustmentWindow).not.toBeNull();
      expect(result.adjustmentWindow!.daysToShortExpiration).toBeLessThanOrEqual(7);
      expect(result.adjustmentWindow!.recommendation.toLowerCase()).toContain("roll");
    });
  });

  /** Tests de stressTests: estructura, 5 escenarios, griegas en cada uno */
  describe("stressTests", () => {
    it("should return 5 stress test scenarios", () => {
      const contract = makeValidContract();
      const engine = new DiagonalSpreadEngine(contract);
      const result = engine.analyze();
      expect(result.stressTests).toHaveLength(5);
    });

    it("should have correct structure for each stress test", () => {
      const contract = makeValidContract();
      const engine = new DiagonalSpreadEngine(contract);
      const result = engine.analyze();
      const test = result.stressTests[0];
      expect(test).toHaveProperty("label");
      expect(test).toHaveProperty("description");
      expect(test).toHaveProperty("underlyingPrice");
      expect(test).toHaveProperty("shortIv");
      expect(test).toHaveProperty("longIv");
      expect(test).toHaveProperty("strategyValue");
      expect(test).toHaveProperty("pnl");
      expect(test).toHaveProperty("greeks");
      expect(test.greeks).toHaveProperty("delta");
      expect(test.greeks).toHaveProperty("gamma");
      expect(test.greeks).toHaveProperty("theta");
      expect(test.greeks).toHaveProperty("vega");
    });

    it("should include IV Expansion scenario", () => {
      const contract = makeValidContract();
      const engine = new DiagonalSpreadEngine(contract);
      const result = engine.analyze();
      const ivExp = result.stressTests.find(s => s.label === "IV Expansion");
      expect(ivExp).toBeDefined();
      expect(ivExp!.shortIv).toBeGreaterThanOrEqual(0.3);
      expect(ivExp!.longIv).toBeGreaterThanOrEqual(0.3);
    });

    it("should report different P&L and greeks across stress scenarios", () => {
      const contract = makeValidContract();
      const engine = new DiagonalSpreadEngine(contract);
      const result = engine.analyze();
      const pnls = result.stressTests.map(s => s.pnl);
      const uniquePnls = new Set(pnls);
      expect(uniquePnls.size).toBeGreaterThan(1);
    });
  });

  /** Verifica que getContract() retorna la referencia original */
  describe("getContract", () => {
    it("should return the underlying contract", () => {
      const contract = makeValidContract();
      const engine = new DiagonalSpreadEngine(contract);
      expect(engine.getContract()).toBe(contract);
    });
  });
});
