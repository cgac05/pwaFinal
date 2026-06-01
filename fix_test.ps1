$path = "D:\inversions_app_pwa-main\projects\rest-api\inversions_api\tests\unit\strategies\complex\complexStrategies.test.ts"

$content = @"
/**
 * FIC: English/Español
 * Unit tests for complex options strategy engines (Iron Condor, Iron Butterfly, Butterfly Spread, Condor).
 * Uses the actual class-based API (createEngines + calculateProfile/validateConfig).
 *
 * Pruebas unitarias para los motores de estrategias de opciones complejas.
 * Usa la API real basada en clases (createEngines + calculateProfile/validateConfig).
 */

import { describe, expect, it } from "vitest";
import { createIronCondorEngine } from "../../../../src/modules/strategies/complex/ironCondorEngine";
import { createIronButterflyEngine } from "../../../../src/modules/strategies/complex/ironButterflyEngine";
import { createButterflySpreadEngine } from "../../../../src/modules/strategies/complex/butterflySpreadEngine";
import { createCondorEngine } from "../../../../src/modules/strategies/complex/condorEngine";
import { ComplexSimulationEngine } from "../../../../src/modules/strategies/complex/complexSimulationEngine";
import { ComplexRiskEngine } from "../../../../src/modules/strategies/complex/complexRiskEngine";
import { ComplexReportEngine } from "../../../../src/modules/strategies/complex/complexReportEngine";
import type { ComplexStrategyConfig } from "../../../../src/modules/strategies/complex/complexStrategyContract";

function buildICConfig(o: Partial<ComplexStrategyConfig> = {}): ComplexStrategyConfig {
  return { ticker: "COCA", expiracion: "2026-06-20", tipo_ala: "short", tolerancia_riesgo: "medio", estilo_opcion: "europea", version: 1, legs: [
    { tipo: "put", strike: 90, prima: 0.5, posicion: "long", contratos: 1 },
    { tipo: "put", strike: 95, prima: 1.5, posicion: "short", contratos: 1 },
    { tipo: "call", strike: 105, prima: 1.4, posicion: "short", contratos: 1 },
    { tipo: "call", strike: 110, prima: 0.4, posicion: "long", contratos: 1 },
  ], ...o };
}

function buildIBConfig(o: Partial<ComplexStrategyConfig> = {}): ComplexStrategyConfig {
  return { ticker: "COCA", expiracion: "2026-06-20", tipo_ala: "short", tolerancia_riesgo: "medio", estilo_opcion: "europea", version: 1, legs: [
    { tipo: "put", strike: 90, prima: 0.8, posicion: "long", contratos: 1 },
    { tipo: "put", strike: 100, prima: 3.5, posicion: "short", contratos: 1 },
    { tipo: "call", strike: 100, prima: 3.5, posicion: "short", contratos: 1 },
    { tipo: "call", strike: 110, prima: 0.8, posicion: "long", contratos: 1 },
  ], ...o };
}

function buildBSCfg(o: Partial<ComplexStrategyConfig> = {}): ComplexStrategyConfig {
  return { ticker: "COCA", expiracion: "2026-06-20", tipo_ala: "short", tolerancia_riesgo: "medio", estilo_opcion: "europea", version: 1, legs: [
    { tipo: "call", strike: 95, prima: 5.5, posicion: "long", contratos: 1 },
    { tipo: "call", strike: 100, prima: 2.2, posicion: "short", contratos: 2 },
    { tipo: "call", strike: 105, prima: 0.5, posicion: "long", contratos: 1 },
  ], ...o };
}

function buildCDCfg(o: Partial<ComplexStrategyConfig> = {}): ComplexStrategyConfig {
  return { ticker: "COCA", expiracion: "2026-06-20", tipo_ala: "short", tolerancia_riesgo: "medio", estilo_opcion: "europea", version: 1, legs: [
    { tipo: "call", strike: 90, prima: 9.5, posicion: "long", contratos: 1 },
    { tipo: "call", strike: 95, prima: 5.2, posicion: "short", contratos: 1 },
    { tipo: "call", strike: 105, prima: 1.2, posicion: "short", contratos: 1 },
    { tipo: "call", strike: 110, prima: 0.3, posicion: "long", contratos: 1 },
  ], ...o };
}

