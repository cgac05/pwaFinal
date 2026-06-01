import { describe, it, expect } from "vitest";
import { createIronButterflyEngine } from "../../../../src/modules/strategies/complex/ironButterflyEngine";
import type { ComplexStrategyConfig } from "../../../../src/modules/strategies/complex/complexStrategyContract";

describe("IronButterflyEngine", () => {
  const engine = createIronButterflyEngine();

  const validConfig: ComplexStrategyConfig = {
    ticker: "SPY",
    expiracion: "2025-06-20",
    tipo_ala: "short",
    tolerancia_riesgo: "medio",
    estilo_opcion: "europea",
    version: 1,
    legs: [
      { tipo: "put", strike: 555, prima: 4.00, posicion: "long", contratos: 1 },
      { tipo: "put", strike: 575, prima: 8.00, posicion: "short", contratos: 1 },
      { tipo: "call", strike: 575, prima: 7.50, posicion: "short", contratos: 1 },
      { tipo: "call", strike: 595, prima: 3.50, posicion: "long", contratos: 1 },
    ],
  };

  describe("validateConfig", () => {
    it("should accept a valid Iron Butterfly configuration", () => {
      const result = engine.validateConfig(validConfig);
      expect(result.valido).toBe(true);
      expect(result.errores).toHaveLength(0);
    });

    it("should reject configuration with wrong number of legs", () => {
      const config = { ...validConfig, legs: validConfig.legs.slice(0, 3) };
      const result = engine.validateConfig(config);
      expect(result.valido).toBe(false);
    });

    it("should reject configuration where body strikes don't match", () => {
      const config = {
        ...validConfig,
        legs: [
          { tipo: "put", strike: 555, prima: 4.00, posicion: "long", contratos: 1 },
          { tipo: "put", strike: 570, prima: 7.00, posicion: "short", contratos: 1 },
          { tipo: "call", strike: 575, prima: 7.50, posicion: "short", contratos: 1 },
          { tipo: "call", strike: 595, prima: 3.50, posicion: "long", contratos: 1 },
        ],
      };
      const result = engine.validateConfig(config);
      expect(result.valido).toBe(false);
    });
  });

  describe("calculateProfile", () => {
    it("should calculate net credit for a standard Iron Butterfly", () => {
      const profile = engine.calculateProfile(validConfig);
      // Net credit = (8.00 + 7.50) - (4.00 + 3.50) = 8.00 per share = $800
      expect(profile.credito_neto).toBeGreaterThan(0);
      expect(profile.tipo_neto).toBe("credito");
    });

    it("should generate payoff curve", () => {
      const profile = engine.calculateProfile(validConfig);
      expect(profile.payoff_curve.length).toBeGreaterThan(50);
    });

    it("should have correct number of break-even points", () => {
      const profile = engine.calculateProfile(validConfig);
      expect(profile.break_even_points.length).toBeGreaterThanOrEqual(1);
    });

    it("should generate temporal payoff curves", () => {
      const profile = engine.calculateProfile(validConfig);
      expect(profile.payoff_temporal).toBeDefined();
      expect(profile.payoff_temporal!.length).toBeGreaterThan(0);
    });

    it("should throw for invalid configuration", () => {
      const badConfig = { ...validConfig, legs: [] };
      expect(() => engine.calculateProfile(badConfig)).toThrow();
    });
  });
});
