import { getAuthHeaders } from "../signals/signalApi";
import { getCached, setCache } from "../apiCache";

const CACHE_TTL_MS = 90 * 1000;

export interface RelevantNewsItem {
  id: string;
  symbol: string | null;
  headline: string;
  summary: string | null;
  sentiment: "bullish" | "bearish" | "neutral" | null;
  relevanceScore: number | null;
  source: string | null;
  url: string | null;
  publishedAt: string;
  archivedAt: string;
}

export interface RelevantNewsResponse {
  ticker: string;
  count: number;
  items: RelevantNewsItem[];
  source: string;
  fetchedAt: string;
}

const DEMO_NEWS: Record<string, RelevantNewsItem[]> = {
  SPY: [
    {
      id: "demo-spy-1",
      symbol: "SPY",
      headline: "Los flujos defensivos suben mientras el mercado espera nuevas referencias macro",
      summary: "Los operadores mantienen una postura prudente y priorizan cobertura de corto plazo.",
      sentiment: "neutral",
      relevanceScore: 0.84,
      source: "Market Desk",
      url: null,
      publishedAt: new Date().toISOString(),
      archivedAt: new Date().toISOString(),
    },
    {
      id: "demo-spy-2",
      symbol: "SPY",
      headline: "El ETF amplía volumen tras comentarios sobre tasas y crecimiento",
      summary: "La lectura de sentimiento combina alivio por inflación moderada y cautela por guidance.",
      sentiment: "bullish",
      relevanceScore: 0.72,
      source: "Trading Desk",
      url: null,
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      archivedAt: new Date().toISOString(),
    },
  ],
};

function buildFallbackNews(ticker: string): RelevantNewsResponse {
  const symbol = ticker.toUpperCase();
  const baseItems = DEMO_NEWS[symbol] ?? [
    {
      id: `demo-${symbol}-1`,
      symbol,
      headline: `Noticias recientes para ${symbol} no disponibles en la base local`,
      summary: "La sección usa una vista de respaldo mientras llegan artículos reales del backend.",
      sentiment: "neutral" as const,
      relevanceScore: 0.5,
      source: "Demo feed",
      url: null,
      publishedAt: new Date().toISOString(),
      archivedAt: new Date().toISOString(),
    },
  ];

  return {
    ticker: symbol,
    count: baseItems.length,
    items: baseItems,
    source: "demo",
    fetchedAt: new Date().toISOString(),
  };
}

export async function getRelevantNews(
  ticker: string,
  limit = 5,
  signal?: AbortSignal
): Promise<RelevantNewsResponse> {
  const symbol = ticker.trim().toUpperCase();
  const cacheKey = `news:relevant:${symbol}:${limit}`;
  const cached = getCached<RelevantNewsResponse>(cacheKey);
  if (cached) return cached;

  if (!symbol) {
    return buildFallbackNews("SPY");
  }

  const params = new URLSearchParams({ ticker: symbol, limit: String(limit) });
  const response = await fetch(`/api/news/relevant?${params}`, {
    headers: { ...getAuthHeaders() },
    signal,
  });

  if (!response.ok) {
    const fallback = buildFallbackNews(symbol);
    setCache(cacheKey, fallback, CACHE_TTL_MS);
    return fallback;
  }

  const data = (await response.json()) as RelevantNewsResponse;
  const normalized = data.items.length > 0 ? data : buildFallbackNews(symbol);
  setCache(cacheKey, normalized, CACHE_TTL_MS);
  return normalized;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEAM-06 · Noticias bonitas / confluencia real
// FIC: Se agregan los contratos y llamadas del panel bonito sin borrar getRelevantNews().
// ─────────────────────────────────────────────────────────────────────────────
export type NewsSentiment = "positive" | "neutral" | "negative";
export type NewsVerdict = "BUY" | "HOLD" | "SELL";

export interface NewsSourceInput {
  id?: string;
  title?: string;
  url?: string;
  text?: string;
  provider?: string;
  publishedAt?: string;
  symbol?: string;
}

export interface AnalyzedNewsSource {
  id: string;
  title: string;
  url?: string;
  provider: string;
  publishedAt: string;
  summary: string;
  rawText: string;
  sentiment: NewsSentiment;
  sentimentScore: number;
  confidence: number;
  credibilityScore: number;
  affectedSymbols: string[];
  keywords: string[];
  verdict: NewsVerdict;
  rationale: string;
}

export interface NewsProviderStatus {
  id: string;
  label: string;
  enabled: boolean;
  ok: boolean;
  count: number;
  message: string;
  rawCount?: number;
  relevantCount?: number;
}

export interface NewsAnalysisAggregate {
  symbol: string;
  generatedAt: string;
  totalSources: number;
  sentiment: NewsSentiment;
  sentimentScore: number;
  confidence: number;
  verdict: NewsVerdict;
  buyCount: number;
  holdCount: number;
  sellCount: number;
  sources: AnalyzedNewsSource[];
  highlights: string[];
}

export interface NewsConfluenceResponse {
  symbol: string;
  generatedAt: string;
  score: number;
  sentiment: NewsSentiment;
  verdict: NewsVerdict;
  confidence: number;
  articles: AnalyzedNewsSource[];
  providerStatus: NewsProviderStatus[];
  realDataOnly: true;
  evidence: Array<{ sourceId: string; verdict: NewsVerdict; confidence: number; rationale: string }>;
  recommendation?: {
    symbol: string;
    verdict: NewsVerdict;
    confidence: number;
    action: string;
    summary: string;
    riskNote: string;
    checklist: string[];
  };
}

export interface NewsDateRange {
  from?: string;
  to?: string;
}

async function readNewsJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "message" in payload
      ? String((payload as { message?: unknown }).message)
      : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

export async function getNewsConfluence(symbol: string, limit = 8, signal?: AbortSignal, dateRange?: NewsDateRange): Promise<NewsConfluenceResponse> {
  const params = new URLSearchParams({ symbol: symbol.trim().toUpperCase(), limit: String(limit) });
  if (dateRange?.from) params.set("from", dateRange.from);
  if (dateRange?.to) params.set("to", dateRange.to);
  const response = await fetch(`/api/news/confluence?${params.toString()}`, { signal });
  return readNewsJson<NewsConfluenceResponse>(response);
}

export async function analyzeNewsSources(symbol: string, sources: NewsSourceInput[], signal?: AbortSignal): Promise<NewsAnalysisAggregate> {
  const response = await fetch("/api/news/analyze-sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol: symbol.trim().toUpperCase(), sources }),
    signal
  });
  return readNewsJson<NewsAnalysisAggregate>(response);
}

export async function analyzeSingleSource(symbol: string, source: NewsSourceInput, signal?: AbortSignal): Promise<AnalyzedNewsSource> {
  const response = await fetch("/api/news/analyze-source", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol: symbol.trim().toUpperCase(), source }),
    signal
  });
  return readNewsJson<AnalyzedNewsSource>(response);
}