describe("Complex Options Strategy Engines", () => {

  describe("Iron Condor", () => {
    const e = createIronCondorEngine();
    it("net credit = $200", () => { const p = e.calculateProfile(buildICConfig()); expect(p.credito_neto).toBe(200); expect(p.tipo_neto).toBe("credito"); });
    it("max gain = $200", () => { expect(e.calculateProfile(buildICConfig()).ganancia_maxima).toBe(200); });
    it("max loss = $300", () => { expect(e.calculateProfile(buildICConfig()).perdida_maxima).toBe(300); });
    it("2 break-even points", () => { expect(e.calculateProfile(buildICConfig()).break_even_points).toHaveLength(2); });
    it("throws on invalid", () => { expect(() => e.calculateProfile(buildICConfig({ legs: [] }))).toThrow(); });
    it("payoff curve + temporal", () => { const p = e.calculateProfile(buildICConfig()); expect(p.payoff_curve.length).toBeGreaterThan(50); expect(p.payoff_temporal!.length).toBeGreaterThan(0); });
  });

  describe("Iron Butterfly", () => {
    const e = createIronButterflyEngine();
    it("net credit > 0", () => { const p = e.calculateProfile(buildIBConfig()); expect(p.credito_neto).toBeGreaterThan(0); expect(p.tipo_neto).toBe("credito"); });
    it("throws if body strikes mismatch", () => { expect(() => e.calculateProfile(buildIBConfig({ legs: [
      { tipo: "put", strike: 90, prima: 0.8, posicion: "long", contratos: 1 },
      { tipo: "put", strike: 99, prima: 3.5, posicion: "short", contratos: 1 },
      { tipo: "call", strike: 100, prima: 3.5, posicion: "short", contratos: 1 },
      { tipo: "call", strike: 110, prima: 0.8, posicion: "long", contratos: 1 },
    ] }))).toThrow(); });
    it("payoff curve + temporal", () => { const p = e.calculateProfile(buildIBConfig()); expect(p.payoff_curve.length).toBeGreaterThan(50); expect(p.payoff_temporal!.length).toBeGreaterThan(0); });
  });

  describe("Butterfly Spread", () => {
    const e = createButterflySpreadEngine();
    it("net debit = $160", () => { const p = e.calculateProfile(buildBSCfg()); expect(p.credito_neto).toBe(-160); expect(p.tipo_neto).toBe("debito"); });
    it("max loss = $160", () => { expect(e.calculateProfile(buildBSCfg()).perdida_maxima).toBe(160); });
    it("max gain > 0", () => { expect(e.calculateProfile(buildBSCfg()).ganancia_maxima).toBeGreaterThan(0); });
    it("payoff curve + temporal", () => { const p = e.calculateProfile(buildBSCfg()); expect(p.payoff_curve.length).toBeGreaterThan(50); expect(p.payoff_temporal!.length).toBeGreaterThan(0); });
  });

  describe("Condor", () => {
    const e = createCondorEngine();
    it("calculates profile", () => { const p = e.calculateProfile(buildCDCfg()); expect(p.credito_neto).toBeDefined(); expect(p.payoff_curve.length).toBeGreaterThan(50); });
    it("max gain and max loss", () => { const p = e.calculateProfile(buildCDCfg()); expect(p.ganancia_maxima).toBeGreaterThan(0); expect(p.perdida_maxima).toBeGreaterThan(0); });
    it("temporal curves", () => { expect(e.calculateProfile(buildCDCfg()).payoff_temporal!.length).toBeGreaterThan(0); });
  });

  describe("Sim + Risk + Report", () => {
    it("should run full pipeline", () => {
      const p = createIronCondorEngine().calculateProfile(buildICConfig());
      const sim = new ComplexSimulationEngine().simulate(buildICConfig(), p);
      const risk = new ComplexRiskEngine().evaluate(buildICConfig(), p, sim, { valor_portafolio_usd: 50000, poder_compra_usd: 25000, margen_actual_usd: 0, posiciones_actuales: 0 });
      const rpt = new ComplexReportEngine().generateReport(buildICConfig(), p, sim, risk, "iron_condor");
      expect(sim.probabilidad_exito).toBeGreaterThanOrEqual(0);
      expect(sim.probabilidad_exito).toBeLessThanOrEqual(100);
      expect(risk.puntaje_riesgo).toBeGreaterThanOrEqual(0);
      expect(rpt.metadata.tipo_estrategia).toBe("iron_condor");
    });
  });

});
"@

Set-Content -Path $path -Value $content -Encoding UTF8
Write-Host "FILE_WRITTEN_OK"
