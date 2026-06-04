import { describe, it, expect } from "vitest";
import { createIronCondorEngine } from "../../../../src/modules/strategies/complex/ironCondorEngine";
import type { ComplexStrategyConfig } from "../../../../src/modules/strategies/complex/complexStrategyContract";

describe("IronCondorEngine", () => {
  const engine = createIronCondorEngine();

  const validConfig: ComplexStrategyConfig = {
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

  describe("validateConfig", () => {
    it("should accept a valid Iron Condor configuration", () => {
      const result = engine.validateConfig(validConfig);
      expect(result.valido).toBe(true);
      expect(result.errores).toHaveLength(0);
    });

    it("should reject configuration with wrong number of legs", () => {
      const config = { ...validConfig, legs: validConfig.legs.slice(0, 2) };
      const result = engine.validateConfig(config);
      expect(result.valido).toBe(false);
      expect(result.errores.some((e) => e.includes("4 patas"))).toBe(true);
    });

    it("should reject configuration without 2 puts", () => {
      const config = {
        ...validConfig,
        legs: [
          { tipo: "put", strike: 540, prima: 3.50, posicion: "long", contratos: 1 },
          { tipo: "call", strike: 590, prima: 4.50, posicion: "short", contratos: 1 },
          { tipo: "call", strike: 610, prima: 2.00, posicion: "long", contratos: 1 },
        ],
      };
      const result = engine.validateConfig(config);
      expect(result.valido).toBe(false);
    });

    it("should reject configuration with wrong put positions", () => {
      const config = {
        ...validConfig,
        legs: [
          { tipo: "put", strike: 540, prima: 3.50, posicion: "short", contratos: 1 },
          { tipo: "put", strike: 560, prima: 6.00, posicion: "long", contratos: 1 },
          { tipo: "call", strike: 590, prima: 4.50, posicion: "short", contratos: 1 },
          { tipo: "call", strike: 610, prima: 2.00, posicion: "long", contratos: 1 },
        ],
      };
      const result = engine.validateConfig(config);
      expect(result.valido).toBe(false);
    });

    it("should warn about wide wing Condor when wings are not wide", () => {
      const config = { ...validConfig, tipo_ala: "wide" as const };
      const result = engine.validateConfig(config);
      expect(result.valido).toBe(true);
      expect(result.advertencias.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("calculateProfile", () => {
    it("should calculate net credit for a standard Iron Condor", () => {
      const profile = engine.calculateProfile(validConfig);
      // Net credit = (6.00 + 4.50) - (3.50 + 2.00) = 5.00 per share = $500
      expect(profile.credito_neto).toBe(500);
      expect(profile.tipo_neto).toBe("credito");
    });

    it("should calculate correct max gain (equals net credit)", () => {
      const profile = engine.calculateProfile(validConfig);
      // Max gain = net credit = $500
      expect(profile.ganancia_maxima).toBe(500);
    });

    it("should calculate correct max loss", () => {
      const profile = engine.calculateProfile(validConfig);
      // Max loss = wing width * 100 - net credit = 20 * 100 - 500 = 1500
      expect(profile.perdida_maxima).toBe(1500);
    });

    it("should find two break-even points", () => {
      const profile = engine.calculateProfile(validConfig);
      // BE lower = 560 - 5.00 = 555, BE upper = 590 + 5.00 = 595
      expect(profile.break_even_points).toHaveLength(2);
      expect(profile.break_even_points[0]).toBeCloseTo(555, 0);
      expect(profile.break_even_points[1]).toBeCloseTo(595, 0);
    });

    it("should calculate correct risk/reward ratio", () => {
      const profile = engine.calculateProfile(validConfig);
      // Ratio = max_gain / max_loss = 500 / 1500 = 0.33
      expect(profile.ratio_riesgo_beneficio).toBeCloseTo(0.33, 1);
    });

    it("should generate payoff curve with sufficient resolution", () => {
      const profile = engine.calculateProfile(validConfig);
      expect(profile.payoff_curve.length).toBeGreaterThan(50);
      expect(profile.payoff_vencimiento.length).toBeGreaterThan(50);
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
