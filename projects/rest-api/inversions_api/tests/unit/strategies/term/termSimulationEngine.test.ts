/**
 * Tests de termSimulationEngine.ts — T197 (tests unitarios simulacion y orquestador)
 * Cobertura: backtesting, Monte Carlo (normal/lognormal), escenarios deterministicos,
 * simulacion completa con/sin datos historicos y configuracion MC.
 * Modulo bajo prueba: TermSimulationEngine
 */
import { describe, it, expect } from "vitest";
import { TermStrategyContract } from "../../../../src/modules/strategies/term/termStrategyContract";
import { TermSimulationEngine } from "../../../../src/modules/strategies/term/termSimulationEngine";
import type { OhlcData } from "../../../../src/modules/strategies/term/termSimulationEngine";

/** Tests de TermSimulationEngine: constructor, runBacktest, runMonteCarlo (normal), runDeterministic, simulate */
describe("TermSimulationEngine", () => {
  const now = new Date();
  const shortExpiration = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const longExpiration = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  /** Helper: crea contrato calendar para pruebas de simulacion */
  function makeValidContract(): TermStrategyContract {
    return new TermStrategyContract({
      legs: [
        { strike: 100, expiration: shortExpiration, premium: 5.0, contracts: 1, optionStyle: "call" },
        { strike: 100, expiration: longExpiration, premium: 8.0, contracts: 1, optionStyle: "call" },
      ],
      underlying: "SPY",
    });
  }

  /** Helper: genera datos OHLC simulados con precio random walk */
  function makeMockOhlcData(length: number): OhlcData[] {
    const data: OhlcData[] = [];
    let price = 100;
    for (let i = 0; i < length; i++) {
      const change = (Math.random() - 0.5) * 2;
      price += change;
      data.push({
        timestamp: new Date(now.getTime() + i * 24 * 60 * 60 * 1000),
        open: price,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000000,
      });
    }
    return data;
  }

  /** Verifica que el constructor acepta contrato valido */
  describe("constructor", () => {
    it("should accept a valid contract", () => {
      const contract = makeValidContract();
      const engine = new TermSimulationEngine(contract, null, null);
      expect(engine).toBeInstanceOf(TermSimulationEngine);
    });
  });

  /** Tests de runBacktest: datos insuficientes, calculo de retornos, equity curve */
  describe("runBacktest", () => {
    it("should return empty result with insufficient data", () => {
      const contract = makeValidContract();
      const engine = new TermSimulationEngine(contract, null, null);
      const result = engine.runBacktest([]);
      expect(result.totalTrades).toBe(0);
    });

    it("should calculate returns from historical data", () => {
      const contract = makeValidContract();
      const engine = new TermSimulationEngine(contract, null, null);
      const data = makeMockOhlcData(30);
      const result = engine.runBacktest(data);
      expect(result.totalTrades).toBeGreaterThan(0);
      expect(result.equityCurve.length).toBeGreaterThan(0);
    });

    it("should produce equity curve starting at 1", () => {
      const contract = makeValidContract();
      const engine = new TermSimulationEngine(contract, null, null);
      const data = makeMockOhlcData(30);
      const result = engine.runBacktest(data);
      expect(result.equityCurve[0]).toBe(1);
    });
  });

  /** Tests de runMonteCarlo: iteraciones, percentiles, mean/median */
  describe("runMonteCarlo", () => {
    it("should run specified number of iterations", () => {
      const contract = makeValidContract();
      const engine = new TermSimulationEngine(contract, null, null);
      const result = engine.runMonteCarlo({ iterations: 100, distribution: "normal" });
      expect(result.iterations).toBe(100);
      expect(result.pnlDistribution).toHaveLength(100);
    });

    it("should compute percentiles", () => {
      const contract = makeValidContract();
      const engine = new TermSimulationEngine(contract, null, null);
      const result = engine.runMonteCarlo({ iterations: 100, distribution: "normal" });
      expect(typeof result.percentile5).toBe("number");
      expect(typeof result.percentile95).toBe("number");
      expect(typeof result.var95).toBe("number");
      expect(result.percentile5).toBeLessThanOrEqual(result.percentile95);
    });

    it("should compute mean and median", () => {
      const contract = makeValidContract();
      const engine = new TermSimulationEngine(contract, null, null);
      const result = engine.runMonteCarlo({ iterations: 100, distribution: "normal" });
      expect(typeof result.meanPnl).toBe("number");
      expect(typeof result.medianPnl).toBe("number");
    });
  });

  /** Tests de runDeterministic: escenarios generados, price-IV combos, time steps, estructura */
  describe("runDeterministic", () => {
    it("should generate deterministic scenarios", () => {
      const contract = makeValidContract();
      const engine = new TermSimulationEngine(contract, null, null);
      const scenarios = engine.runDeterministic();
      expect(scenarios.length).toBeGreaterThan(0);
    });

    it("should include price-IV combination scenarios", () => {
      const contract = makeValidContract();
      const engine = new TermSimulationEngine(contract, null, null);
      const scenarios = engine.runDeterministic();
      const hasPriceIvScenarios = scenarios.some(s => s.label.includes("Price") && s.label.includes("IV"));
      expect(hasPriceIvScenarios).toBe(true);
    });

    it("should include time step scenarios", () => {
      const contract = makeValidContract();
      const engine = new TermSimulationEngine(contract, null, null);
      const scenarios = engine.runDeterministic();
      const hasTimeStepScenarios = scenarios.some(s => s.label.includes("TimeStep"));
      expect(hasTimeStepScenarios).toBe(true);
    });

    it("should have structured output", () => {
      const contract = makeValidContract();
      const engine = new TermSimulationEngine(contract, null, null);
      const scenarios = engine.runDeterministic();
      const first = scenarios[0];
      expect(first).toHaveProperty("label");
      expect(first).toHaveProperty("price");
      expect(first).toHaveProperty("ivShock");
      expect(first).toHaveProperty("dteRemaining");
      expect(first).toHaveProperty("strategyValue");
      expect(first).toHaveProperty("pnl");
    });
  });

  /** Tests de simulate: resultado completo, backtest con datos, Monte Carlo con config */
  describe("simulate", () => {
    it("should return full simulation result", () => {
      const contract = makeValidContract();
      const engine = new TermSimulationEngine(contract, null, null);
      const result = engine.simulate(undefined, undefined);
      expect(result.strategy).toBe("calendar");
      expect(result.optionStyle).toBe("call");
      expect(result.backtest).toBeNull();
      expect(result.monteCarlo).toBeNull();
      expect(result.deterministic.length).toBeGreaterThan(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should include backtest when data provided", () => {
      const contract = makeValidContract();
      const engine = new TermSimulationEngine(contract, null, null);
      const data = makeMockOhlcData(30);
      const result = engine.simulate(data, undefined);
      expect(result.backtest).not.toBeNull();
    });

    it("should include monte carlo when config provided", () => {
      const contract = makeValidContract();
      const engine = new TermSimulationEngine(contract, null, null);
      const result = engine.simulate(undefined, { iterations: 50, distribution: "normal" });
      expect(result.monteCarlo).not.toBeNull();
      expect(result.monteCarlo!.iterations).toBe(50);
    });
  });
});
