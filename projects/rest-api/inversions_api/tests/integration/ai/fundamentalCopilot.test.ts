import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createFundamentalCopilotRouter } from "../../../src/routes/ai/fundamentalCopilot";
import type { SupabaseClient } from "@supabase/supabase-js";

const fakeSupabaseClient = {
  from: (_table: string) => ({
    insert: async (_payload: unknown) => ({ data: null, error: null })
  })
} as unknown as SupabaseClient;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/team-03/ai", createFundamentalCopilotRouter(fakeSupabaseClient));
  return app;
}

describe("TEAM-03 fundamental copilot route", () => {
  it("returns a copilot-style answer for a fundamental question", async () => {
    const app = buildApp();

    const res = await request(app)
      .post("/api/team-03/ai/fundamental/copilot")
      .send({
        ticker: "AAPL",
        question: "¿Qué tan sólida es la rentabilidad?",
        includeStrategyRecommendation: true
      })
      .expect(200);

    expect(res.body).toMatchObject({
      answer: expect.any(String),
      sourceContext: expect.any(Array),
      disclaimer: expect.any(String)
    });
  });
});
