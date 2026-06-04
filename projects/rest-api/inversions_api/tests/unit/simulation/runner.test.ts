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

  it("accepts an absent or empty fechaHistorica", () => {
    expect(validateSimulationRequest(buildRequest({ fechaHistorica: "" }))).toBeNull();
    expect(validateSimulationRequest(buildRequest({ fechaHistorica: undefined }))).toBeNull();
  });

  it("rejects an unparseable fechaHistorica", () => {
    const err = validateSimulationRequest(buildRequest({ fechaHistorica: "not-a-date" }));
    expect(err?.field).toBe("fechaHistorica");
    expect(err?.error_code).toBe("INVALID_SIMULATION_REQUEST");
  });

  it("rejects a future fechaHistorica", () => {
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const err = validateSimulationRequest(buildRequest({ fechaHistorica: future }));
    expect(err?.error_code).toBe("INVALID_RANGE");
    expect(err?.field).toBe("fechaHistorica");
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

  it("includes real A_ESTRATEGIA row when A_ESTRATEGIA core is enabled", async () => {
    const result = await runSimulation(buildRequest({ coresHabilitados: ["A_ESTRATEGIA"] }));
    const estrategiaRow = result.table.find((r) => r.core === "A_ESTRATEGIA");
    expect(estrategiaRow).toBeDefined();
    expect(estrategiaRow?.estado).toBe("ACTIVA");
    expect(estrategiaRow?.fuente).toBe("strategy-viability-engine");
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

  it("returns signalMetrics consistent with the table (US5)", async () => {
    const result = await runSimulation(buildRequest());
    const { buy, sell, hold, total } = result.signalMetrics;
    expect(total).toBe(result.table.length);
    expect(buy + sell + hold).toBe(total);
    expect(buy).toBe(result.table.filter((r) => r.tipoSenal === "CALL").length);
    expect(sell).toBe(result.table.filter((r) => r.tipoSenal === "PUT").length);
  });

  it("A_INDICADORES enabled with NO individual indicators emits zero indicator rows", async () => {
    const result = await runSimulation(
      buildRequest({ coresHabilitados: ["A_INDICADORES"], indicadoresHabilitados: [] })
    );
    expect(result.table.filter((r) => r.core === "A_INDICADORES").length).toBe(0);
  });

  it("multicore: with no indicators selected, other enabled cores still emit rows", async () => {
    const result = await runSimulation(
      buildRequest({ coresHabilitados: ["A_INDICADORES", "A_IA"], indicadoresHabilitados: [] })
    );
    expect(result.table.filter((r) => r.core === "A_INDICADORES").length).toBe(0);
    expect(result.table.some((r) => r.core === "A_IA")).toBe(true);
  });

  it("stamps rows with the historical data date, not today (US8 fecha bugfix)", async () => {
    const asOf = "2025-09-15";
    const asOfSec = Math.floor(Date.parse(`${asOf}T00:00:00Z`) / 1000);
    const fakeCandles = Array.from({ length: 60 }).map((_, i) => ({
      time: asOfSec - (59 - i) * 86_400,
      open: 100, high: 101, low: 99, close: 100 + (i % 3), volume: 1000,
    }));
    const result = await runSimulation(
      buildRequest({
        coresHabilitados: ["A_INDICADORES"],
        indicadoresHabilitados: ["RSI", "MACD"],
        fechaHistorica: asOf,
      }),
      { fetchCandles: () => fakeCandles }
    );
    expect(result.table.length).toBeGreaterThan(0);
    const today = new Date().toISOString().slice(0, 10);
    for (const row of result.table) {
      expect(row.fecha).toBe(asOf);
      expect(row.fecha).not.toBe(today);
    }
  });

  it("with a single indicator returns all its rows (no coincidence filter) (US7)", async () => {
    const result = await runSimulation(
      buildRequest({ coresHabilitados: ["A_INDICADORES"], indicadoresHabilitados: ["RSI"] })
    );
    // Aggregate row + 1 subCore row, none dropped because there is nothing to compare against.
    const subCoreRows = result.table.filter((r) => r.core === "A_INDICADORES" && r.subCore);
    expect(subCoreRows.length).toBe(1);
  });

  it("coincidence filter (default) keeps <= rows than disabling it (US7)", async () => {
    const base = buildRequest({ coresHabilitados: ["A_INDICADORES"] });
    const filtered = await runSimulation({ ...base, soloCoincidencias: true });
    const unfiltered = await runSimulation({ ...base, soloCoincidencias: false });
    const fSub = filtered.table.filter((r) => r.core === "A_INDICADORES" && r.subCore).length;
    const uSub = unfiltered.table.filter((r) => r.core === "A_INDICADORES" && r.subCore).length;
    expect(fSub).toBeLessThanOrEqual(uSub);
    // Every surviving indicator row shares its tipoSenal with at least one peer.
    const survivors = filtered.table.filter((r) => r.core === "A_INDICADORES" && r.subCore);
    for (const row of survivors) {
      const peers = survivors.filter((r) => r.tipoSenal === row.tipoSenal).length;
      expect(peers).toBeGreaterThanOrEqual(2);
    }
  });
});
