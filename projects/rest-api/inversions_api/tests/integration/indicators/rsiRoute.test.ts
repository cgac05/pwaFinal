// FIC: Integration tests for GET /api/indicators/rsi (Kevin, TEAM-02).
// FIC: Tests de integracion para GET /api/indicators/rsi (Kevin, TEAM-02).

import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { rsiRouter } from "../../../src/routes/indicators/rsi";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/indicators", rsiRouter);
  return app;
}

describe("GET /api/indicators/rsi", () => {
  it("returns 400 when symbol is missing", async () => {
    const res = await request(buildApp()).get("/api/indicators/rsi");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("missing_symbol");
  });

  it("returns 400 when timeframe is unsupported", async () => {
    const res = await request(buildApp()).get("/api/indicators/rsi?symbol=AAPL&timeframe=99x");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("invalid_timeframe");
  });

  it("returns 400 when period is invalid", async () => {
    const res = await request(buildApp()).get("/api/indicators/rsi?symbol=AAPL&period=0");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("invalid_period");
  });

  it("returns 422 when count is below period requirement", async () => {
    const res = await request(buildApp()).get("/api/indicators/rsi?symbol=AAPL&period=14&count=10");
    expect(res.status).toBe(422);
    expect(res.body.error_code).toBe("insufficient_data");
  });

  it("returns 200 with valid structure on default params", async () => {
    const res = await request(buildApp()).get("/api/indicators/rsi?symbol=AAPL");
    expect(res.status).toBe(200);
    expect(res.body.indicator).toBe("rsi");
    expect(res.body.symbol).toBe("AAPL");
    expect(res.body.timeframe).toBe("1h");
    expect(res.body.params).toEqual({ period: 14 });
    expect(typeof res.body.current_value).toBe("number");
    expect(res.body.current_value).toBeGreaterThanOrEqual(0);
    expect(res.body.current_value).toBeLessThanOrEqual(100);
    expect(["oversold", "neutral", "overbought"]).toContain(res.body.zone);
    expect(Array.isArray(res.body.series)).toBe(true);
    expect(res.body.source_input_hash).toMatch(/^[a-f0-9]{16}$/);
  });
});
