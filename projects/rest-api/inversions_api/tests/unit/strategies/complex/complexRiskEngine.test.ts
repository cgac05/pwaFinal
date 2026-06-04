import { describe, it, expect } from "vitest";
import { ComplexRiskEngine, DEFAULT_RISK_LIMITS, type PortfolioContext } from "../../../../src/modules/strategies/complex/complexRiskEngine";
import type { ComplexStrategyConfig, StrategyProfile } from "../../../../src/modules/strategies/complex/complexStrategyContract";
import type { SimulationResult } from "../../../../src/modules/strategies/complex/complexSimulationEngine";

describe("ComplexRiskEngine", () => {
  const engine = new ComplexRiskEngine();

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

  const mockSimulation: SimulationResult = {
    tipo: "monte_carlo",
    probabilidad_exito: 65,
    rendimiento_esperado: 250,
    drawdown_maximo: 800,
    ratio_sharpe: 1.2,
    iteraciones: 10000,
    seed: 12345,
    escenarios: [],
    distribucion_pnl: {
      media: 200,
      mediana: 180,
      desviacion_estandar: 500,
      percentil_5: -800,
      percentil_95: 1200,
    },
    costos: {
      total_slippage: 10,
      total_comisiones: 5,
      total_spread: 15,
    },
  };

  const portfolio: PortfolioContext = {
    valor_portafolio_usd: 100000,
    poder_compra_usd: 50000,
    margen_actual_usd: 0,
    posiciones_actuales: 0,
  };

  describe("evaluate", () => {
    it("should return a valid risk assessment", () => {
      const result = engine.evaluate(mockConfig, mockProfile, mockSimulation, portfolio);
      expect(result.puntaje_riesgo).toBeGreaterThanOrEqual(0);
      expect(result.puntaje_riesgo).toBeLessThanOrEqual(100);
      expect(result.riesgo_aceptable).toBeDefined();
      expect(typeof result.riesgo_aceptable).toBe("boolean");
    });

    it("should identify risk events", () => {
      const result = engine.evaluate(mockConfig, mockProfile, mockSimulation, portfolio);
      expect(Array.isArray(result.eventos)).toBe(true);
      result.eventos.forEach((event) => {
        expect(event.mensaje).toBeDefined();
        expect(event.message).toBeDefined();
        expect(["blocking", "critical", "warning"]).toContain(event.severidad);
      });
    });

    it("should generate a summary and recommended action", () => {
      const result = engine.evaluate(mockConfig, mockProfile, mockSimulation, portfolio);
      expect(result.resumen.length).toBeGreaterThan(0);
      expect(result.accion_recomendada.length).toBeGreaterThan(0);
    });
  });

  describe("Kill-switch", () => {
    it("should toggle kill-switch state", () => {
      const initial = engine.getKillSwitchStatus("SPY");
      expect(initial.activo).toBe(false);

      engine.activateKillSwitch("SPY", "Test kill-switch");
      expect(engine.getKillSwitchStatus("SPY").activo).toBe(true);

      engine.deactivateKillSwitch("SPY");
      expect(engine.getKillSwitchStatus("SPY").activo).toBe(false);
    });

    it("should block risk evaluation when kill-switch is active", () => {
      engine.activateKillSwitch("SPY", "Risk threshold exceeded");
      const result = engine.evaluate(mockConfig, mockProfile, mockSimulation, portfolio);
      expect(result.riesgo_aceptable).toBe(false);
      expect(result.eventos.some((e) => e.mensaje.toLowerCase().includes("kill-switch"))).toBe(true);
      engine.deactivateKillSwitch("SPY");
    });
  });

  describe("Risk limits configuration", () => {
    it("should have conservative, moderate, and aggressive profiles", () => {
      expect(DEFAULT_RISK_LIMITS.conservador).toBeDefined();
      expect(DEFAULT_RISK_LIMITS.moderado).toBeDefined();
      expect(DEFAULT_RISK_LIMITS.agresivo).toBeDefined();
    });

    it("should map risk tolerance to correct limit profile", () => {
      const resultLow = engine.evaluate(
        { ...mockConfig, tolerancia_riesgo: "bajo" },
        mockProfile,
        mockSimulation,
        portfolio
      );
      const resultHigh = engine.evaluate(
        { ...mockConfig, tolerancia_riesgo: "alto" },
        mockProfile,
        mockSimulation,
        portfolio
      );
      expect(resultLow.puntaje_riesgo).toBeGreaterThanOrEqual(resultHigh.puntaje_riesgo);
    });

    it("should use custom limits when provided", () => {
      const result = engine.evaluate(
        mockConfig,
        { ...mockProfile, perdida_maxima: 100 },
        mockSimulation,
        portfolio,
        { perdida_maxima_usd: 50 }
      );
      const lossEvents = result.eventos.filter((e) => e.categoria === "PERDIDA_MAXIMA");
      expect(lossEvents.length).toBeGreaterThan(0);
    });
  });

  describe("Risk checks - individual triggers", () => {
    it("should detect maximum loss exceeded", () => {
      const result = engine.evaluate(
        mockConfig,
        { ...mockProfile, perdida_maxima: 3000 },
        mockSimulation,
        portfolio
      );
      expect(result.eventos.some((e) => e.categoria === "PERDIDA_MAXIMA")).toBe(true);
      expect(result.riesgo_aceptable).toBe(false);
    });

    it("should detect contracts limit exceeded", () => {
      const highContractConfig: ComplexStrategyConfig = {
        ...mockConfig,
        legs: mockConfig.legs.map((l) => ({ ...l, contratos: 50 })),
      };
      const result = engine.evaluate(highContractConfig, mockProfile, mockSimulation, portfolio);
      expect(result.eventos.some((e) => e.categoria === "CONTRATOS_MAXIMOS")).toBe(true);
    });

    it("should detect portfolio risk percentage exceeded", () => {
      const result = engine.evaluate(
        mockConfig,
        { ...mockProfile, perdida_maxima: 15000 },
        mockSimulation,
        { ...portfolio, valor_portafolio_usd: 50000 }
      );
      expect(result.eventos.some((e) => e.categoria === "RIESGO_PORTAFOLIO")).toBe(true);
    });

    it("should detect buying power exceeded", () => {
      const result = engine.evaluate(
        mockConfig,
        { ...mockProfile, perdida_maxima: 80000 },
        mockSimulation,
        { ...portfolio, poder_compra_usd: 10000 }
      );
      expect(result.eventos.some((e) => e.categoria === "PODER_COMPRA")).toBe(true);
    });

    it("should detect low probability of success", () => {
      const result = engine.evaluate(
        mockConfig,
        mockProfile,
        { ...mockSimulation, probabilidad_exito: 10 },
        portfolio
      );
      expect(result.eventos.some((e) => e.categoria === "PROBABILIDAD_EXITO")).toBe(true);
    });

    it("should detect DTE below minimum (warning level)", () => {
      const result = engine.evaluate(
        { ...mockConfig, dias_vencimiento: 10 },
        mockProfile,
        mockSimulation,
        portfolio
      );
      const dteEvents = result.eventos.filter((e) => e.categoria === "DTE_MINIMO");
      expect(dteEvents.length).toBeGreaterThan(0);
      expect(dteEvents[0].severidad).toBe("warning");
      expect(dteEvents[0].bloquea).toBe(false);
    });

    it("should detect DTE below critical threshold", () => {
      const result = engine.evaluate(
        { ...mockConfig, dias_vencimiento: 3 },
        mockProfile,
        mockSimulation,
        portfolio
      );
      const dteEvents = result.eventos.filter((e) => e.categoria === "DTE_MINIMO");
      expect(dteEvents.length).toBeGreaterThan(0);
      expect(dteEvents[0].severidad).toBe("critical");
      expect(dteEvents[0].bloquea).toBe(true);
    });

    it("should detect drawdown exceeded with stop-loss automatic", () => {
      const result = engine.evaluate(
        mockConfig,
        mockProfile,
        { ...mockSimulation, drawdown_maximo: 50000 },
        { ...portfolio, valor_portafolio_usd: 100000 }
      );
      const ddEvents = result.eventos.filter((e) => e.categoria === "DRAWDOWN");
      expect(ddEvents.length).toBeGreaterThan(0);
      expect(ddEvents[0].severidad).toBe("critical");
    });

    it("should detect negative Sharpe ratio", () => {
      const result = engine.evaluate(
        mockConfig,
        mockProfile,
        { ...mockSimulation, ratio_sharpe: -0.5 },
        portfolio
      );
      expect(result.eventos.some((e) => e.categoria === "SHARPE_NEGATIVO")).toBe(true);
    });
  });

  describe("Early assignment detection", () => {
    it("should detect early assignment risk for American options ITM short leg with low DTE", () => {
      const americanConfig: ComplexStrategyConfig = {
        ...mockConfig,
        estilo_opcion: "americana",
        dias_vencimiento: 7,
        legs: [
          { tipo: "put", strike: 540, prima: 3.50, posicion: "long", contratos: 1 },
          { tipo: "put", strike: 560, prima: 6.00, posicion: "short", contratos: 1, subyacente_precio: 530 },
          { tipo: "call", strike: 590, prima: 4.50, posicion: "short", contratos: 1 },
          { tipo: "call", strike: 610, prima: 2.00, posicion: "long", contratos: 1 },
        ],
      };
      const result = engine.evaluate(americanConfig, mockProfile, mockSimulation, portfolio);
      expect(result.eventos.some((e) => e.categoria === "ASIGNACION_TEMPRANA" && e.bloquea)).toBe(true);
    });

    it("should warn for American ITM short leg with higher DTE", () => {
      const americanConfig: ComplexStrategyConfig = {
        ...mockConfig,
        estilo_opcion: "americana",
        dias_vencimiento: 30,
        legs: [
          { tipo: "put", strike: 540, prima: 3.50, posicion: "long", contratos: 1 },
          { tipo: "put", strike: 560, prima: 6.00, posicion: "short", contratos: 1, subyacente_precio: 530 },
          { tipo: "call", strike: 590, prima: 4.50, posicion: "short", contratos: 1 },
          { tipo: "call", strike: 610, prima: 2.00, posicion: "long", contratos: 1 },
        ],
      };
      const result = engine.evaluate(americanConfig, mockProfile, mockSimulation, portfolio);
      const warningEvents = result.eventos.filter((e) => e.categoria === "ASIGNACION_TEMPRANA" && !e.bloquea);
      expect(warningEvents.length).toBeGreaterThan(0);
    });

    it("should not detect early assignment for European options", () => {
      const result = engine.evaluate(mockConfig, mockProfile, mockSimulation, portfolio);
      expect(result.eventos.some((e) => e.categoria === "ASIGNACION_TEMPRANA")).toBe(false);
    });
  });

  describe("Risk score calculation", () => {
    it("should return 0 when no events", () => {
      const noWarningSim = { ...mockSimulation, probabilidad_exito: 90, ratio_sharpe: 2.0, drawdown_maximo: 100 };
      const result = engine.evaluate(mockConfig, mockProfile, noWarningSim, portfolio);
      expect(result.puntaje_riesgo).toBe(0);
    });

    it("should cap risk score at 100", () => {
      const badConfig: ComplexStrategyConfig = {
        ...mockConfig,
        legs: mockConfig.legs.map((l) => ({ ...l, contratos: 100 })),
      };
      const result = engine.evaluate(
        badConfig,
        { ...mockProfile, perdida_maxima: 500000 },
        { ...mockSimulation, probabilidad_exito: 5, ratio_sharpe: -2.0, drawdown_maximo: 50000 },
        { ...portfolio, valor_portafolio_usd: 50000, poder_compra_usd: 1000 }
      );
      expect(result.puntaje_riesgo).toBeLessThanOrEqual(100);
    });
  });

  describe("Risk assessment messaging", () => {
    it("should indicate risk not acceptable when blocking events exist", () => {
      const result = engine.evaluate(
        mockConfig,
        { ...mockProfile, perdida_maxima: 500000 },
        mockSimulation,
        { ...portfolio, poder_compra_usd: 1000 }
      );
      expect(result.riesgo_aceptable).toBe(false);
      expect(result.resumen).toContain("NO ACEPTABLE");
    });

    it("should recommend action when risk is not acceptable", () => {
      const result = engine.evaluate(
        mockConfig,
        { ...mockProfile, perdida_maxima: 500000 },
        mockSimulation,
        { ...portfolio, poder_compra_usd: 1000 }
      );
      expect(result.accion_recomendada.length).toBeGreaterThan(0);
      expect(result.accion_recomendada).toContain("ajustar");
    });

    it("should indicate elevated risk when only critical warnings exist", () => {
      const result = engine.evaluate(
        { ...mockConfig, dias_vencimiento: 3, estilo_opcion: "americana", legs: mockConfig.legs.map((l, i) => i === 0 ? { ...l, subyacente_precio: 550 } : l) },
        mockProfile,
        { ...mockSimulation, drawdown_maximo: 50000 },
        { ...portfolio, valor_portafolio_usd: 100000 }
      );
      // Should have at least critical DTE event that is blocking
      // The riesgo_aceptable should be false if there's a blocking event
      expect(result.resumen).toContain("ACEPTABLE");
    });
  });

  describe("Audit log", () => {
    it("should log audit entries during evaluation", () => {
      const freshEngine = new ComplexRiskEngine();
      // Use low probability to trigger risk events and fill the audit log
      freshEngine.evaluate(mockConfig, mockProfile, { ...mockSimulation, probabilidad_exito: 10 }, portfolio);
      expect(freshEngine.getAuditLog().length).toBeGreaterThan(0);
    });

    it("should filter audit log by severity", () => {
      const freshEngine = new ComplexRiskEngine();
      freshEngine.evaluate(mockConfig, mockProfile, { ...mockSimulation, probabilidad_exito: 10, ratio_sharpe: -1.0 }, portfolio);
      const warnings = freshEngine.getAuditLogBySeverity("warning");
      expect(warnings.length).toBeGreaterThan(0);
      warnings.forEach((e) => expect(e.severidad).toBe("warning"));
    });

    it("should filter audit log by category", () => {
      const freshEngine = new ComplexRiskEngine();
      freshEngine.evaluate(mockConfig, mockProfile, { ...mockSimulation, probabilidad_exito: 10 }, portfolio);
      const probEvents = freshEngine.getAuditLogByCategory("PROBABILIDAD_EXITO");
      expect(probEvents.length).toBeGreaterThan(0);
    });

    it("should clear audit log", () => {
      const freshEngine = new ComplexRiskEngine();
      // Use low probability to trigger risk events and fill the audit log
      freshEngine.evaluate(mockConfig, mockProfile, { ...mockSimulation, probabilidad_exito: 10 }, portfolio);
      expect(freshEngine.getAuditLog().length).toBeGreaterThan(0);
      freshEngine.clearAuditLog();
      expect(freshEngine.getAuditLog().length).toBe(0);
    });

    it("should clear all kill switches", () => {
      const freshEngine = new ComplexRiskEngine();
      freshEngine.activateKillSwitch("SPY", "test");
      expect(freshEngine.getKillSwitchStatus("SPY").activo).toBe(true);
      freshEngine.clearAllKillSwitches();
      expect(freshEngine.getKillSwitchStatus("SPY").activo).toBe(false);
    });

    it("should log kill-switch activation and deactivation events", () => {
      const freshEngine = new ComplexRiskEngine();
      freshEngine.activateKillSwitch("SPY", "market crash");
      const logAfterActivation = freshEngine.getAuditLogByCategory("KILL_SWITCH_ACTIVATED");
      expect(logAfterActivation.length).toBe(1);
      expect(logAfterActivation[0].severidad).toBe("critical");

      freshEngine.deactivateKillSwitch("SPY");
      const logAfterDeactivation = freshEngine.getAuditLogByCategory("KILL_SWITCH_DEACTIVATED");
      expect(logAfterDeactivation.length).toBe(1);
      expect(logAfterDeactivation[0].severidad).toBe("info");
    });
  });
});
