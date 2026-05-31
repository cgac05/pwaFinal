import { analyzeNewsSource } from "./urlAnalysisService";
import type { AnalyzedNewsSource, NewsDataResponse, NewsProviderId, NewsProviderStatus, NewsQueryParams, NewsSourceInput } from "./types";

const CACHE_TTL_MS = 1000 * 60 * 4;
const cache = new Map<string, { expiresAt: number; data: NewsDataResponse }>();

const COMPANY_NAMES: Record<string, string> = {
  AAPL: "Apple",
  MSFT: "Microsoft",
  NVDA: "NVIDIA",
  TSLA: "Tesla",
  AMZN: "Amazon",
  GOOGL: "Alphabet",
  META: "Meta",
  AMD: "AMD",
  SPY: "S&P 500",
  QQQ: "Nasdaq 100",
  JPM: "JPMorgan",
  COIN: "Coinbase"
};

const SYMBOL_ALIASES: Record<string, string[]> = {
  AAPL: ["apple", "iphone", "ipad", "mac"],
  MSFT: ["microsoft", "azure", "windows", "copilot"],
  NVDA: ["nvidia", "gpu", "blackwell", "cuda"],
  TSLA: ["tesla", "elon", "model y", "model 3"],
  AMZN: ["amazon", "aws", "prime"],
  GOOGL: ["alphabet", "google", "youtube", "gemini"],
  META: ["meta", "facebook", "instagram", "whatsapp"],
  AMD: ["advanced micro devices", "radeon", "epyc", "ryzen"],
  SPY: ["s&p 500", "sp500", "s&p", "stock market"],
  QQQ: ["nasdaq 100", "nasdaq", "invesco qqq"],
  JPM: ["jpmorgan", "jp morgan", "chase"],
  COIN: ["coinbase", "crypto exchange"]
};

const PROVIDER_LABELS: Record<NewsProviderId, string> = {
  manual: "Fuente manual",
  url: "URL manual",
  yahooFinance: "Yahoo Finance RSS",
  finnhub: "Finnhub Company News",
  newsapi: "NewsAPI Everything",
  alphaVantage: "Alpha Vantage News Sentiment",
  polygon: "Polygon Ticker News",
  tnmtAnalyzer: "TNMT Analyzer"
};

interface ProviderResult {
  provider: NewsProviderId;
  enabled: boolean;
  sources: NewsSourceInput[];
  message: string;
  ok: boolean;
  rawCount?: number;
  relevantCount?: number;
}

