/**
 * Tests de calendarSpreadEngine.ts — T196 (tests unitarios engines Calendar/Diagonal)
 * Cobertura: theta decay, escenarios de precio, variantes call/put, IV curve.
 * Modulo bajo prueba: CalendarSpreadEngine
 */
import { describe, it, expect } from "vitest";
import { TermStrategyContract } from "../../../../src/modules/strategies/term/termStrategyContract";
import { CalendarSpreadEngine } from "../../../../src/modules/strategies/term/calendarSpreadEngine";
import { estimateForwardIv } from "../../../../src/modules/strategies/term/termUtils";

/** Tests de CalendarSpreadEngine: constructor, analyze (theta, escenarios, call/put, IV curve), getContract */
describe("CalendarSpreadEngine", () => {
  const now = new Date();
  const shortExpiration = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const longExpiration = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  /** Helper: crea un contrato calendar valido con 2 legs del mismo strike, expiraciones 30/90d */
  function makeValidContract(optionStyle: "call" | "put" = "call"): TermStrategyContract {
    return new TermStrategyContract({
      legs: [
        { strike: 100, expiration: shortExpiration, premium: 5.0, contracts: 1, optionStyle },
        { strike: 100, expiration: longExpiration, premium: 8.0, contracts: 1, optionStyle },
      ],
      underlying: "SPY",
    });
  }

  /** Verifica que el constructor acepta contratos validos y parametros opcionales */
  describe("constructor", () => {
    it("should accept a valid contract", () => {
      const contract = makeValidContract();
      const engine = new CalendarSpreadEngine(contract);
      expect(engine).toBeInstanceOf(CalendarSpreadEngine);
    });

    it("should accept custom riskFreeRate and ivCurve", () => {
      const contract = makeValidContract();
      const engine = new CalendarSpreadEngine(contract, 0.04, [
        { dte: 30, iv: 0.25 },
        { dte: 90, iv: 0.22 },
      ]);
      expect(engine).toBeInstanceOf(CalendarSpreadEngine);
    });
  });

  /** Tests del metodo analyze: DTE, thetas, escenarios, estructura, rango de precios, variantes call/put, IV curve */
  describe("analyze", () => {
    it("should return shortDte and longDte", () => {
      const contract = makeValidContract();
      const engine = new CalendarSpreadEngine(contract);
      const result = engine.analyze();

      expect(result.shortDte).toBeGreaterThan(0);
      expect(result.longDte).toBeGreaterThan(result.shortDte);
    });

    it("should return theta values for short and long legs", () => {
      const contract = makeValidContract();
      const engine = new CalendarSpreadEngine(contract);
      const result = engine.analyze();

      expect(typeof result.shortTheta).toBe("number");
      expect(typeof result.longTheta).toBe("number");
      expect(typeof result.netTheta).toBe("number");
    });

    it("should have positive netTheta for ATM calendar spread (long theta decay)", () => {
      const contract = makeValidContract("call");
      const engine = new CalendarSpreadEngine(contract);
      const result = engine.analyze();

      expect(result.netTheta).toBeGreaterThan(0);
    });

    it("should return scenarios array", () => {
      const contract = makeValidContract();
      const engine = new CalendarSpreadEngine(contract);
      const result = engine.analyze();

      expect(result.scenarios.length).toBeGreaterThan(0);
    });

    it("should generate scenarios with correct structure", () => {
      const contract = makeValidContract();
      const engine = new CalendarSpreadEngine(contract);
      const result = engine.analyze();

      const scenario = result.scenarios[0];
      expect(scenario).toHaveProperty("underlyingPrice");
      expect(scenario).toHaveProperty("strategyValue");
      expect(scenario).toHaveProperty("pnl");
      expect(scenario).toHaveProperty("theta");
      expect(scenario).toHaveProperty("impliedVolatility");
    });

    it("should generate scenarios across a price range around ATM", () => {
      const contract = makeValidContract();
      const engine = new CalendarSpreadEngine(contract);
      const result = engine.analyze();

      const prices = result.scenarios.map(s => s.underlyingPrice);
      expect(Math.min(...prices)).toBeLessThan(100);
      expect(Math.max(...prices)).toBeGreaterThan(100);
    });

    it("should calculate scenario pnl from net entry cost and contract count", () => {
      const contract = new TermStrategyContract({
        legs: [
          { strike: 100, expiration: shortExpiration, premium: 5.0, contracts: 2, optionStyle: "call" },
          { strike: 100, expiration: longExpiration, premium: 8.0, contracts: 2, optionStyle: "call" },
        ],
        underlying: "SPY",
      });
      const engine = new CalendarSpreadEngine(contract);
      const result = engine.analyze();
      const atmScenario = result.scenarios.find(s => s.underlyingPrice === 100);

      expect(atmScenario).toBeDefined();
      expect(atmScenario!.pnl).toBeCloseTo(atmScenario!.strategyValue - 6, 1);
    });

    it("should handle call variant", () => {
      const contract = makeValidContract("call");
      const engine = new CalendarSpreadEngine(contract);
      const result = engine.analyze();

      expect(result.scenarios.length).toBeGreaterThan(0);
    });

    it("should handle put variant", () => {
      const contract = makeValidContract("put");
      const engine = new CalendarSpreadEngine(contract);
      const result = engine.analyze();

      expect(result.scenarios.length).toBeGreaterThan(0);
    });

    it("should produce different strategy values for call vs put at deep OTM", () => {
      const callContract = makeValidContract("call");
      const putContract = makeValidContract("put");

      const callEngine = new CalendarSpreadEngine(callContract);
      const putEngine = new CalendarSpreadEngine(putContract);

      const callResult = callEngine.analyze();
      const putResult = putEngine.analyze();

      const callFirst = callResult.scenarios[0];
      const putFirst = putResult.scenarios[0];
      expect(callFirst.strategyValue).not.toBe(putFirst.strategyValue);
    });

    it("should use ivCurve for differentiated IV per leg", () => {
      const contract = makeValidContract();
      const engine = new CalendarSpreadEngine(contract, 0.05, [
        { dte: 30, iv: 0.35 },
        { dte: 90, iv: 0.20 },
      ]);
      const result = engine.analyze();

      result.scenarios.forEach(s => {
        expect(s.impliedVolatility).toBeGreaterThan(0);
      });
    });
  });

  /** Tests de estimateForwardIv: calculo forward, casos borde (T iguales), high IV backwardation */
  describe("estimateForwardIv", () => {
    it("should return forward IV higher when back end is higher", () => {
      const fwd = estimateForwardIv(0.20, 0.30, 30 / 365, 90 / 365);
      expect(fwd).toBeGreaterThan(0.30);
    });

    it("should return forward IV lower when front end is higher (backwardation)", () => {
      const fwd = estimateForwardIv(0.35, 0.20, 30 / 365, 90 / 365);
      expect(fwd).toBeLessThan(0.35);
    });

    it("should return longIv when shortT >= longT", () => {
      const fwd = estimateForwardIv(0.25, 0.30, 90 / 365, 30 / 365);
      expect(fwd).toBe(0.30);
    });

    it("should return longIv when shortT <= 0", () => {
      const fwd = estimateForwardIv(0.25, 0.30, 0, 90 / 365);
      expect(fwd).toBe(0.30);
    });

    it("should return a reduced value when numerator is negative", () => {
      const fwd = estimateForwardIv(0.50, 0.20, 60 / 365, 90 / 365);
      expect(fwd).toBeLessThan(0.50);
      expect(fwd).toBeGreaterThan(0);
    });
  });

  /** Tests de stressTests: estructura, 5 escenarios, valores numericos */
  describe("stressTests", () => {
    it("should return 5 stress test scenarios", () => {
      const contract = makeValidContract();
      const engine = new CalendarSpreadEngine(contract);
      const result = engine.analyze();
      expect(result.stressTests).toHaveLength(5);
    });

    it("should have correct structure for each stress test", () => {
      const contract = makeValidContract();
      const engine = new CalendarSpreadEngine(contract);
      const result = engine.analyze();
      const test = result.stressTests[0];
      expect(test).toHaveProperty("label");
      expect(test).toHaveProperty("description");
      expect(test).toHaveProperty("underlyingPrice");
      expect(test).toHaveProperty("shortIv");
      expect(test).toHaveProperty("longIv");
      expect(test).toHaveProperty("strategyValue");
      expect(test).toHaveProperty("pnl");
      expect(test).toHaveProperty("theta");
    });

    it("should include Market Crash scenario", () => {
      const contract = makeValidContract();
      const engine = new CalendarSpreadEngine(contract);
      const result = engine.analyze();
      const crash = result.stressTests.find(s => s.label === "Market Crash");
      expect(crash).toBeDefined();
      expect(crash!.underlyingPrice).toBeLessThan(90);
    });

    it("should report different P&L across stress scenarios", () => {
      const contract = makeValidContract();
      const engine = new CalendarSpreadEngine(contract);
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
      const engine = new CalendarSpreadEngine(contract);
      expect(engine.getContract()).toBe(contract);
    });
  });
});
