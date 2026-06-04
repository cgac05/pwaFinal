import { describe, it, expect } from "vitest";
import { createCondorEngine } from "../../../../src/modules/strategies/complex/condorEngine";
import type { ComplexStrategyConfig } from "../../../../src/modules/strategies/complex/complexStrategyContract";

describe("CondorEngine", () => {
  const engine = createCondorEngine();

  const validCallConfig: ComplexStrategyConfig = {
    ticker: "SPY",
    expiracion: "2025-06-20",
    tipo_ala: "short",
    tolerancia_riesgo: "medio",
    estilo_opcion: "europea",
    version: 1,
    legs: [
      { tipo: "call", strike: 550, prima: 10.00, posicion: "long", contratos: 1 },
      { tipo: "call", strike: 570, prima: 6.00, posicion: "short", contratos: 1 },
      { tipo: "call", strike: 590, prima: 3.00, posicion: "short", contratos: 1 },
      { tipo: "call", strike: 610, prima: 1.50, posicion: "long", contratos: 1 },
    ],
  };

  const validPutConfig: ComplexStrategyConfig = {
    ticker: "SPY",
    expiracion: "2025-06-20",
    tipo_ala: "short",
    tolerancia_riesgo: "medio",
    estilo_opcion: "europea",
    version: 1,
    legs: [
      { tipo: "put", strike: 610, prima: 9.00, posicion: "long", contratos: 1 },
      { tipo: "put", strike: 590, prima: 5.00, posicion: "short", contratos: 1 },
      { tipo: "put", strike: 570, prima: 2.50, posicion: "short", contratos: 1 },
      { tipo: "put", strike: 550, prima: 1.00, posicion: "long", contratos: 1 },
    ],
  };

  describe("validateConfig", () => {
    it("should accept a valid Call Condor configuration", () => {
      const result = engine.validateConfig(validCallConfig);
      expect(result.valido).toBe(true);
      expect(result.errores).toHaveLength(0);
    });

    it("should accept a valid Put Condor configuration", () => {
      const result = engine.validateConfig(validPutConfig);
      expect(result.valido).toBe(true);
      expect(result.errores).toHaveLength(0);
    });

    it("should reject configuration with wrong number of legs", () => {
      const config = { ...validCallConfig, legs: validCallConfig.legs.slice(0, 3) };
      const result = engine.validateConfig(config);
      expect(result.valido).toBe(false);
    });

    it("should reject mixed option types", () => {
      const config = {
        ...validCallConfig,
        legs: [
          { tipo: "call", strike: 550, prima: 10.00, posicion: "long", contratos: 1 },
          { tipo: "put", strike: 570, prima: 6.00, posicion: "short", contratos: 1 },
          { tipo: "call", strike: 590, prima: 3.00, posicion: "short", contratos: 1 },
          { tipo: "call", strike: 610, prima: 1.50, posicion: "long", contratos: 1 },
        ],
      };
      const result = engine.validateConfig(config);
      expect(result.valido).toBe(false);
    });
  });

  describe("calculateProfile", () => {
    it("should calculate profile for Call Condor", () => {
      const profile = engine.calculateProfile(validCallConfig);
      expect(profile.payoff_curve.length).toBeGreaterThan(50);
      expect(profile.break_even_points.length).toBeGreaterThanOrEqual(1);
    });

    it("should calculate profile for Put Condor", () => {
      const profile = engine.calculateProfile(validPutConfig);
      expect(profile.credito_neto).toBeDefined();
      expect(profile.payoff_curve.length).toBeGreaterThan(50);
    });

    it("should generate temporal payoff curves", () => {
      const profile = engine.calculateProfile(validCallConfig);
      expect(profile.payoff_temporal).toBeDefined();
      expect(profile.payoff_temporal!.length).toBeGreaterThan(0);
    });

    it("should identify profit plateau between short strikes", () => {
      const profile = engine.calculateProfile(validCallConfig);
      // For condor, max gain is in the plateau between short strikes
      // Between 570 and 590, max gain = wing width * 100 - net debit
      expect(profile.ganancia_maxima).toBeGreaterThan(0);
      expect(profile.perdida_maxima).toBeGreaterThan(0);
    });

    it("should throw for invalid configuration", () => {
      const badConfig = { ...validCallConfig, legs: [] };
      expect(() => engine.calculateProfile(badConfig)).toThrow();
    });
  });
});