function normalizeInput(input: string | NewsQueryParams, limit = 8): Required<NewsQueryParams> {
  if (typeof input === "string") {
    return { symbol: input.trim().toUpperCase() || "SPY", limit, from: "", to: "", includeFallback: false };
  }

  return {
    symbol: input.symbol.trim().toUpperCase() || "SPY",
    limit: input.limit ?? limit,
    from: input.from ?? "",
    to: input.to ?? "",
    includeFallback: false
  };
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value: string): string {
  return decodeXml(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractTag(item: string, tag: string): string | undefined {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] ? stripHtml(match[1]) : undefined;
}

function toIsoDate(daysAgo = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function normalizeDate(value?: string): string | undefined {
  const text = value?.trim();
  return text ? text.slice(0, 10) : undefined;
}

function isWithinDateRange(publishedAt: string | undefined, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  const date = publishedAt ? new Date(publishedAt) : null;
  if (!date || Number.isNaN(date.getTime())) return false;
  const timestamp = date.getTime();
  if (from) {
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    if (timestamp < fromDate.getTime()) return false;
  }
  if (to) {
    const toDate = new Date(`${to}T23:59:59.999Z`);
    if (timestamp > toDate.getTime()) return false;
  }
  return true;
}

function getEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && !value.includes("YOUR_") && !value.startsWith("<") ? value : undefined;
}

function providerStatus(result: ProviderResult): NewsProviderStatus {
  return {
    id: result.provider,
    label: PROVIDER_LABELS[result.provider],
    enabled: result.enabled,
    ok: result.ok,
    count: result.sources.length,
    message: result.message,
    rawCount: result.rawCount,
    relevantCount: result.relevantCount
  };
}

function isRelevantToSymbol(source: NewsSourceInput, symbol: string): boolean {
  const haystack = `${source.symbol ?? ""} ${source.title ?? ""} ${source.text ?? ""} ${source.url ?? ""}`.toLowerCase();
  const safeSymbol = symbol.toUpperCase();
  const company = COMPANY_NAMES[safeSymbol]?.toLowerCase();
  const aliases = SYMBOL_ALIASES[safeSymbol] ?? [];

  if (new RegExp(`\\b${safeSymbol.toLowerCase()}\\b`, "i").test(haystack)) return true;
  if (company && haystack.includes(company)) return true;
  return aliases.some((alias) => haystack.includes(alias.toLowerCase()));
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": process.env.EDGAR_USER_AGENT ?? "InversionsTNMT/1.0 (real-news-mode)",
        accept: "application/json,text/xml,application/xml,text/plain,*/*"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const text = await fetchText(url, timeoutMs);
  return JSON.parse(text) as T;
}

async function runProvider(provider: NewsProviderId, enabled: boolean, fetcher: () => Promise<NewsSourceInput[]>): Promise<ProviderResult> {
  if (!enabled) {
    return { provider, enabled: false, ok: false, sources: [], message: "Sin API key configurada" };
  }

  try {
    const sources = await fetcher();
    return {
      provider,
      enabled: true,
      ok: true,
      sources,
      message: sources.length > 0 ? `${sources.length} noticia(s) reales recibidas` : "Proveedor respondió sin noticias para el ticker"
    };
  } catch (error) {
    return {
      provider,
      enabled: true,
      ok: false,
      sources: [],
      message: error instanceof Error ? error.message : "Error desconocido del proveedor"
    };
  }
}

async function fetchYahooFinance(symbol: string, limit: number, timeoutMs: number): Promise<NewsSourceInput[]> {
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`;
  const xml = await fetchText(url, timeoutMs);
  const items = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].slice(0, limit);

  return items.map((match, index) => ({
    id: `yahoo-${symbol}-${index}`,
    title: extractTag(match[0], "title") ?? `${symbol} headline`,
    text: extractTag(match[0], "description") ?? "",
    url: extractTag(match[0], "link"),
    provider: "yahooFinance",
    publishedAt: extractTag(match[0], "pubDate") ? new Date(extractTag(match[0], "pubDate") as string).toISOString() : new Date().toISOString(),
    symbol
  }));
}

async function fetchFinnhub(symbol: string, limit: number, timeoutMs: number): Promise<NewsSourceInput[]> {
  const token = getEnv("FINNHUB_API_KEY");
  if (!token) return [];

  const params = new URLSearchParams({
    symbol,
    from: toIsoDate(30),
    to: toIsoDate(0),
    token
  });
  const payload = await fetchJson<Array<{ id?: number; headline?: string; summary?: string; url?: string; datetime?: number; source?: string }>>(
    `https://finnhub.io/api/v1/company-news?${params.toString()}`,
    timeoutMs
  );

  return payload.slice(0, limit).map((item, index) => ({
    id: `finnhub-${item.id ?? `${symbol}-${index}`}`,
    title: item.headline,
    text: item.summary,
    url: item.url,
    provider: "finnhub",
    publishedAt: item.datetime ? new Date(item.datetime * 1000).toISOString() : new Date().toISOString(),
    symbol
  }));
}

async function fetchNewsApi(symbol: string, limit: number, timeoutMs: number): Promise<NewsSourceInput[]> {
  const apiKey = getEnv("NEWSAPI_API_KEY");
  if (!apiKey) return [];

  const company = COMPANY_NAMES[symbol] ?? symbol;
  const params = new URLSearchParams({
    q: `(${symbol} OR "${company}") AND (stock OR shares OR earnings OR market)`,
    language: "en",
    sortBy: "publishedAt",
    pageSize: String(Math.min(100, limit)),
    apiKey
  });
  const payload = await fetchJson<{ articles?: Array<{ title?: string; description?: string; content?: string; url?: string; publishedAt?: string; source?: { name?: string } }> }>(
    `https://newsapi.org/v2/everything?${params.toString()}`,
    timeoutMs
  );

  return (payload.articles ?? []).slice(0, limit).map((item, index) => ({
    id: `newsapi-${symbol}-${index}`,
    title: item.title,
    text: [item.description, item.content].filter(Boolean).join(" "),
    url: item.url,
    provider: "newsapi",
    publishedAt: item.publishedAt ?? new Date().toISOString(),
    symbol
  }));
}

async function fetchAlphaVantage(symbol: string, limit: number, timeoutMs: number): Promise<NewsSourceInput[]> {
  const apiKey = getEnv("ALPHA_VANTAGE_API_KEY");
  if (!apiKey) return [];

  const params = new URLSearchParams({
    function: "NEWS_SENTIMENT",
    tickers: symbol,
    limit: String(Math.min(50, limit)),
    apikey: apiKey
  });
  const payload = await fetchJson<{ feed?: Array<{ title?: string; summary?: string; url?: string; time_published?: string; source?: string }> }>(
    `https://www.alphavantage.co/query?${params.toString()}`,
    timeoutMs
  );

  return (payload.feed ?? []).slice(0, limit).map((item, index) => ({
    id: `alphavantage-${symbol}-${index}`,
    title: item.title,
    text: item.summary,
    url: item.url,
    provider: "alphaVantage",
    publishedAt: item.time_published
      ? new Date(`${item.time_published.slice(0, 4)}-${item.time_published.slice(4, 6)}-${item.time_published.slice(6, 8)}T${item.time_published.slice(9, 11)}:${item.time_published.slice(11, 13)}:${item.time_published.slice(13, 15)}Z`).toISOString()
      : new Date().toISOString(),
    symbol
  }));
}

