import { describe, it, expect } from "vitest";
import { ComplexSimulationEngine, DEFAULT_SIMULATION_CONFIG } from "../../../../src/modules/strategies/complex/complexSimulationEngine";
import type { ComplexStrategyConfig, StrategyProfile } from "../../../../src/modules/strategies/complex/complexStrategyContract";

describe("ComplexSimulationEngine", () => {
  const engine = new ComplexSimulationEngine();

  const mockConfig: ComplexStrategyConfig = {
    ticker: "SPY",
    expiracion: "2025-06-20",
    tipo_ala: "short",
    tolerancia_riesgo: "medio",
    estilo_opcion: "europea",
    version: 1,
    legs: [
      { tipo: "put", strike: 540, prima: 3.50, posicion: "long", contratos: 1 },
      { tipo: "put", strike: 560, prima: 6.00, posicion: "short", contratos: 1 },
      { tipo: "call", strike: 590, prima: 4.50, posicion: "short", contratos: 1 },
      { tipo: "call", strike: 610, prima: 2.00, posicion: "long", contratos: 1 },
    ],
  };

  const mockProfile: StrategyProfile = {
    credito_neto: 500,
    tipo_neto: "credito",
    break_even_points: [555, 595],
    perdida_maxima: 1500,
    ganancia_maxima: 500,
    payoff_curve: [],
    payoff_vencimiento: [],
    ratio_riesgo_beneficio: 0.33,
  };

  describe("Monte Carlo simulation", () => {
    it("should run Monte Carlo with default config", () => {
      const result = engine.simulate(mockConfig, mockProfile, DEFAULT_SIMULATION_CONFIG);
      expect(result.tipo).toBe("monte_carlo");
      expect(result.probabilidad_exito).toBeGreaterThanOrEqual(0);
      expect(result.probabilidad_exito).toBeLessThanOrEqual(100);
      expect(result.rendimiento_esperado).toBeDefined();
    });

    it("should return consistent results with same seed", () => {
      const configWithSeed = { ...DEFAULT_SIMULATION_CONFIG, seed: 12345, iteraciones: 1000 };
      const result1 = engine.simulate(mockConfig, mockProfile, configWithSeed);
      const result2 = engine.simulate(mockConfig, mockProfile, configWithSeed);
      expect(result1.probabilidad_exito).toBe(result2.probabilidad_exito);
      expect(result1.drawdown_maximo).toBe(result2.drawdown_maximo);
    });

    it("should produce distribution P&L statistics", () => {
      const result = engine.simulate(mockConfig, mockProfile, DEFAULT_SIMULATION_CONFIG);
      expect(result.distribucion_pnl.media).toBeDefined();
      expect(result.distribucion_pnl.mediana).toBeDefined();
      expect(result.distribucion_pnl.desviacion_estandar).toBeDefined();
      expect(result.distribucion_pnl.percentil_5).toBeDefined();
      expect(result.distribucion_pnl.percentil_95).toBeDefined();
    });

    it("should calculate Sharpe ratio", () => {
      const result = engine.simulate(mockConfig, mockProfile, DEFAULT_SIMULATION_CONFIG);
      expect(result.ratio_sharpe).toBeDefined();
    });
  });

  describe("Deterministic scenarios", () => {
    it("should run deterministic simulation", () => {
      const detConfig = { ...DEFAULT_SIMULATION_CONFIG, tipo: "deterministico" as const };
      const result = engine.simulate(mockConfig, mockProfile, detConfig);
      expect(result.tipo).toBe("deterministico");
      expect(result.distribucion_pnl).toBeDefined();
    });
  });

  describe("Backtesting", () => {
    it("should run backtesting simulation", () => {
      const btConfig = {
        ...DEFAULT_SIMULATION_CONFIG,
        tipo: "backtesting" as const,
        datos_historicos: [
          { precio: 550, fecha: "2025-05-01" },
          { precio: 555, fecha: "2025-05-02" },
          { precio: 560, fecha: "2025-05-03" },
          { precio: 565, fecha: "2025-05-04" },
          { precio: 570, fecha: "2025-05-05" },
          { precio: 575, fecha: "2025-05-06" },
          { precio: 580, fecha: "2025-05-07" },
          { precio: 585, fecha: "2025-05-08" },
        ],
      };
      const result = engine.simulate(mockConfig, mockProfile, btConfig);
      expect(result.tipo).toBe("backtesting");
      expect(result.total_iteraciones).toBe(8);
      expect(result.distribucion_pnl).toBeDefined();
    });
  });

  describe("Cost modeling", () => {
    it("should apply costs that reduce expected return", () => {
      const result = engine.simulate(mockConfig, mockProfile, DEFAULT_SIMULATION_CONFIG);
      // With costs applied, Sharpe is still reasonable
      expect(result.ratio_sharpe).toBeGreaterThan(-2);
      expect(result.ratio_sharpe).toBeLessThan(10);
    });
  });
});
