// FIC: Integration tests for GET /api/indicators/adx (Edgar, TEAM-02).
// FIC: Tests de integracion para GET /api/indicators/adx (Edgar, TEAM-02).

import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { adxRouter } from "../../../src/routes/indicators/adx";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/indicators", adxRouter);
  return app;
}

describe("GET /api/indicators/adx", () => {
  it("returns 400 when symbol is missing", async () => {
    const res = await request(buildApp()).get("/api/indicators/adx");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("missing_symbol");
  });

  it("returns 400 when timeframe is unsupported", async () => {
    const res = await request(buildApp()).get("/api/indicators/adx?symbol=AAPL&timeframe=zz");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("invalid_timeframe");
  });

  it("returns 422 when count is below 2*period", async () => {
    const res = await request(buildApp()).get("/api/indicators/adx?symbol=AAPL&period=14&count=20");
    expect(res.status).toBe(422);
    expect(res.body.error_code).toBe("insufficient_data");
  });

  it("returns 200 with adx, +DI, -DI and strength on default params", async () => {
    const res = await request(buildApp()).get("/api/indicators/adx?symbol=AAPL");
    expect(res.status).toBe(200);
    expect(res.body.indicator).toBe("adx");
    expect(res.body.params).toEqual({ period: 14 });
    expect(res.body.current_value).toHaveProperty("adx");
    expect(res.body.current_value).toHaveProperty("plus_di");
    expect(res.body.current_value).toHaveProperty("minus_di");
    expect(["sin_tendencia", "debil", "fuerte", "muy_fuerte"]).toContain(
      res.body.current_value.strength
    );
    expect(Array.isArray(res.body.series)).toBe(true);
  });
});
