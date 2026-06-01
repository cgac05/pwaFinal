/**
 * FIC: Unit tests for ComplexReportEngine.
 * FIC: Tests unitarios para ComplexReportEngine.
 */

import { describe, it, expect } from "vitest";
import { ComplexReportEngine } from "../../../../src/modules/strategies/complex/complexReportEngine";
import type { ComplexStrategyConfig, StrategyProfile, PayoffPoint } from "../../../../src/modules/strategies/complex/complexStrategyContract";
import type { SimulationResult } from "../../../../src/modules/strategies/complex/complexSimulationEngine";
import type { RiskAssessment } from "../../../../src/modules/strategies/complex/complexRiskEngine";

describe("ComplexReportEngine", () => {
  const engine = new ComplexReportEngine();

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

  const mockPayoffPoints: PayoffPoint[] = [
    { precio_subyacente: 520, pnl: -1500 },
    { precio_subyacente: 540, pnl: -1500 },
    { precio_subyacente: 555, pnl: 0 },
    { precio_subyacente: 560, pnl: 500 },
    { precio_subyacente: 575, pnl: 500 },
    { precio_subyacente: 590, pnl: 500 },
    { precio_subyacente: 595, pnl: 0 },
    { precio_subyacente: 610, pnl: -1500 },
    { precio_subyacente: 630, pnl: -1500 },
  ];

  const mockProfile: StrategyProfile = {
    credito_neto: 500,
    tipo_neto: "credito",
    break_even_points: [555, 595],
    perdida_maxima: 1500,
    ganancia_maxima: 500,
    payoff_curve: mockPayoffPoints,
    payoff_vencimiento: mockPayoffPoints,
    payoff_temporal: mockPayoffPoints,
    ratio_riesgo_beneficio: 0.33,
    probabilidad_ganancia: 65,
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
    total_iteraciones: 10000,
    semilla: 12345,
    tiempo_ms: 150,
    distribucion_pnl: {
      media: 200,
      mediana: 180,
      desviacion_estandar: 500,
      percentil_5: -800,
      percentil_25: -300,
      percentil_75: 600,
      percentil_95: 1200,
      maximo: 2000,
      minimo: -2000,
    },
    muestras: [],
    costos_totales: 30,
    costos_detalle: {
      slippage_total: 10,
      comisiones_totales: 5,
      spread_total: 15,
    },
  };

  const mockRisk: RiskAssessment = {
    riesgo_aceptable: true,
    puntaje_riesgo: 15,
    eventos: [
      {
        id: "RISK-1",
        timestamp: new Date().toISOString(),
        severidad: "warning",
        categoria: "PROBABILIDAD_EXITO",
        mensaje: "Probabilidad de exito moderada",
        message: "Moderate probability of success",
        valor_actual: 65,
        limite: 80,
        bloquea: false,
      },
    ],
    resumen: "RIESGO MODERADO: 1 advertencia(s).",
    accion_recomendada: "Monitorear factores de advertencia.",
  };

  describe("generateReport", () => {
    it("should generate a complete report with all required fields", () => {
      const report = engine.generateReport(mockConfig, mockProfile, mockSimulation, mockRisk, "iron_condor");

      expect(report.metadata.ticker).toBe("SPY");
      expect(report.metadata.tipo_estrategia).toBe("iron_condor");
      expect(report.metadata.fecha_analisis).toBeDefined();
      expect(report.metadata.tiempo_calculo_ms).toBeGreaterThanOrEqual(0);

      expect(report.perfil.credito_neto).toBe(500);
      expect(report.perfil.tipo_neto).toBe("credito");
      expect(report.perfil.perdida_maxima).toBe(1500);
      expect(report.perfil.ganancia_maxima).toBe(500);
      expect(report.perfil.ratio_riesgo_beneficio).toBe(0.33);
      expect(report.perfil.break_even_points).toEqual([555, 595]);
    });

    it("should include payoff expiration curve with annotations", () => {
      const report = engine.generateReport(mockConfig, mockProfile, mockSimulation, mockRisk);
      expect(report.payoff.expiracion.curva.length).toBeGreaterThan(0);
      expect(report.payoff.expiracion.break_even.length).toBe(2);
      expect(report.payoff.expiracion.perdida_maxima).not.toBeNull();
      expect(report.payoff.expiracion.ganancia_maxima).not.toBeNull();
      expect(report.payoff.expiracion.zonas.length).toBeGreaterThan(0);
    });

    it("should include temporal payoff curve when available", () => {
      const report = engine.generateReport(mockConfig, mockProfile, mockSimulation, mockRisk);
      expect(report.payoff.temporal).toBeDefined();
      expect(report.payoff.temporal!.curva.length).toBeGreaterThan(0);
    });

    it("should handle missing temporal payoff curve", () => {
      const profileNoTemporal = { ...mockProfile, payoff_temporal: undefined };
      const report = engine.generateReport(mockConfig, profileNoTemporal, mockSimulation, mockRisk);
      expect(report.payoff.temporal).toBeUndefined();
    });

    it("should include heatmap with cells", () => {
      const report = engine.generateReport(mockConfig, mockProfile, mockSimulation, mockRisk);
      expect(report.heatmap).toBeDefined();
      expect(report.heatmap!.celdas.length).toBeGreaterThan(0);
      expect(report.heatmap!.precio_min).toBeLessThan(report.heatmap!.precio_max);
      expect(report.heatmap!.dte_max).toBeGreaterThan(0);
    });

    it("should include simulation summary", () => {
      const report = engine.generateReport(mockConfig, mockProfile, mockSimulation, mockRisk);
      expect(report.simulacion.tipo).toBe("monte_carlo");
      expect(report.simulacion.probabilidad_exito).toBe(65);
      expect(report.simulacion.rendimiento_esperado).toBe(250);
      expect(report.simulacion.ratio_sharpe).toBe(1.2);
      expect(report.simulacion.drawdown_maximo).toBe(800);
    });

    it("should include risk assessment summary", () => {
      const report = engine.generateReport(mockConfig, mockProfile, mockSimulation, mockRisk);
      expect(report.riesgo.puntaje).toBe(15);
      expect(report.riesgo.aceptable).toBe(true);
      expect(report.riesgo.eventos).toBe(1);
      expect(report.riesgo.resumen.length).toBeGreaterThan(0);
      expect(report.riesgo.accion_recomendada.length).toBeGreaterThan(0);
    });

    it("should use default strategy type when not provided", () => {
      const report = engine.generateReport(mockConfig, mockProfile, mockSimulation, mockRisk);
      expect(report.metadata.tipo_estrategia).toBe("complex");
    });
  });

  describe("generateSummary", () => {
    it("should return a compact summary with profile, simulation, and risk", () => {
      const summary = engine.generateSummary(mockProfile, mockSimulation, mockRisk);
      expect(summary.perfil).toBeDefined();
      expect(summary.simulacion).toBeDefined();
      expect(summary.riesgo).toBeDefined();
    });

    it("should include key metrics in the summary", () => {
      const summary = engine.generateSummary(mockProfile, mockSimulation, mockRisk);
      expect(summary.perfil.credito_neto).toBe(500);
      expect(summary.simulacion.prob_exito).toBe(65);
      expect(summary.riesgo.puntaje).toBe(15);
      expect(summary.riesgo.aceptable).toBe(true);
    });

    it("should count blocking and non-blocking events", () => {
      const modifiedRisk: RiskAssessment = {
        ...mockRisk,
        eventos: [
          { id: "R1", timestamp: "", severidad: "blocking", categoria: "TEST", mensaje: "Block", message: "Block", valor_actual: 1, limite: 0, bloquea: true },
          { id: "R2", timestamp: "", severidad: "warning", categoria: "TEST", mensaje: "Warn", message: "Warn", valor_actual: 1, limite: 0, bloquea: false },
        ],
      };
      const summary = engine.generateSummary(mockProfile, mockSimulation, modifiedRisk);
      expect(summary.riesgo.bloqueos).toBe(1);
      expect(summary.riesgo.advertencias).toBe(1);
    });
  });

  describe("toJSON", () => {
    it("should serialize report to valid JSON string", () => {
      const report = engine.generateReport(mockConfig, mockProfile, mockSimulation, mockRisk);
      const json = engine.toJSON(report);
      expect(typeof json).toBe("string");
      const parsed = JSON.parse(json);
      expect(parsed.metadata.ticker).toBe("SPY");
      expect(parsed.perfil.credito_neto).toBe(500);
    });
  });

  describe("toCSVRows", () => {
    it("should return array of metric rows", () => {
      const report = engine.generateReport(mockConfig, mockProfile, mockSimulation, mockRisk);
      const rows = engine.toCSVRows(report);
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
    });

    it("should include all key metrics", () => {
      const report = engine.generateReport(mockConfig, mockProfile, mockSimulation, mockRisk);
      const rows = engine.toCSVRows(report);
      const metrics = rows.map((r) => r.metric);
      expect(metrics).toContain("Net Credit/Debit");
      expect(metrics).toContain("Max Loss");
      expect(metrics).toContain("Max Gain");
      expect(metrics).toContain("Risk/Reward Ratio");
      expect(metrics).toContain("Probability of Profit");
      expect(metrics).toContain("Sharpe Ratio");
    });

    it("should include risk status in CSV rows", () => {
      const riskNotAcceptable: RiskAssessment = {
        ...mockRisk,
        riesgo_aceptable: false,
      };
      const report = engine.generateReport(mockConfig, mockProfile, mockSimulation, riskNotAcceptable);
      const rows = engine.toCSVRows(report);
      const riskRow = rows.find((r) => r.metric === "Risk Acceptable");
      expect(riskRow).toBeDefined();
      expect(riskRow!.value).toBe("No");
    });
  });

  describe("buildAnnotatedCurve (via generateReport)", () => {
    it("should mark breakeven points at expected prices", () => {
      const report = engine.generateReport(mockConfig, mockProfile, mockSimulation, mockRisk);
      const bePoints = report.payoff.expiracion.break_even.map((be) => be.precio);
      expect(bePoints).toContain(555);
      expect(bePoints).toContain(595);
    });

    it("should identify profit and loss zones", () => {
      const report = engine.generateReport(mockConfig, mockProfile, mockSimulation, mockRisk);
      const zonas = report.payoff.expiracion.zonas;
      expect(zonas.length).toBeGreaterThanOrEqual(2);

      const profitZones = zonas.filter((z) => z.tipo === "ganancia");
      const lossZones = zonas.filter((z) => z.tipo === "perdida");
      expect(profitZones.length).toBeGreaterThan(0);
      expect(lossZones.length).toBeGreaterThan(0);
    });

    it("should calculate zone areas as positive numbers", () => {
      const report = engine.generateReport(mockConfig, mockProfile, mockSimulation, mockRisk);
      for (const zone of report.payoff.expiracion.zonas) {
        expect(zone.area).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("buildHeatmap (via generateReport)", () => {
    it("should generate heatmap with multiple DTE values", () => {
      const report = engine.generateReport(mockConfig, mockProfile, mockSimulation, mockRisk);
      const uniqueDtes = [...new Set(report.heatmap!.celdas.map((c) => c.dias_restantes))];
      expect(uniqueDtes.length).toBeGreaterThan(1);
    });

    it("should classify each cell as ganancia, perdida, or equilibrio", () => {
      const report = engine.generateReport(mockConfig, mockProfile, mockSimulation, mockRisk);
      for (const cell of report.heatmap!.celdas) {
        expect(["ganancia", "perdida", "equilibrio"]).toContain(cell.tipo);
      }
    });

    it("should have consistent P&L ranges", () => {
      const report = engine.generateReport(mockConfig, mockProfile, mockSimulation, mockRisk);
      expect(report.heatmap!.pnl_max).toBeGreaterThanOrEqual(report.heatmap!.pnl_min);
    });
  });
});
