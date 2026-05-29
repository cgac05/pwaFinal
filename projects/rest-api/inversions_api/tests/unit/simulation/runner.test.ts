// FIC: Unit tests T093 — runSimulation pipeline puro, idempotente, inputs_echo.
// FIC: Unit tests for simulation runner (Phase 5 Bloque B).

import { describe, expect, it } from "vitest";
import { runSimulation, validateSimulationRequest } from "../../../src/modules/simulation/runner";
import type { SimulationRequest } from "../../../src/modules/indicators/types";

function buildRequest(overrides: Partial<SimulationRequest> = {}): SimulationRequest {
  return {
    ticket: "AAPL",
    rangoHistorico: "3M",
    rangoEstrategia: { from: "2026-01-01", to: "2026-02-01" },
    temporalidad: "1h",
    runtimeMode: "OFFLINE",
    coresHabilitados: ["A_INDICADORES", "A_FUNDAMENTAL", "A_IA"],
    indicadoresHabilitados: ["RSI", "MACD", "EMA", "ADX", "BB"],
    estrategia: "IRON_CONDOR",
    toleranciaRiesgo: "MEDIO",
    ...overrides
  };
}

describe("validateSimulationRequest", () => {
  it("returns null for a valid request", () => {
    expect(validateSimulationRequest(buildRequest())).toBeNull();
  });

  it("rejects missing ticket", () => {
    const err = validateSimulationRequest(buildRequest({ ticket: "" as any }));
    expect(err?.error_code).toBe("INVALID_SIMULATION_REQUEST");
    expect(err?.field).toBe("ticket");
  });

  it("rejects empty coresHabilitados", () => {
    const err = validateSimulationRequest(buildRequest({ coresHabilitados: [] }));
    expect(err?.field).toBe("coresHabilitados");
  });

  it("rejects from > to in rangoEstrategia", () => {
    const err = validateSimulationRequest(
      buildRequest({ rangoEstrategia: { from: "2026-03-01", to: "2026-01-01" } })
    );
    expect(err?.error_code).toBe("INVALID_RANGE");
  });

  it("rejects unknown estrategia", () => {
    const err = validateSimulationRequest(buildRequest({ estrategia: "INVENTED_STRATEGY" }));
    expect(err?.field).toBe("estrategia");
  });

  it("rejects unknown core in coresHabilitados", () => {
    const err = validateSimulationRequest(buildRequest({ coresHabilitados: ["A_BOGUS" as any] }));
    expect(err?.field).toBe("coresHabilitados");
  });
});

describe("runSimulation", () => {
  it("returns verdict + table + inputs_echo + algorithm_version", async () => {
    const result = await runSimulation(buildRequest());
    expect(result.verdict.symbol).toBe("AAPL");
    expect(Array.isArray(result.table)).toBe(true);
    expect(result.table.length).toBeGreaterThan(0);
    expect(result.inputs_echo.estrategia).toBe("IRON_CONDOR");
    expect(result.algorithm_version).toBeDefined();
  });

  it("filters rows to only enabled cores", async () => {
    const result = await runSimulation(buildRequest({ coresHabilitados: ["A_INDICADORES"] }));
    const cores = new Set(result.table.map((r) => r.core));
    expect([...cores]).toEqual(["A_INDICADORES"]);
  });

  it("flags verdict.degraded when not all 6 cores are enabled", async () => {
    const result = await runSimulation(buildRequest({ coresHabilitados: ["A_INDICADORES"] }));
    expect(result.verdict.degraded).toBe(true);
    expect(result.verdict.missing.some((m) => m.startsWith("core:"))).toBe(true);
  });

  it("is idempotent: same request -> same source_input_hash", async () => {
    const fixed = new Date("2026-01-15T00:00:00Z");
    const a = await runSimulation(buildRequest(), { now: fixed });
    const b = await runSimulation(buildRequest(), { now: fixed });
    expect(a.verdict.source_input_hash).toBe(b.verdict.source_input_hash);
    expect(a.verdict.score).toBe(b.verdict.score);
  });
});
