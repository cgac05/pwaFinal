import { Router } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NewsAdapter, demoNewsForSymbol } from "../../modules/news/newsAdapter";
import { fetchNewsData } from "../../modules/news/newsDataService";
import type { AnalyzedNewsSource, NewsArticle, NewsSentiment, NewsCanonicalPayload } from "../../modules/news/types";
import { buildNewsCanonicalPayloadFromRelevantItems } from "../../modules/news/newsCanonicalOutput";

interface NewsArchiveRow {
  id: string;
  symbol: string | null;
  headline: string;
  summary: string | null;
  sentiment: "bullish" | "bearish" | "neutral" | null;
  relevance_score: number | string | null;
  source: string | null;
  url: string | null;
  published_at: string;
  archived_at: string;
}

export interface RelevantNewsItem {
  id: string;
  symbol: string | null;
  headline: string;
  summary: string | null;
  sentiment: "bullish" | "bearish" | "neutral" | null;
  relevanceScore: number | null;
  confidenceScore: number | null;
  credibilityScore: number | null;
  relevanceReason: string | null;
  source: string | null;
  url: string | null;
  publishedAt: string;
  archivedAt: string;
}

export interface RelevantNewsPayload {
  ticker: string;
  count: number;
  items: RelevantNewsItem[];
  source: "supabase" | "live-providers" | "alpaca-news" | "demo-fallback";
  warnings: string[];
  fetchedAt: string;
  canonical: NewsCanonicalPayload;
  version: "news-canonical-v13";
}

export function parseNewsTicker(rawTicker: string | undefined): string {
  const ticker = (rawTicker ?? "").trim().toUpperCase();
  return ticker.replace(/[^A-Z0-9.\-]/g, "").slice(0, 12);
}

export function parseNewsLimit(rawLimit: unknown): number {
  const parsed = Number(rawLimit ?? 5);
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(Math.max(Math.trunc(parsed), 1), 12);
}

function toArchivedSentiment(sentiment: NewsSentiment): "bullish" | "bearish" | "neutral" {
  if (sentiment === "positive") return "bullish";
  if (sentiment === "negative") return "bearish";
  return "neutral";
}


function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

function sourceCredibility(provider: string | null | undefined, url?: string | null, text = ""): number {
  const clean = `${provider ?? ""} ${url ?? ""}`.toLowerCase();
  let score = 0.48;
  if (/reuters|bloomberg|wsj|sec\.gov/.test(clean)) score += 0.32;
  else if (/yahoo|finnhub|polygon|alphavantage|alpha vantage|newsapi|marketwatch|cnbc|nasdaq/.test(clean)) score += 0.25;
  else if (/stocktwits|seekingalpha|benzinga/.test(clean)) score += 0.16;
  if ((url ?? "").startsWith("https://")) score += 0.07;
  if (text.length > 300) score += 0.04;
  return round3(clamp(score, 0.18, 0.98));
}

function sentimentEvidence(text: string): { bullish: number; bearish: number; confidence: number; sentiment: "bullish" | "bearish" | "neutral" } {
  const normalized = text.toLowerCase();
  const bullishTerms = ["supera", "eleva", "solidos", "sólidos", "fuerte", "impulsa", "growth", "beats", "surge", "rally", "gain", "record", "higher", "strong", "bullish"];
  const bearishTerms = ["presion", "presión", "costos", "competencia", "reguladores", "falls", "risk", "probe", "drop", "loss", "lower", "warning", "bearish"];
  const bullish = bullishTerms.reduce((sum, term) => sum + (normalized.includes(term) ? 1 : 0), 0);
  const bearish = bearishTerms.reduce((sum, term) => sum + (normalized.includes(term) ? 1 : 0), 0);
  const total = bullish + bearish;
  const density = clamp(total / 5, 0, 1);
  const textCoverage = clamp(text.length / 450, 0, 1);
  const confidence = round3(total === 0 ? 0.25 + textCoverage * 0.15 : 0.35 + density * 0.45 + textCoverage * 0.2);
  const sentiment = bullish > bearish ? "bullish" : bearish > bullish ? "bearish" : "neutral";
  return { bullish, bearish, confidence: clamp(confidence, 0, 0.95), sentiment };
}

