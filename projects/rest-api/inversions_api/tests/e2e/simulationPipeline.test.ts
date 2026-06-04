// FIC: e2e T106 — POST /simulation/run -> tabla -> filas IA con disclaimer -> verdict coherente.

import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { simulationRunRouter } from "../../src/routes/simulation/run";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/simulation", simulationRunRouter);
  return app;
}

describe("e2e simulation pipeline (T106)", () => {
  it("returns table with A_IA row tagged ia_revisada=true + disclaimer_id, and derived verdict", async () => {
    const body = {
      ticket: "AAPL",
      rangoHistorico: "3M",
      rangoEstrategia: { from: "2026-01-01", to: "2026-02-01" },
      temporalidad: "1h",
      runtimeMode: "OFFLINE",
      coresHabilitados: ["A_INDICADORES", "A_IA"],
      indicadoresHabilitados: ["RSI", "MACD", "EMA", "ADX", "BB"],
      estrategia: "IRON_CONDOR",
      toleranciaRiesgo: "MEDIO"
    };
    const res = await request(buildApp()).post("/api/simulation/run").send(body);
    expect(res.status).toBe(200);
    expect(res.body.verdict).toBeDefined();
    expect(["alcista", "neutral", "bajista"]).toContain(res.body.verdict.verdict);
    const ia = res.body.table.find((r: any) => r.core === "A_IA");
    expect(ia).toBeDefined();
    expect(ia.ia_revisada).toBe(true);
    expect(ia.disclaimer_id).toBeDefined();
  });

  it("400 on out-of-range estrategia rango", async () => {
    const res = await request(buildApp()).post("/api/simulation/run").send({
      ticket: "AAPL",
      rangoHistorico: "3M",
      rangoEstrategia: { from: "2026-03-01", to: "2026-01-01" },
      temporalidad: "1h",
      runtimeMode: "OFFLINE",
      coresHabilitados: ["A_INDICADORES"],
      indicadoresHabilitados: ["RSI"],
      estrategia: "IRON_CONDOR",
      toleranciaRiesgo: "MEDIO"
    });
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("INVALID_RANGE");
  });
});
