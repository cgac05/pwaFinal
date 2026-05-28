/**
 * FIC: English/Español
 * Integration tests for complex option strategy route endpoints.
 * Pruebas de integración para los endpoints de rutas de estrategias de opciones complejas.
 */

import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { ironCondorRouter } from "../../../../src/routes/strategies/complex/ironCondor";
import { ironButterflyRouter } from "../../../../src/routes/strategies/complex/ironButterfly";
import { butterflySpreadRouter } from "../../../../src/routes/strategies/complex/butterflySpread";
import { condorRouter } from "../../../../src/routes/strategies/complex/condor";
import { complexComparatorRouter } from "../../../../src/routes/strategies/complex/complexComparator";

describe("Complex Options Strategy Route Endpoints", () => {
  afterEach(() => {
    process.env.AUTH_BYPASS = "false";
  });

  const getApp = () => {
    const app = express();
    app.use(express.json());
    app.use("/api/strategies/complex", ironCondorRouter);
    app.use("/api/strategies/complex", ironButterflyRouter);
    app.use("/api/strategies/complex", butterflySpreadRouter);
    app.use("/api/strategies/complex", condorRouter);
    app.use("/api/strategies/complex", complexComparatorRouter);
    return app;
  };

  it("should successfully execute Iron Condor simulation endpoint", async () => {
    process.env.AUTH_BYPASS = "true";
    const app = getApp();

    const payload = {
      ticker: "COCA",
      underlyingPrice: 100,
      legs: [
        { id: "ic-lp", type: "put", action: "buy", strike: 90, premium: 0.5, contracts: 1, expiration: "2026-06-20" },
        { id: "ic-sp", type: "put", action: "sell", strike: 95, premium: 1.5, contracts: 1, expiration: "2026-06-20" },
        { id: "ic-sc", type: "call", action: "sell", strike: 105, premium: 1.4, contracts: 1, expiration: "2026-06-20" },
        { id: "ic-lc", type: "call", action: "buy", strike: 110, premium: 0.4, contracts: 1, expiration: "2026-06-20" }
      ]
    };

    const res = await request(app)
      .post("/api/strategies/complex/iron-condor")
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.profile.name).toBe("Iron Condor");
    expect(res.body.profile.maxProfit).toBe(200);
    expect(res.body.risk.riskScore).toBeDefined();
    expect(res.body.simulation.probabilityOfProfit).toBeDefined();
    expect(res.body.report.asciiChart).toBeDefined();
  });

  it("should fail Iron Condor simulation endpoint on invalid input structure", async () => {
    process.env.AUTH_BYPASS = "true";
    const app = getApp();

    const payload = {
      ticker: "",
      underlyingPrice: 100,
      legs: []
    };

    const res = await request(app)
      .post("/api/strategies/complex/iron-condor")
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("El símbolo ticker es obligatorio");
  });

  it("should successfully execute Strategy Comparator endpoint and return AI recommendation", async () => {
    process.env.AUTH_BYPASS = "true";
    const app = getApp();

    const payload = {
      ticker: "COCA",
      underlyingPrice: 100,
      volatility: 0.35,
      daysToExpiration: 45,
      riskTolerance: "moderate"
    };

    const res = await request(app)
      .post("/api/strategies/complex/compare")
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.ticker).toBe("COCA");
    expect(res.body.spot).toBe(100);
    expect(res.body.volatility).toBe(0.35);
    expect(res.body.daysToExpiration).toBe(45);
    expect(res.body.comparison).toBeInstanceOf(Array);
    expect(res.body.comparison.length).toBeGreaterThan(0);
    expect(res.body.aiRecommendation.recommendedStrategy).toBeDefined();
    expect(res.body.aiRecommendation.explanationEn).toBeDefined();
    expect(res.body.aiRecommendation.explanationEs).toBeDefined();
  });
});