function relevanceFormula(confidence: number, credibility: number): string {
  return `confianza(${confidence.toFixed(3)}) x credibilidad(${credibility.toFixed(3)}) = relevancia(${round3(confidence * credibility).toFixed(3)})`;
}

function mapRow(row: NewsArchiveRow): RelevantNewsItem {
  return {
    id: row.id,
    symbol: row.symbol,
    headline: row.headline,
    summary: row.summary,
    sentiment: row.sentiment,
    relevanceScore:
      row.relevance_score === null || row.relevance_score === ""
        ? null
        : Number(row.relevance_score),
    confidenceScore: row.relevance_score === null || row.relevance_score === "" ? null : Number(row.relevance_score),
    credibilityScore: row.source ? sourceCredibility(row.source, row.url, `${row.headline} ${row.summary ?? ""}`) : null,
    relevanceReason: "Supabase solo entrego relevance_score; se conserva y se calcula credibilidad por fuente/URL.",
    source: row.source,
    url: row.url,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
  };
}

function mapAnalyzedArticle(article: AnalyzedNewsSource, ticker: string): RelevantNewsItem {
  const confidence = round3(clamp(article.confidence));
  const credibility = round3(clamp(article.credibilityScore));
  const relevanceScore = round3(confidence * credibility);

  return {
    id: article.id,
    symbol: ticker,
    headline: article.title,
    summary: article.summary || article.rationale || null,
    sentiment: toArchivedSentiment(article.sentiment ?? "neutral"),
    relevanceScore,
    confidenceScore: confidence,
    credibilityScore: credibility,
    relevanceReason: relevanceFormula(confidence, credibility),
    source: article.provider,
    url: article.url ?? null,
    publishedAt: article.publishedAt,
    archivedAt: new Date().toISOString(),
  };
}

function mapAdapterArticle(article: NewsArticle, ticker: string): RelevantNewsItem {
  const text = `${article.headline} ${article.summary}`;
  const evidence = sentimentEvidence(text);
  const credibility = sourceCredibility(article.source || "Alpaca News", article.url, text);
  const relevanceScore = round3(evidence.confidence * credibility);

  return {
    id: article.id,
    symbol: ticker,
    headline: article.headline,
    summary: article.summary || null,
    sentiment: evidence.sentiment,
    relevanceScore,
    confidenceScore: evidence.confidence,
    credibilityScore: credibility,
    relevanceReason: relevanceFormula(evidence.confidence, credibility),
    source: article.source || "Alpaca News",
    url: article.url || null,
    publishedAt: article.createdAt,
    archivedAt: new Date().toISOString(),
  };
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readFromArchive(supabaseClient: SupabaseClient, ticker: string, limit: number): Promise<RelevantNewsItem[]> {
  const { data, error } = await supabaseClient
    .from("news_archive")
    .select("id,symbol,headline,summary,sentiment,relevance_score,source,url,published_at,archived_at")
    .or(`symbol.eq.${ticker},symbol.is.null`)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as NewsArchiveRow[]).map(mapRow);
}

async function readFromLiveProviders(ticker: string, limit: number): Promise<RelevantNewsItem[]> {
  const data = await fetchNewsData({ symbol: ticker, limit, includeFallback: false }, limit);
  return data.articles.slice(0, limit).map((article) => mapAnalyzedArticle(article, ticker));
}

async function readFromAlpacaOrDemo(ticker: string, limit: number): Promise<{ items: RelevantNewsItem[]; source: "alpaca-news" | "demo-fallback" }> {
  const adapter = new NewsAdapter();
  const articles = await adapter.getRecentNews(ticker, limit);
  const fallback = articles.length > 0 ? articles : demoNewsForSymbol(ticker, limit);
  const items = fallback.slice(0, limit).map((article) => mapAdapterArticle(article, ticker));
  const usedDemo = items.some((item) => item.id.startsWith(`demo-${ticker}-`));
  return { items, source: usedDemo ? "demo-fallback" : "alpaca-news" };
}