async function fetchPolygon(symbol: string, limit: number, timeoutMs: number): Promise<NewsSourceInput[]> {
  const apiKey = getEnv("POLYGON_API_KEY");
  if (!apiKey) return [];

  const params = new URLSearchParams({
    ticker: symbol,
    limit: String(Math.min(100, limit)),
    order: "desc",
    sort: "published_utc",
    apiKey
  });
  const payload = await fetchJson<{ results?: Array<{ id?: string; title?: string; description?: string; article_url?: string; published_utc?: string; publisher?: { name?: string } }> }>(
    `https://api.polygon.io/v2/reference/news?${params.toString()}`,
    timeoutMs
  );

  return (payload.results ?? []).slice(0, limit).map((item, index) => ({
    id: `polygon-${item.id ?? `${symbol}-${index}`}`,
    title: item.title,
    text: item.description,
    url: item.article_url,
    provider: "polygon",
    publishedAt: item.published_utc ?? new Date().toISOString(),
    symbol
  }));
}

function dedupe(items: NewsSourceInput[]): NewsSourceInput[] {
  const seen = new Set<string>();
  const out: NewsSourceInput[] = [];
  for (const item of items) {
    const key = `${item.url ?? ""}|${item.title ?? ""}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function sortByDate(items: NewsSourceInput[]): NewsSourceInput[] {
  return [...items].sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime());
}

export async function fetchNewsData(input: string | NewsQueryParams, defaultLimit = 8): Promise<NewsDataResponse> {
  const params = normalizeInput(input, defaultLimit);
  const from = normalizeDate(params.from);
  const to = normalizeDate(params.to);
  const timeoutMs = Number(process.env.NEWS_FETCH_TIMEOUT_MS ?? 5500);
  const configuredProviders = [
    getEnv("FINNHUB_API_KEY") ? "finnhub" : "no-finnhub",
    getEnv("NEWSAPI_API_KEY") ? "newsapi" : "no-newsapi",
    getEnv("POLYGON_API_KEY") ? "polygon" : "no-polygon",
    getEnv("ALPHA_VANTAGE_API_KEY") ? "alpha" : "no-alpha"
  ].join(":");
  const cacheKey = `${params.symbol}:${params.limit}:${from ?? "all"}:${to ?? "all"}:real-only:${configuredProviders}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, fromCache: true };
  }

  const perProviderLimit = Math.max(params.limit, 8);
  const results = await Promise.all([
    runProvider("yahooFinance", true, () => fetchYahooFinance(params.symbol, perProviderLimit, timeoutMs)),
    runProvider("finnhub", Boolean(getEnv("FINNHUB_API_KEY")), () => fetchFinnhub(params.symbol, perProviderLimit, timeoutMs)),
    runProvider("newsapi", Boolean(getEnv("NEWSAPI_API_KEY")), () => fetchNewsApi(params.symbol, perProviderLimit, timeoutMs)),
    runProvider("polygon", Boolean(getEnv("POLYGON_API_KEY")), () => fetchPolygon(params.symbol, perProviderLimit, timeoutMs)),
    runProvider("alphaVantage", Boolean(getEnv("ALPHA_VANTAGE_API_KEY")), () => fetchAlphaVantage(params.symbol, perProviderLimit, timeoutMs))
  ]);

  // Calcular noticias crudas vs relevantes por proveedor
  const resultsWithFiltering = results.map((result) => {
    const rawCount = result.sources.length;
    const relevantCount = result.sources.filter((source) => isWithinDateRange(source.publishedAt, from, to) && isRelevantToSymbol(source, params.symbol)).length;
    return { ...result, rawCount, relevantCount };
  });

  const status = resultsWithFiltering.map(providerStatus);
  const remote = sortByDate(
    dedupe(resultsWithFiltering.flatMap((result) => result.sources))
      .filter((source) => isWithinDateRange(source.publishedAt, from, to) && isRelevantToSymbol(source, params.symbol))
  ).slice(0, params.limit);

  const articles: AnalyzedNewsSource[] = await Promise.all(
    remote.map((source) => analyzeNewsSource(source, params.symbol))
  );

  const data: NewsDataResponse = {
    symbol: params.symbol,
    generatedAt: new Date().toISOString(),
    fromCache: false,
    articles,
    providerStatus: status,
    realDataOnly: true
  };

  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data });
  return data;
}
