// FIC: Integration tests for GET /api/indicators/macd (Kevin, TEAM-02).
// FIC: Tests de integracion para GET /api/indicators/macd (Kevin, TEAM-02).

import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { macdRouter } from "../../../src/routes/indicators/macd";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/indicators", macdRouter);
  return app;
}

describe("GET /api/indicators/macd", () => {
  it("returns 400 when symbol is missing", async () => {
    const res = await request(buildApp()).get("/api/indicators/macd");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("missing_symbol");
  });

  it("returns 400 when fast >= slow", async () => {
    const res = await request(buildApp()).get("/api/indicators/macd?symbol=AAPL&fast=26&slow=12");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("invalid_params");
  });

  it("returns 400 when timeframe is invalid", async () => {
    const res = await request(buildApp()).get("/api/indicators/macd?symbol=AAPL&timeframe=zzz");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("invalid_timeframe");
  });

  it("returns 422 when count is too small", async () => {
    const res = await request(buildApp()).get(
      "/api/indicators/macd?symbol=AAPL&fast=12&slow=26&signal=9&count=20"
    );
    expect(res.status).toBe(422);
    expect(res.body.error_code).toBe("insufficient_data");
  });

  it("returns 200 with valid structure on default params", async () => {
    const res = await request(buildApp()).get("/api/indicators/macd?symbol=AAPL");
    expect(res.status).toBe(200);
    expect(res.body.indicator).toBe("macd");
    expect(res.body.symbol).toBe("AAPL");
    expect(res.body.params).toEqual({ fast: 12, slow: 26, signal: 9 });
    expect(res.body.current_value).toBeDefined();
    expect(["bullish", "bearish", "none"]).toContain(res.body.current_value.cross);
    expect(Array.isArray(res.body.series)).toBe(true);
    expect(res.body.series[0]).toHaveProperty("macd");
    expect(res.body.series[0]).toHaveProperty("signal");
    expect(res.body.series[0]).toHaveProperty("histogram");
  });
});
