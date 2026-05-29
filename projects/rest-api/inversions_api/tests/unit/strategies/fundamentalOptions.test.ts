import { describe, expect, it } from "vitest";
import type { OptionStrategyContract } from "../../../src/modules/strategies/optionsStrategyContract";
import { calculateLongCallResult } from "../../../src/modules/strategies/options/longCall";
import { calculateLongPutResult } from "../../../src/modules/strategies/options/longPut";
import { calculateShortCallResult } from "../../../src/modules/strategies/options/shortCall";
import { calculateShortPutResult } from "../../../src/modules/strategies/options/shortPut";
import { simulateStrategy } from "../../../src/modules/strategies/simulationEngine";
import { AlertService } from "../../../src/modules/strategies/alertService";
import { compareStrategies } from "../../../src/modules/strategies/strategyComparator";
import type { StrategyOutput } from "../../../src/modules/strategies/standards/strategyOutputStandard";

const baseParams: OptionStrategyContract = {
  ticker: "AAPL",
  optionType: "call",
  strikePrice: 100,
  expirationDate: "2026-12-31",
  premium: 2,
  quantity: 1,
  direction: "long",
  capitalAvailable: 10000,
  riskTolerance: "medium"
};

describe("Fundamental options strategy scaffolding", () => {
  it("calculates a long call profile", () => {
    const result = calculateLongCallResult(baseParams);
    expect(result.breakEven).toBe(102);
    expect(result.maxLoss).toBe(200);
    expect(result.maxProfit).toBe(Number.POSITIVE_INFINITY);
  });

  it("calculates a long put profile", () => {
    const params = { ...baseParams, optionType: "put" };
    const result = calculateLongPutResult(params);
    expect(result.breakEven).toBe(98);
    expect(result.maxProfit).toBe((params.strikePrice - params.premium) * params.quantity * 100);
  });

  it("calculates a short call profile with margin requirements", () => {
    const params = { ...baseParams, direction: "short" };
    const result = calculateShortCallResult(params);
    expect(result.maxProfit).toBe(200);
    expect(result.requiredMargin).toBe(2000);
  });

  it("calculates a short put profile with finite loss", () => {
    const params = { ...baseParams, optionType: "put", direction: "short" };
    const result = calculateShortPutResult(params);
    expect(result.maxLoss).toBe((params.strikePrice - params.premium) * params.quantity * 100);
  });

  it("runs a simulation engine and returns a path", () => {
    const simulation = simulateStrategy(baseParams, [100, 105, 110, 95]);
    expect(simulation.pnlPath).toHaveLength(4);
    expect(simulation.maxDrawdown).toBeLessThanOrEqual(0);
  });

  it("triggers alerts on stop-loss and take-profit levels", () => {
    const alertService = new AlertService();
    const stopLoss = alertService.evaluateAlert(96, baseParams);
    const takeProfit = alertService.evaluateAlert(104, baseParams);

    expect(stopLoss).not.toBeNull();
    expect(stopLoss?.type).toBe("STOP_LOSS");
    expect(takeProfit).not.toBeNull();
    expect(takeProfit?.type).toBe("TAKE_PROFIT");
  });

  it("compares strategy outputs and chooses the highest score", () => {
    const outputs: StrategyOutput[] = [
      {
        id: "1",
        trace_id: "t1",
        source: "fundamental",
        instrumento: "AAPL",
        tipo_recomendacion: "compra",
        confluencia_score: 0.2,
        confianza_nivel: "ALTA",
        score_breakdown: {
          total: 0.2,
          componentes: { fundamental: 0.2, tecnico: 0.0, mecanico: 0.0, machine_learning: 0.0 },
          razon: "Low score",
          num_estrategias_coincidentes: 1,
          num_estrategias_conflictivas: 0
        },
        evidencia: [],
        generada_en: new Date()
      },
      {
        id: "2",
        trace_id: "t2",
        source: "fundamental",
        instrumento: "AAPL",
        tipo_recomendacion: "compra",
        confluencia_score: 0.8,
        confianza_nivel: "ALTA",
        score_breakdown: {
          total: 0.8,
          componentes: { fundamental: 0.8, tecnico: 0.0, mecanico: 0.0, machine_learning: 0.0 },
          razon: "Higher score",
          num_estrategias_coincidentes: 1,
          num_estrategias_conflictivas: 0
        },
        evidencia: [],
        generada_en: new Date()
      }
    ];

    const comparison = compareStrategies(outputs);
    expect(comparison.chosen?.id).toBe("2");
    expect(comparison.ranking[0].score).toBe(0.8);
  });
});