function buildPayload(ticker: string, items: RelevantNewsItem[], source: RelevantNewsPayload["source"], warnings: string[]): RelevantNewsPayload {
  const fetchedAt = new Date().toISOString();

  return {
    ticker,
    count: items.length,
    items,
    source,
    warnings,
    fetchedAt,
    canonical: buildNewsCanonicalPayloadFromRelevantItems(ticker, items, source, fetchedAt),
    version: "news-canonical-v13",
  };
}

export async function buildRelevantNewsPayload(
  supabaseClient: SupabaseClient,
  ticker: string,
  limit: number,
): Promise<RelevantNewsPayload> {
  const warnings: string[] = [];

  // Supabase NO debe tumbar noticias. Si el schema public esta mal, brincamos a fuentes reales.
  try {
    const archivedItems = await readFromArchive(supabaseClient, ticker, limit);
    if (archivedItems.length > 0) {
      return buildPayload(ticker, archivedItems, "supabase", warnings);
    }
    warnings.push("news_archive_empty");
  } catch (error) {
    warnings.push("news_archive_unavailable");
    console.warn(`[news/relevant:canonical-v13] Supabase omitido para ${ticker}: ${safeErrorMessage(error)}`);
  }

  // Luego intenta fuentes reales configuradas en newsDataService: Yahoo RSS/API providers.
  try {
    const liveItems = await readFromLiveProviders(ticker, limit);
    if (liveItems.length > 0) {
      return buildPayload(ticker, liveItems, "live-providers", warnings);
    }
    warnings.push("live_providers_empty");
  } catch (error) {
    warnings.push("live_providers_unavailable");
    console.warn(`[news/relevant:canonical-v13] Proveedores reales omitidos para ${ticker}: ${safeErrorMessage(error)}`);
  }

  // Ultimo respaldo: Alpaca si hay keys; si no, demo determinista. Nunca debe regresar 500.
  try {
    const { items, source } = await readFromAlpacaOrDemo(ticker, limit);
    return buildPayload(
      ticker,
      items,
      source,
      source === "demo-fallback"
        ? [...warnings, "demo_news_used_after_real_sources_failed_or_returned_empty"]
        : warnings,
    );
  } catch (error) {
    warnings.push("adapter_unavailable");
    console.warn(`[news/relevant:canonical-v13] Adapter omitido para ${ticker}: ${safeErrorMessage(error)}`);
    return buildPayload(
      ticker,
      demoNewsForSymbol(ticker, limit).map((article) => mapAdapterArticle(article, ticker)),
      "demo-fallback",
      [...warnings, "forced_demo_news_used"],
    );
  }
}

export function createRelevantNewsRouter(supabaseClient: SupabaseClient): Router {
  const router = Router();

  router.get("/relevant", async (req, res) => {
    const rawTicker =
      typeof req.query.ticker === "string"
        ? req.query.ticker
        : typeof req.query.symbol === "string"
          ? req.query.symbol
          : undefined;
    const ticker = parseNewsTicker(rawTicker);
    const limit = parseNewsLimit(req.query.limit);

    if (!ticker) {
      return res.status(400).json({
        error: "ticker_required",
        message: "Agrega ?ticker=SPY o ?symbol=SPY.",
        version: "news-canonical-v13",
      });
    }

    try {
      const payload = await buildRelevantNewsPayload(supabaseClient, ticker, limit);
      return res.status(200).json(payload);
    } catch (error) {
      console.warn(`[news/relevant:canonical-v13] Fallback final activado para ${ticker}: ${safeErrorMessage(error)}`);
      return res.status(200).json(
        buildPayload(
          ticker,
          demoNewsForSymbol(ticker, limit).map((article) => mapAdapterArticle(article, ticker)),
          "demo-fallback",
          ["final_demo_fallback_used"],
        ),
      );
    }
  });

  return router;
}
