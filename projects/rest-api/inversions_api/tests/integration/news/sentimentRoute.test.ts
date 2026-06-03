// FIC: Integration tests for the news sentiment endpoints (Feature 006).
// FIC: Tests de integracion para los endpoints de sentimiento de noticias (Feature 006).

import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createNewsSentimentRouter } from "../../../src/routes/news/sentiment";
import { InvestmentAdvisor } from "../../../src/modules/news/investmentAdvisor";
import { URLAnalysisService } from "../../../src/modules/news/urlAnalysisService";
import { NewsAdapter } from "../../../src/modules/news/newsAdapter";
import { NEWS_DISCLAIMER } from "../../../src/modules/news/types";

function buildApp() {
  const app = express();
  app.use(express.json());
  const advisor = new InvestmentAdvisor({ adapter: new NewsAdapter({}) });
  app.use("/api/news", createNewsSentimentRouter(advisor));
  return app;
}

describe("GET /api/news/sentiment/:symbol", () => {
  it("returns 400 for an invalid symbol", async () => {
    const res = await request(buildApp()).get("/api/news/sentiment/this-is-way-too-long");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("invalid_symbol");
  });

  it("returns a 200 verdict with sentiment and disclaimer", async () => {
    const res = await request(buildApp()).get("/api/news/sentiment/AAPL");
    expect(res.status).toBe(200);
    expect(res.body.symbol).toBe("AAPL");
    expect(["BUY", "SELL", "HOLD"]).toContain(res.body.verdict);
    expect(res.body.sentiment).toBeDefined();
    expect(res.body.disclaimer).toBe(NEWS_DISCLAIMER);
    expect(res.body.ia_revisada).toBe(true);
  });
});

describe("POST /api/news/analyze-url", () => {
  it("returns 400 when url is not http(s)", async () => {
    const res = await request(buildApp()).post("/api/news/analyze-url").send({ url: "ftp://x", company: "AAPL" });
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("invalid_url");
  });

  it("returns 400 when company is missing", async () => {
    const res = await request(buildApp())
      .post("/api/news/analyze-url")
      .send({ url: "https://example.com/aapl" });
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("missing_company");
  });

  it("analyzes a URL when fetch succeeds", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "<title>AAPL fuerte crecimiento</title><p>rally y record de ingresos</p>"
    } as Response);
    const app = express();
    app.use(express.json());
    const advisor = new InvestmentAdvisor({ adapter: new NewsAdapter({}) });
    const urlService = new URLAnalysisService({ fetchImpl: fakeFetch as unknown as typeof fetch });
    app.use("/api/news", createNewsSentimentRouter(advisor, urlService));

    const res = await request(app).post("/api/news/analyze-url").send({
      url: "https://example.com/aapl",
      company: "AAPL"
    });
    expect(res.status).toBe(200);
    expect(res.body.company).toBe("AAPL");
    expect(res.body.disclaimer).toBe(NEWS_DISCLAIMER);
  });
});
