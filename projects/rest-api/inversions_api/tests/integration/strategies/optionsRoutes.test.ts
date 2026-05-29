import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createOptionsRouter } from "../../../src/routes/strategies/optionsRouter";
import type { SupabaseClient } from "@supabase/supabase-js";

const fakeSupabaseClient = {
  from: (_table: string) => ({
    insert: async (_payload: unknown) => ({ data: null, error: null })
  })
} as unknown as SupabaseClient;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/team-03/options", createOptionsRouter(fakeSupabaseClient));
  return app;
}

describe("TEAM-03 options strategy routes", () => {
  it("calculates a long call strategy", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/team-03/options/calculate")
      .send({
        ticker: "AAPL",
        optionType: "call",
        direction: "long",
        strikePrice: 150,
        expirationDate: "2026-12-31",
        premium: 3,
        quantity: 1,
        capitalAvailable: 10000,
        riskTolerance: "medium"
      })
      .expect(200);

    expect(res.body.strategy).toMatchObject({
      ticker: "AAPL",
      optionType: "call",
      direction: "long",
      breakEven: 153
    });
  });

  it("returns a recommendation ranking for options candidates", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/team-03/options/recommend")
      .send({
        ticker: "AAPL",
        optionType: "call",
        direction: "long",
        strikePrice: 150,
        expirationDate: "2026-12-31",
        premium: 3,
        quantity: 1,
        capitalAvailable: 10000,
        riskTolerance: "medium"
      })
      .expect(200);

    expect(res.body.ranking).toBeInstanceOf(Array);
    expect(res.body.ranking[0]).toHaveProperty("score");
  });

  it("simulates an options strategy path", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/team-03/options/simulate")
      .send({
        contract: {
          ticker: "AAPL",
          optionType: "call",
          direction: "long",
          strikePrice: 150,
          expirationDate: "2026-12-31",
          premium: 3,
          quantity: 1,
          capitalAvailable: 10000,
          riskTolerance: "medium"
        },
        pricePath: [150, 155, 160, 145]
      })
      .expect(200);

    expect(res.body.simulation).toMatchObject({
      ticker: "AAPL",
      strategyType: "long_call",
      pnlPath: expect.any(Array)
    });
  });
});
