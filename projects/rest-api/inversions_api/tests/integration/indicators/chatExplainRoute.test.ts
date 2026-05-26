// FIC: Integration tests for POST /api/chat/explain (Hansel, TEAM-02).
// FIC: Tests de integracion para POST /api/chat/explain (Hansel, TEAM-02).

import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { chatExplainRouter } from "../../../src/routes/indicators/chatExplain";
import { CHAT_DISCLAIMER } from "../../../src/modules/indicators/chatExplainer";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/chat", chatExplainRouter);
  return app;
}

describe("POST /api/chat/explain", () => {
  it("returns 400 when symbol is missing", async () => {
    const res = await request(buildApp()).post("/api/chat/explain").send({ question: "por que?" });
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("missing_symbol");
  });

  it("returns 400 when question is missing", async () => {
    const res = await request(buildApp()).post("/api/chat/explain").send({ symbol: "AAPL" });
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("missing_question");
  });

  it("always includes the constitutional disclaimer", async () => {
    const res = await request(buildApp())
      .post("/api/chat/explain")
      .send({ symbol: "AAPL", timeframe: "1h", question: "por que la señal esta alcista?" });
    expect(res.status).toBe(200);
    expect(res.body.disclaimer).toBe(CHAT_DISCLAIMER);
    expect(String(res.body.explanation_text).toLowerCase()).toContain(CHAT_DISCLAIMER);
  });

  it("refuses (200) when the question implies executing an order", async () => {
    const res = await request(buildApp())
      .post("/api/chat/explain")
      .send({ symbol: "AAPL", timeframe: "1h", question: "ejecuta una compra de AAPL ahora" });
    expect(res.status).toBe(200);
    expect(res.body.refused).toBe(true);
    expect(res.body.disclaimer).toBe(CHAT_DISCLAIMER);
    expect(res.body.indicators_cited).toEqual([]);
  });

  it("cites at least 3 of 5 indicators when confluence is available", async () => {
    const res = await request(buildApp())
      .post("/api/chat/explain")
      .send({ symbol: "AAPL", timeframe: "1h", question: "explica la señal tecnica" });
    expect(res.status).toBe(200);
    expect(res.body.indicators_cited.length).toBeGreaterThanOrEqual(3);
    expect(res.body.refused).toBe(false);
  });

  it("answers in Spanish even when the question is written in English", async () => {
    const res = await request(buildApp())
      .post("/api/chat/explain")
      .send({ symbol: "AAPL", timeframe: "1h", question: "why is the signal like this?" });
    expect(res.status).toBe(200);
    expect(String(res.body.explanation_text).toLowerCase()).toContain("analisis tecnico");
  });
});
