// FIC: Integration tests for GET /api/indicators/health Phase 6 (T136-T138) — 3 deps + indicators.
// FIC: Tests de integracion del health endpoint Phase 6 con dependencias paralelas.

import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { indicatorsHealthRouter } from "../../../src/routes/indicators/health";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/indicators", indicatorsHealthRouter);
  return app;
}

describe("GET /api/indicators/health", () => {
  it("reports the status of the 3 dependencies and every indicator", async () => {
    const res = await request(buildApp()).get("/api/indicators/health");
    expect(res.status).toBe(200);
    expect(["up", "degraded", "down"]).toContain(res.body.status);
    expect(res.body.indicators).toMatchObject({
      rsi: "ok",
      macd: "ok",
      ema: "ok",
      adx: "ok",
      bollinger: "ok"
    });
    expect(Array.isArray(res.body.dependencies)).toBe(true);
    const names = res.body.dependencies.map((d: any) => d.name);
    expect(names).toContain("ohlc_source");
    expect(names).toContain("anthropic_llm");
    expect(names).toContain("supabase");
    for (const dep of res.body.dependencies) {
      expect(["up", "degraded", "down"]).toContain(dep.status);
      expect(typeof dep.latency_ms).toBe("number");
    }
    expect(typeof res.body.timestamp).toBe("string");
  });

  it("returns 200 when at least one dependency is up (OHLC source is up)", async () => {
    const res = await request(buildApp()).get("/api/indicators/health");
    expect(res.status).toBe(200);
    const ohlc = res.body.dependencies.find((d: any) => d.name === "ohlc_source");
    expect(ohlc.status).toBe("up");
  });
});
