// FIC: Integration tests for GET /api/indicators/ema (Edgar, TEAM-02).
// FIC: Tests de integracion para GET /api/indicators/ema (Edgar, TEAM-02).

import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { emaRouter } from "../../../src/routes/indicators/ema";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/indicators", emaRouter);
  return app;
}

describe("GET /api/indicators/ema", () => {
  it("returns 400 when symbol is missing", async () => {
    const res = await request(buildApp()).get("/api/indicators/ema");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("missing_symbol");
  });

  it("returns 400 when timeframe is unsupported", async () => {
    const res = await request(buildApp()).get("/api/indicators/ema?symbol=AAPL&timeframe=2x");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("invalid_timeframe");
  });

  it("returns 400 when period is invalid", async () => {
    const res = await request(buildApp()).get("/api/indicators/ema?symbol=AAPL&period=0");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("invalid_period");
  });

  it("returns 422 when count is below the period requirement", async () => {
    const res = await request(buildApp()).get("/api/indicators/ema?symbol=AAPL&period=20&count=10");
    expect(res.status).toBe(422);
    expect(res.body.error_code).toBe("insufficient_data");
  });

  it("returns 200 with a valid structure on default params", async () => {
    const res = await request(buildApp()).get("/api/indicators/ema?symbol=AAPL");
    expect(res.status).toBe(200);
    expect(res.body.indicator).toBe("ema");
    expect(res.body.symbol).toBe("AAPL");
    expect(res.body.params).toEqual({ period: 20 });
    expect(typeof res.body.current_value).toBe("number");
    expect(["alcista", "bajista", "neutral"]).toContain(res.body.zone);
    expect(Array.isArray(res.body.series)).toBe(true);
    expect(res.body.source_input_hash).toMatch(/^[a-f0-9]{16}$/);
  });
});
