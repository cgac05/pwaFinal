import { fetchNewsData } from "./newsDataService";
import type { NewsImpactResponse, NewsVerdict } from "./types";
import { attachNewsCanonicalToSources, buildNewsCanonicalPayloadFromSources } from "./newsCanonicalOutput";

function verdictToNumber(verdict: NewsVerdict): number {
  if (verdict === "BUY") return 1;
  if (verdict === "SELL") return -1;
  return 0;
}

export async function evaluateNewsImpact(input: string | { symbol: string; limit?: number; from?: string; to?: string; includeFallback?: boolean }): Promise<NewsImpactResponse> {
  const data = await fetchNewsData(input as any);
  const articles = attachNewsCanonicalToSources(data.symbol, data.articles);
  const total = articles.length || 1;
  const weighted = articles.reduce((sum, article) => sum + verdictToNumber(article.verdict) * article.confidence * article.credibilityScore, 0) / total;
  const score = Number(Math.max(-1, Math.min(1, weighted)).toFixed(3));
  const sentimentScore = articles.reduce((sum, article) => sum + article.sentimentScore, 0) / total;
  const verdict: NewsVerdict = articles.length === 0 ? "HOLD" : score > 0.16 ? "BUY" : score < -0.16 ? "SELL" : "HOLD";
  const sentiment = sentimentScore > 0.12 ? "positive" : sentimentScore < -0.12 ? "negative" : "neutral";
  const confidence = articles.length === 0
    ? 0
    : Number(Math.max(0.2, Math.min(0.98, articles.reduce((sum, article) => sum + article.confidence, 0) / total)).toFixed(3));

  const generatedAt = new Date().toISOString();

  return {
    symbol: data.symbol,
    generatedAt,
    score,
    sentiment,
    verdict,
    confidence,
    articles,
    providerStatus: data.providerStatus,
    realDataOnly: true,
    evidence: articles.map((article) => ({ sourceId: article.id, verdict: article.verdict, confidence: article.confidence, rationale: article.rationale })),
    canonical: buildNewsCanonicalPayloadFromSources(data.symbol, articles, generatedAt, "news-confluence")
  };
}
