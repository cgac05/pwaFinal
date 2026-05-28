import { describe, it, expect } from "vitest";
import { createButterflySpreadEngine } from "../../../../src/modules/strategies/complex/butterflySpreadEngine";
import type { ComplexStrategyConfig } from "../../../../src/modules/strategies/complex/complexStrategyContract";

describe("ButterflySpreadEngine", () => {
  const engine = createButterflySpreadEngine();

  const validCallConfig: ComplexStrategyConfig = {
    ticker: "SPY",
    expiracion: "2025-06-20",
    tipo_ala: "short",
    tolerancia_riesgo: "medio",
    estilo_opcion: "europea",
    version: 1,
    legs: [
      { tipo: "call", strike: 560, prima: 8.00, posicion: "long", contratos: 1 },
      { tipo: "call", strike: 580, prima: 4.50, posicion: "short", contratos: 2 },
      { tipo: "call", strike: 600, prima: 2.00, posicion: "long", contratos: 1 },
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
      { tipo: "put", strike: 600, prima: 7.50, posicion: "long", contratos: 1 },
      { tipo: "put", strike: 580, prima: 4.00, posicion: "short", contratos: 2 },
      { tipo: "put", strike: 560, prima: 2.00, posicion: "long", contratos: 1 },
    ],
  };

  describe("validateConfig", () => {
    it("should accept a valid Call Butterfly configuration", () => {
      const result = engine.validateConfig(validCallConfig);
      expect(result.valido).toBe(true);
      expect(result.errores).toHaveLength(0);
    });

    it("should accept a valid Put Butterfly configuration", () => {
      const result = engine.validateConfig(validPutConfig);
      expect(result.valido).toBe(true);
      expect(result.errores).toHaveLength(0);
    });

    it("should reject configuration with wrong number of legs", () => {
      const config = { ...validCallConfig, legs: validCallConfig.legs.slice(0, 2) };
      const result = engine.validateConfig(config);
      expect(result.valido).toBe(false);
    });

    it("should reject mixed option types", () => {
      const config = {
        ...validCallConfig,
        legs: [
          { tipo: "call", strike: 560, prima: 8.00, posicion: "long", contratos: 1 },
          { tipo: "put", strike: 580, prima: 4.50, posicion: "short", contratos: 2 },
          { tipo: "call", strike: 600, prima: 2.00, posicion: "long", contratos: 1 },
        ],
      };
      const result = engine.validateConfig(config);
      expect(result.valido).toBe(false);
    });
  });

  describe("calculateProfile", () => {
    it("should calculate profile for Call Butterfly", () => {
      const profile = engine.calculateProfile(validCallConfig);
      // Net debit = (8.00 + 2.00) - (4.50 * 2) = 1.00 per share = $100
      expect(profile.credito_neto).toBe(-100);
      expect(profile.tipo_neto).toBe("debito");
    });

    it("should calculate profile for Put Butterfly", () => {
      const profile = engine.calculateProfile(validPutConfig);
      expect(profile.credito_neto).toBeDefined();
      expect(profile.payoff_curve.length).toBeGreaterThan(50);
    });

    it("should generate temporal payoff curves", () => {
      const profile = engine.calculateProfile(validCallConfig);
      expect(profile.payoff_temporal).toBeDefined();
      expect(profile.payoff_temporal!.length).toBeGreaterThan(0);
    });

    it("should throw for invalid configuration", () => {
      const badConfig = { ...validCallConfig, legs: [] };
      expect(() => engine.calculateProfile(badConfig)).toThrow();
    });
  });
});
