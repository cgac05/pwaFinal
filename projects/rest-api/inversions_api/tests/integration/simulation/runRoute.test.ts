// FIC: Integration tests T092 — POST /api/simulation/run (idempotencia, validacion, cores deshabilitados).

import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { simulationRunRouter } from "../../../src/routes/simulation/run";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/simulation", simulationRunRouter);
  return app;
}

function validBody(overrides: any = {}) {
  return {
    ticket: "AAPL",
    rangoHistorico: "3M",
    rangoEstrategia: { from: "2026-01-01", to: "2026-02-01" },
    temporalidad: "1h",
    runtimeMode: "OFFLINE",
    coresHabilitados: ["A_INDICADORES", "A_IA"],
    indicadoresHabilitados: ["RSI", "MACD"],
    estrategia: "IRON_CONDOR",
    toleranciaRiesgo: "MEDIO",
    ...overrides
  };
}

describe("POST /api/simulation/run", () => {
  it("returns 400 on invalid request", async () => {
    const res = await request(buildApp()).post("/api/simulation/run").send({});
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("INVALID_SIMULATION_REQUEST");
  });

  it("returns 200 with verdict + table + inputs_echo", async () => {
    const res = await request(buildApp()).post("/api/simulation/run").send(validBody());
    expect(res.status).toBe(200);
    expect(res.body.verdict).toBeDefined();
    expect(Array.isArray(res.body.table)).toBe(true);
    expect(res.body.inputs_echo.estrategia).toBe("IRON_CONDOR");
  });

  it("is idempotent: same body -> same source_input_hash", async () => {
    const a = await request(buildApp()).post("/api/simulation/run").send(validBody());
    const b = await request(buildApp()).post("/api/simulation/run").send(validBody());
    expect(a.body.verdict.source_input_hash).toBe(b.body.verdict.source_input_hash);
  });

  it("restricts rows to enabled cores", async () => {
    const res = await request(buildApp())
      .post("/api/simulation/run")
      .send(validBody({ coresHabilitados: ["A_INDICADORES"] }));
    const cores = new Set(res.body.table.map((r: any) => r.core));
    expect([...cores]).toEqual(["A_INDICADORES"]);
  });
});
