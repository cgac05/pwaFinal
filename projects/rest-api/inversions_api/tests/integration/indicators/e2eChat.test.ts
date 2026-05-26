// FIC: End-to-end test — OHLC -> 5 indicators -> confluence -> chat (Hansel, TEAM-02).
// FIC: Test end-to-end — OHLC -> 5 indicadores -> confluencia -> chat (Hansel, TEAM-02).

import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { rsiRouter } from "../../../src/routes/indicators/rsi";
import { macdRouter } from "../../../src/routes/indicators/macd";
import { emaRouter } from "../../../src/routes/indicators/ema";
import { adxRouter } from "../../../src/routes/indicators/adx";
import { bollingerRouter } from "../../../src/routes/indicators/bollinger";
import { indicatorsConfluenceRouter } from "../../../src/routes/indicators/confluence";
import { indicatorsHealthRouter } from "../../../src/routes/indicators/health";
import { chatExplainRouter } from "../../../src/routes/indicators/chatExplain";
import { CHAT_DISCLAIMER } from "../../../src/modules/indicators/chatExplainer";

// FIC: Mirrors the indicators-core wiring of src/index.ts for a full-stack walk.
// FIC: Replica el cableado del core de indicadores de src/index.ts para un recorrido completo.
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/indicators", rsiRouter);
  app.use("/api/indicators", macdRouter);
  app.use("/api/indicators", emaRouter);
  app.use("/api/indicators", adxRouter);
  app.use("/api/indicators", bollingerRouter);
  app.use("/api/indicators", indicatorsConfluenceRouter);
  app.use("/api/indicators", indicatorsHealthRouter);
  app.use("/api/chat", chatExplainRouter);
  return app;
}

describe("E2E: OHLC -> indicators -> confluence -> chat", () => {
  it("walks the full TEAM-02 indicators-core pipeline", async () => {
    const app = buildApp();
    const symbol = "AAPL";
    const qs = `symbol=${symbol}&timeframe=1h`;

    // FIC: 1) the core is healthy. / FIC: 1) el core esta saludable.
    const health = await request(app).get("/api/indicators/health");
    expect(health.status).toBe(200);
    // FIC: Phase 6 (T136-T138) — el endpoint ahora reporta status agregado de 3 dependencias;
    // FIC: en CI sin Anthropic/Supabase, el status es "degraded" pero 200 sigue siendo correcto.
    expect(["up", "degraded"]).toContain(health.body.status);

    // FIC: 2) every individual indicator answers. / FIC: 2) cada indicador responde.
    for (const indicator of ["rsi", "macd", "ema", "adx", "bollinger"]) {
      const res = await request(app).get(`/api/indicators/${indicator}?${qs}`);
      expect(res.status).toBe(200);
      expect(res.body.indicator).toBe(indicator);
      expect(res.body.bars_used).toBe(300);
    }

    // FIC: 3) confluence consolidates the 5 without degradation. / FIC: 3) la confluencia consolida los 5.
    const confluence = await request(app).get(`/api/indicators/confluence?${qs}`);
    expect(confluence.status).toBe(200);
    expect(confluence.body.components).toHaveLength(5);
    expect(confluence.body.degraded).toBe(false);
    expect(["alcista", "neutral", "bajista"]).toContain(confluence.body.verdict);

    // FIC: 4) the Chat IA explains the signal citing real indicators. / FIC: 4) el Chat IA explica.
    const chat = await request(app)
      .post("/api/chat/explain")
      .send({ symbol, timeframe: "1h", question: "por que la señal tecnica esta asi?" });
    expect(chat.status).toBe(200);
    expect(chat.body.refused).toBe(false);
    expect(chat.body.disclaimer).toBe(CHAT_DISCLAIMER);
    expect(String(chat.body.explanation_text).toLowerCase()).toContain(CHAT_DISCLAIMER);
    expect(chat.body.indicators_cited.length).toBeGreaterThanOrEqual(3);
  });

  it("refuses an order-execution request at the end of the pipeline", async () => {
    const chat = await request(buildApp())
      .post("/api/chat/explain")
      .send({ symbol: "AAPL", timeframe: "1h", question: "ejecuta una orden de compra" });
    expect(chat.status).toBe(200);
    expect(chat.body.refused).toBe(true);
    expect(chat.body.disclaimer).toBe(CHAT_DISCLAIMER);
  });
});
