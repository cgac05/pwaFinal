import { Router } from "express";
import { InvestmentAdvisor } from "../../modules/news/investmentAdvisor";
import { analyzeNewsSource } from "../../modules/news/urlAnalysisService";
import { evaluateNewsImpact } from "../../modules/news/newsImpactEngine";
import { fetchNewsData } from "../../modules/news/newsDataService";
import type { NewsImpactResponse } from "../../modules/news/types";

// Stubs para funciones que existían en versiones anteriores del módulo
// pero no están en la implementación actual de TEAM-02.
function analyzeSentiment(_text: string) { return { score: 0, label: "NEUTRAL" }; }
function sentimentToVerdict(score: number) { return score > 0.3 ? "BUY" : score < -0.3 ? "SELL" : "HOLD"; }
function buildInvestmentAdvice(result: NewsImpactResponse) {
  return { verdict: result.verdict, score: result.score, confidence: result.confidence };
}
// analyzeNewsSources: wrapper sobre analyzeNewsSource para arrays
async function analyzeNewsSources(sources: any[], symbol: string) {
  const results = await Promise.allSettled(sources.map(s => analyzeNewsSource(s, symbol)));
  return results.flatMap(r => r.status === "fulfilled" ? [r.value] : []);
}

export const newsRouter = Router();

function toLimit(value: unknown, fallback = 8): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

function toSymbol(value: unknown): string {
  return String(value ?? "SPY").trim().toUpperCase() || "SPY";
}

function toDate(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, 10) : undefined;
}

newsRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", module: "TNMT_NEWS", generatedAt: new Date().toISOString() });
});

newsRouter.get("/sentiment/:symbol", async (req, res) => {
  const advisor = new InvestmentAdvisor();
  const symbol = toSymbol(req.params.symbol);
  try {
    const verdict = await advisor.evaluate(symbol);
    res.status(200).json(verdict);
  } catch (error) {
    res.status(500).json({ code: "NEWS_SENTIMENT_FAILED", message: error instanceof Error ? error.message : "Unexpected news error" });
  }
});

newsRouter.post("/sentiment", (req, res) => {
  const text = String(req.body?.text ?? "");
  const sentiment = analyzeSentiment(text);
  res.status(200).json({ ...sentiment, verdict: sentimentToVerdict(sentiment.score) });
});

newsRouter.post("/analyze-source", async (req, res) => {
  try {
    const symbol = toSymbol(req.body?.symbol ?? req.body?.company);
    const source = (req.body?.source ?? req.body) as Record<string, unknown>;
    const result = await analyzeNewsSource({
      id: typeof source.id === "string" ? source.id : `src-${Date.now()}`,
      title: typeof source.title === "string" ? source.title : undefined,
      url: typeof source.url === "string" ? source.url : undefined,
      text: typeof source.text === "string" ? source.text : undefined,
      provider: (typeof source.provider === "string" ? source.provider : "url") as any,
      publishedAt: typeof source.publishedAt === "string" ? source.publishedAt : undefined,
      symbol
    }, symbol);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ code: "NEWS_ANALYZE_SOURCE_FAILED", message: error instanceof Error ? error.message : "Unexpected news error" });
  }
});

newsRouter.post("/analyze-url", async (req, res) => {
  try {
    const symbol = toSymbol(req.body?.symbol ?? req.body?.company);
    const result = await analyzeNewsSource({
      id: `url-${Date.now()}`,
      url: String(req.body?.url ?? ""),
      title: typeof req.body?.title === "string" ? req.body.title : undefined,
      provider: "url",
      symbol,
      publishedAt: typeof req.body?.publishedAt === "string" ? req.body.publishedAt : undefined
    }, symbol);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ code: "NEWS_ANALYZE_URL_FAILED", message: error instanceof Error ? error.message : "Unexpected news error" });
  }
});

newsRouter.post("/analyze-sources", async (req, res) => {
  try {
    const symbol = toSymbol(req.body?.symbol ?? req.body?.company);
    const sourcesInput = Array.isArray(req.body?.sources)
      ? req.body.sources
      : Array.isArray(req.body?.urls)
        ? req.body.urls.map((url: string, index: number) => ({ id: `source-${index}`, url, provider: "url", symbol }))
        : [];

    if (sourcesInput.length === 0) {
      res.status(400).json({ code: "NEWS_SOURCES_REQUIRED", message: "Envía al menos una fuente en sources[] o urls[]." });
      return;
    }

    const result = await analyzeNewsSources(sourcesInput, symbol);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ code: "NEWS_ANALYZE_SOURCES_FAILED", message: error instanceof Error ? error.message : "Unexpected news error" });
  }
});

newsRouter.get("/data", async (req, res) => {
  try {
    const symbol = toSymbol(req.query.symbol);
    const limit = toLimit(req.query.limit);
    const result = await fetchNewsData({ symbol, limit, from: toDate(req.query.from), to: toDate(req.query.to), includeFallback: false });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ code: "NEWS_DATA_FAILED", message: error instanceof Error ? error.message : "Unexpected news error" });
  }
});

newsRouter.get("/confluence", async (req, res) => {
  try {
    const symbol = toSymbol(req.query.symbol);
    const limit = toLimit(req.query.limit, 8);
    const result = await evaluateNewsImpact({ symbol, limit, from: toDate(req.query.from), to: toDate(req.query.to), includeFallback: false });
    res.status(200).json({
      ...result,
      recommendation: buildInvestmentAdvice(result)
    });
  } catch (error) {
    res.status(500).json({ code: "NEWS_CONFLUENCE_FAILED", message: error instanceof Error ? error.message : "Unexpected news error" });
  }
});

newsRouter.post("/advisor", async (req, res) => {
  try {
    const symbol = toSymbol(req.body?.symbol ?? req.body?.company);
    const sources = Array.isArray(req.body?.sources) ? req.body.sources : [];
    if (sources.length > 0) {
      const analyzed = await analyzeNewsSources(sources, symbol);
      res.status(200).json({ analysis: analyzed, recommendation: buildInvestmentAdvice(analyzed as any) });
      return;
    }

    const impact = await evaluateNewsImpact({ symbol, limit: toLimit(req.body?.limit, 8), includeFallback: false });
    res.status(200).json({ analysis: impact, recommendation: buildInvestmentAdvice(impact) });
  } catch (error) {
    res.status(500).json({ code: "NEWS_ADVISOR_FAILED", message: error instanceof Error ? error.message : "Unexpected news error" });
  }
});
