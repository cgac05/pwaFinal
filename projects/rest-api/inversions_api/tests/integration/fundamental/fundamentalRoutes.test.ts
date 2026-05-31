import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createCompanyProfileRouter } from "../../../src/routes/fundamental/companyProfile";
import { createSp500ScreenerRouter } from "../../../src/routes/fundamental/sp500Screener";
import type { SupabaseClient } from "@supabase/supabase-js";

const fakeSupabaseClient = {
  from: (_table: string) => ({
    insert: async (_payload: unknown) => ({ data: null, error: null }),
    select: () => ({
      eq: (_key: string, _value: unknown) => ({
        single: async () => ({ data: null, error: null })
      })
    }),
    upsert: async (_payload: unknown) => ({ data: null, error: null })
  })
} as unknown as SupabaseClient;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/team-03/fundamental", createCompanyProfileRouter(fakeSupabaseClient));
  app.use("/api/team-03/screener/sp500", createSp500ScreenerRouter(fakeSupabaseClient));
  return app;
}

describe("TEAM-03 fundamental routes", () => {
  it("returns company profile with viability and ETag for a valid ticker", async () => {
    const app = buildApp();

    const res = await request(app).get("/api/team-03/fundamental/AAPL").expect(200);

    expect(res.headers).toHaveProperty("etag");
    expect(res.body).toMatchObject({
      ticker: "AAPL",
      company_name: expect.any(String),
      viability: {
        score: expect.any(Number),
        classification: expect.any(String),
        confidence: expect.any(String)
      }
    });
  });

  it("returns top N screener candidates for the S&P500 route", async () => {
    const app = buildApp();

    const res = await request(app)
      .get("/api/team-03/screener/sp500")
      .query({ topN: 5, minViability: 0.5, sortBy: "viability" })
      .expect(200);

    expect(res.body).toMatchObject({
      query: {
        top_n: 5,
        min_viability: 0.5,
        sort_by: "viability"
      }
    });
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results).toHaveLength(5);
    expect(res.body.results[0]).toMatchObject({
      ticker: expect.any(String),
      viability_score: expect.any(Number),
      profile_url: expect.any(String)
    });
  });
});
