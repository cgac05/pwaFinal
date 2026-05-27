// FIC: Integration tests for GET /api/indicators/bollinger (Edgar, TEAM-02).
// FIC: Tests de integracion para GET /api/indicators/bollinger (Edgar, TEAM-02).

import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { bollingerRouter } from "../../../src/routes/indicators/bollinger";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/indicators", bollingerRouter);
  return app;
}

describe("GET /api/indicators/bollinger", () => {
  it("returns 400 when symbol is missing", async () => {
    const res = await request(buildApp()).get("/api/indicators/bollinger");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("missing_symbol");
  });

  it("returns 400 when stdDev is invalid", async () => {
    const res = await request(buildApp()).get("/api/indicators/bollinger?symbol=AAPL&stdDev=0");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("invalid_params");
  });

  it("returns 422 when count is below the period requirement", async () => {
    const res = await request(buildApp()).get("/api/indicators/bollinger?symbol=AAPL&period=20&count=10");
    expect(res.status).toBe(422);
    expect(res.body.error_code).toBe("insufficient_data");
  });

  it("returns 200 with bands, bandwidth and zone on default params", async () => {
    const res = await request(buildApp()).get("/api/indicators/bollinger?symbol=AAPL");
    expect(res.status).toBe(200);
    expect(res.body.indicator).toBe("bollinger");
    expect(res.body.params).toEqual({ period: 20, stdDev: 2 });
    expect(res.body.current_value).toHaveProperty("upper");
    expect(res.body.current_value).toHaveProperty("middle");
    expect(res.body.current_value).toHaveProperty("lower");
    expect(res.body.current_value).toHaveProperty("bandwidth");
    expect(res.body.current_value).toHaveProperty("percent_b");
    expect(["above_upper", "below_lower", "within"]).toContain(res.body.zone);
  });
});
