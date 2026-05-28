// FIC: Integration tests for GET /api/indicators/confluence (Mauricio, TEAM-02).
// FIC: Tests de integracion para GET /api/indicators/confluence (Mauricio, TEAM-02).

import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { indicatorsConfluenceRouter } from "../../../src/routes/indicators/confluence";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/indicators", indicatorsConfluenceRouter);
  return app;
}

describe("GET /api/indicators/confluence", () => {
  it("returns 400 when symbol is missing", async () => {
    const res = await request(buildApp()).get("/api/indicators/confluence");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("missing_symbol");
  });

  it("returns 400 when timeframe is unsupported", async () => {
    const res = await request(buildApp()).get("/api/indicators/confluence?symbol=AAPL&timeframe=9z");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("invalid_timeframe");
  });

  it("returns 200 with a consolidated verdict on default params", async () => {
    const res = await request(buildApp()).get("/api/indicators/confluence?symbol=AAPL");
    expect(res.status).toBe(200);
    expect(["alcista", "neutral", "bajista"]).toContain(res.body.verdict);
    expect(typeof res.body.score).toBe("number");
    expect(res.body.score).toBeGreaterThanOrEqual(-1);
    expect(res.body.score).toBeLessThanOrEqual(1);
    expect(res.body.components).toHaveLength(5);
    expect(res.body.degraded).toBe(false);
    expect(res.body.bars_used).toBe(300);
    expect(res.body.source_input_hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it("is idempotent: identical request -> identical score and verdict", async () => {
    // FIC: OHLC values depend only on bar index, so score/verdict are fully reproducible.
    // FIC: Los valores OHLC dependen solo del indice de vela, asi score/verdict son reproducibles.
    const app = buildApp();
    const a = await request(app).get("/api/indicators/confluence?symbol=AAPL&timeframe=1h");
    const b = await request(app).get("/api/indicators/confluence?symbol=AAPL&timeframe=1h");
    expect(a.body.score).toBe(b.body.score);
    expect(a.body.verdict).toBe(b.body.verdict);
    expect(a.body.components).toEqual(b.body.components);
  });
});
