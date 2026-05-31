import { Router } from "express";
import { analyzeSentiment } from "../../modules/news/sentimentService";
import { fetchNewsData } from "../../modules/news/newsDataService";
import { evaluateNewsImpact } from "../../modules/news/newsImpactEngine";
import { buildInvestmentAdvice } from "../../modules/news/investmentAdvisor";
import { analyzeNewsSource, analyzeNewsSources } from "../../modules/news/urlAnalysisService";
import type { NewsSourceInput } from "../../modules/news/types";

export const newsRouter = Router();

function toLimit(value: unknown, fallback = 8): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

function toDate(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, 10) : undefined;
}

function toSymbol(value: unknown): string {
  return String(value ?? "SPY").trim().toUpperCase() || "SPY";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected news module error";
}

newsRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", module: "TNMT_NEWS", generatedAt: new Date().toISOString() });
});

newsRouter.get("/sentiment", (req, res) => {
  const text = String(req.query.text ?? "");
  res.status(200).json(analyzeSentiment(text));
});

newsRouter.post("/sentiment", (req, res) => {
  const text = String(req.body?.text ?? "");
  res.status(200).json(analyzeSentiment(text));
});

newsRouter.post("/analyze-source", async (req, res) => {
  try {
    const symbol = req.body?.symbol ? toSymbol(req.body.symbol) : undefined;
    const source = (req.body?.source ?? req.body) as NewsSourceInput;
    const result = await analyzeNewsSource(source, symbol);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ code: "NEWS_ANALYZE_SOURCE_FAILED", message: getErrorMessage(error) });
  }
});

newsRouter.post("/analyze-url", async (req, res) => {
  try {
    const symbol = req.body?.symbol ? toSymbol(req.body.symbol) : undefined;
    const result = await analyzeNewsSource({ url: String(req.body?.url ?? ""), title: req.body?.title }, symbol);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ code: "NEWS_ANALYZE_URL_FAILED", message: getErrorMessage(error) });
  }
});

newsRouter.post("/analyze-sources", async (req, res) => {
  try {
    const symbol = toSymbol(req.body?.symbol);
    const sources = Array.isArray(req.body?.sources) ? (req.body.sources as NewsSourceInput[]) : [];
    if (sources.length === 0) {
      res.status(400).json({ code: "NEWS_SOURCES_REQUIRED", message: "Envía al menos una fuente en sources[]." });
      return;
    }
    const result = await analyzeNewsSources(sources, symbol);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ code: "NEWS_ANALYZE_SOURCES_FAILED", message: getErrorMessage(error) });
  }
});

newsRouter.get("/data", async (req, res) => {
  try {
    const symbol = toSymbol(req.query.symbol);
    const limit = toLimit(req.query.limit);
    const result = await fetchNewsData({
      symbol,
      limit,
      from: toDate(req.query.from),
      to: toDate(req.query.to),
      includeFallback: false
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ code: "NEWS_DATA_FAILED", message: getErrorMessage(error) });
  }
});

newsRouter.get("/confluence", async (req, res) => {
  try {
    const symbol = toSymbol(req.query.symbol);
    const limit = toLimit(req.query.limit, 8);
    const result = await evaluateNewsImpact({
      symbol,
      limit,
      from: toDate(req.query.from),
      to: toDate(req.query.to),
      includeFallback: false
    });
    res.status(200).json({
      ...result,
      from: "TNMT_NEWS_CONFLUENCE",
      recommendation: buildInvestmentAdvice(result)
    });
  } catch (error) {
    res.status(500).json({ code: "NEWS_CONFLUENCE_FAILED", message: getErrorMessage(error) });
  }
});

newsRouter.post("/advisor", async (req, res) => {
  try {
    const symbol = toSymbol(req.body?.symbol);
    const sources = Array.isArray(req.body?.sources) ? (req.body.sources as NewsSourceInput[]) : [];
    if (sources.length > 0) {
      const analyzed = await analyzeNewsSources(sources, symbol);
      res.status(200).json({ analysis: analyzed, recommendation: buildInvestmentAdvice(analyzed) });
      return;
    }

    const impact = await evaluateNewsImpact({ symbol, limit: toLimit(req.body?.limit, 8), includeFallback: false });
    res.status(200).json({ analysis: impact, recommendation: buildInvestmentAdvice(impact) });
  } catch (error) {
    res.status(500).json({ code: "NEWS_ADVISOR_FAILED", message: getErrorMessage(error) });
  }
});
