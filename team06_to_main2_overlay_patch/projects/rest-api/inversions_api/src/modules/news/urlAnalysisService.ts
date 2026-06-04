// FIC: Custom URL analysis — fetches a news URL, extracts text, and scores its impact on an instrument.
// FIC: Analisis de URL personalizada — obtiene una URL, extrae texto y evalua su impacto en un instrumento.

import {
  createSentimentAnalyzerForRuntime,
  sentimentToVerdict,
  type NewsSentimentAnalyzer
} from "./sentimentService";
import { resolveVerdict } from "./investmentAdvisor";
import { NEWS_DISCLAIMER, type AnalyzedNewsSource, type NewsAnalysisAggregate, type NewsArticle, type NewsSourceInput, type SourceAnalysisResult } from "./types";
import { attachNewsCanonicalToSource, buildNewsCanonicalPayloadFromSources } from "./newsCanonicalOutput";

export interface URLContent {
  url: string;
  title: string;
  content: string;
  source: string;
  fetchedAt: string;
}

export interface URLAnalysisOptions {
  analyzer?: NewsSentimentAnalyzer;
  timeoutMs?: number;
  maxChars?: number;
  fetchImpl?: typeof fetch;
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

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
  QQQ: ["nasdaq 100", "nasdaq", "qqq"],
  JPM: ["jpmorgan", "jp morgan", "chase"],
  COIN: ["coinbase", "crypto exchange"]
};

export class URLAnalysisService {
  private analyzer: NewsSentimentAnalyzer;
  private timeoutMs: number;
  private maxChars: number;
  private fetchImpl: typeof fetch;

  constructor(opts: URLAnalysisOptions = {}) {
    this.analyzer = opts.analyzer ?? createSentimentAnalyzerForRuntime();
    this.timeoutMs = opts.timeoutMs ?? 15000;
    this.maxChars = opts.maxChars ?? 5000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  // FIC: Fetch and extract readable text from a URL. Throws on network/HTTP failure.
  // FIC: Obtiene y extrae texto legible de una URL. Lanza ante fallo de red/HTTP.
  async fetchURLContent(url: string, company: string): Promise<URLContent> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        headers: { "User-Agent": BROWSER_UA },
        signal: controller.signal
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} al obtener ${url}`);
      }
      const html = await res.text();
      return {
        url,
        title: extractTitle(html) || company,
        content: extractRelevantContent(html, this.maxChars, company),
        source: hostnameOf(url),
        fetchedAt: new Date().toISOString()
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // FIC: Analyze fetched content as a single-article sentiment in the company's context.
  // FIC: Analiza el contenido obtenido como sentimiento de un solo articulo en el contexto de la empresa.
  async analyzeSourceImpact(urlContent: URLContent, company: string): Promise<SourceAnalysisResult> {
    const pseudoArticle: NewsArticle = {
      id: urlContent.url,
      headline: urlContent.title,
      summary: urlContent.content,
      author: "",
      source: urlContent.source,
      url: urlContent.url,
      symbols: [company.toUpperCase()],
      createdAt: urlContent.fetchedAt
    };
    const sentiment = await this.analyzer.analyzeNewsSentiment(company.toUpperCase(), [pseudoArticle]);
    const warnings: string[] = [];
    if (sentiment.degraded) warnings.push("Analisis degradado: se uso el evaluador determinista de respaldo.");
    if (urlContent.content.length < 200) warnings.push("Contenido extraido muy corto; la señal puede ser debil.");

    return {
      url: urlContent.url,
      company: company.toUpperCase(),
      verdict: resolveVerdict(sentiment),
      score: sentiment.score,
      confidence: sentiment.confidence,
      reasoning: sentiment.reasoning,
      keyPoints: sentiment.keyFactors,
      warnings: warnings.length > 0 ? warnings : undefined,
      disclaimer: NEWS_DISCLAIMER,
      timestamp: new Date().toISOString()
    };
  }

  async analyzeSourcesForCompany(company: string, urls: string[]): Promise<NewsAnalysisAggregate> {
    const safeCompany = company.trim().toUpperCase();
    const results = await Promise.all(urls.map(async (url) => {
      const normalizedUrl = normalizeUrl(url);
      const content = await this.fetchURLContent(normalizedUrl, safeCompany);
      return analyzeNewsSource({
        id: normalizedUrl,
        title: content.title,
        url: normalizedUrl,
        text: content.content,
        provider: content.source,
        publishedAt: content.fetchedAt,
        symbol: safeCompany,
      }, safeCompany);
    }));

    const total = results.length || 1;
    const weighted = results.reduce((sum, item) => sum + item.sentimentScore * item.credibilityScore, 0) / total;
    const score = Number(Math.max(-1, Math.min(1, weighted)).toFixed(3));
    const sentiment = score > 0.12 ? "positive" : score < -0.12 ? "negative" : "neutral";
    const verdict = sentimentToVerdict(score);

    const generatedAt = new Date().toISOString();

    return {
      symbol: safeCompany,
      generatedAt,
      totalSources: results.length,
      sentiment,
      sentimentScore: score,
      confidence: Number(Math.min(0.98, Math.max(0.2, results.reduce((sum, item) => sum + item.confidence, 0) / total)).toFixed(3)),
      verdict,
      buyCount: results.filter((item) => item.verdict === "BUY").length,
      holdCount: results.filter((item) => item.verdict === "HOLD").length,
      sellCount: results.filter((item) => item.verdict === "SELL").length,
      sources: results,
      highlights: results.slice(0, 4).map((item) => `${item.verdict}: ${item.title}`),
      canonical: buildNewsCanonicalPayloadFromSources(safeCompany, results, generatedAt, "manual-url-analysis")
    };
  }

  async validateURL(url: string): Promise<boolean> {
    const normalizedUrl = normalizeUrl(url);
    const hostname = hostnameOf(normalizedUrl).toLowerCase();
    return /bloomberg|cnbc|reuters|wsj|marketwatch|finance\.yahoo|nasdaq|sec\.gov|investor/.test(hostname);
  }
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function summarize(text: string): string {
  const clean = normalizeWhitespace(text);
  if (clean.length <= 260) return clean;
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [];
  const selected = sentences.slice(0, 2).join(" ").trim();
  return selected.length > 80 ? selected.slice(0, 340) : `${clean.slice(0, 337)}...`;
}

function credibilityFor(input: NewsSourceInput, text: string): number {
  const url = input.url?.toLowerCase() ?? "";
  const provider = (input.provider ?? "").toLowerCase();

  // Tier 1: highest-credibility financial sources
  const isTier1 = /reuters\.com|bloomberg\.com|wsj\.com|ft\.com|sec\.gov/.test(url);
  // Tier 2: well-known financial media (includes Yahoo Finance RSS links)
  const isTier2 = /cnbc\.com|marketwatch\.com|finance\.yahoo\.com|yahoo\.com\/finance|yahoo\.com\/news|nasdaq\.com|investor\.com|seekingalpha\.com|barrons\.com|fortune\.com|thestreet\.com/.test(url);
  // Tier 3: general reliable media
  const isTier3 = /nytimes\.com|washingtonpost\.com|apnews\.com|bbc\.com|economist\.com|businessinsider\.com|forbes\.com|morningstar\.com/.test(url);

  let score: number;

  if (isTier1) {
    // 0.82 - 0.90 range depending on content depth
    score = 0.82 + (text.length > 2000 ? 0.08 : text.length > 700 ? 0.05 : 0.02);
  } else if (isTier2) {
    // 0.68 - 0.75 range
    score = 0.68 + (text.length > 2000 ? 0.07 : text.length > 700 ? 0.04 : 0.01);
  } else if (isTier3) {
    // 0.58 - 0.64 range
    score = 0.58 + (text.length > 2000 ? 0.06 : text.length > 700 ? 0.03 : 0.0);
  } else if (url.startsWith("https://")) {
    // Unknown HTTPS source — scored by content quality only
    score = 0.42 + (text.length > 2000 ? 0.10 : text.length > 700 ? 0.06 : text.length > 200 ? 0.03 : 0.0);
  } else if (!input.url && input.text) {
    // Plain text paste — scored by length/depth
    score = 0.38 + (text.length > 2000 ? 0.08 : text.length > 700 ? 0.04 : 0.0);
  } else {
    score = 0.30;
  }

  // Bonus for verified data providers (Finnhub, Polygon, Alpha Vantage supply vetted data)
  if (/finnhub|polygon|alphavantage/.test(provider)) score += 0.05;

  return Math.max(0.15, Math.min(0.98, Number(score.toFixed(2))));
}

function extractKeywords(text: string): string[] {
  const normalized = text.toLowerCase();
  const terms = ["earnings", "revenue", "guidance", "stock", "shares", "market", "sec", "options", "analyst", "upgrade", "downgrade", "inflation", "rates", "fed", "ai", "cloud"];
  const found = new Set<string>();
  for (const term of terms) {
    if (normalized.includes(term)) found.add(term);
  }
  const tickers = text.match(/\b[A-Z]{2,5}\b/g) ?? [];
  for (const ticker of tickers.slice(0, 8)) found.add(ticker);
  return [...found].slice(0, 12);
}

function detectSymbols(text: string, explicitSymbol?: string): string[] {
  const normalized = text.toLowerCase();
  const symbols = new Set<string>();
  if (explicitSymbol) symbols.add(explicitSymbol.toUpperCase());
  const tickers = text.match(/\b[A-Z]{1,5}\b/g) ?? [];
  for (const ticker of tickers) symbols.add(ticker);
  const aliases: Record<string, string[]> = {
    AAPL: ["apple", "iphone", "mac"],
    MSFT: ["microsoft", "azure", "copilot"],
    NVDA: ["nvidia", "gpu", "cuda"],
    TSLA: ["tesla", "elon"],
    AMZN: ["amazon", "aws"],
    GOOGL: ["alphabet", "google"],
    META: ["meta", "facebook", "instagram"],
    SPY: ["s&p 500", "sp500", "market"],
    QQQ: ["nasdaq 100", "nasdaq", "qqq"]
  };
  for (const [symbol, list] of Object.entries(aliases)) {
    if (list.some((alias) => normalized.includes(alias))) symbols.add(symbol);
  }
  return [...symbols].slice(0, 8);
}

function sentimentToNews(sentiment: { label: string }): "positive" | "neutral" | "negative" {
  if (sentiment.label === "BULLISH") return "positive";
  if (sentiment.label === "BEARISH") return "negative";
  return "neutral";
}

export async function analyzeNewsSource(input: NewsSourceInput, symbol?: string): Promise<AnalyzedNewsSource> {
  const safeSymbol = (symbol ?? input.symbol ?? "SPY").trim().toUpperCase() || "SPY";
  const sourceId = input.id ?? `src-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const analyzer = createSentimentAnalyzerForRuntime();

  let title = input.title?.trim();
  let rawText = input.text ?? "";
  let provider = input.provider ?? "manual";
  let publishedAt = input.publishedAt ?? new Date().toISOString();

  if (input.url && !rawText) {
    provider = "url";
    try {
      const service = new URLAnalysisService();
      const fetched = await service.fetchURLContent(input.url, safeSymbol);
      title = title ?? fetched.title;
      rawText = fetched.content;
      provider = fetched.source;
      publishedAt = fetched.fetchedAt;
    } catch (error) {
      rawText = `No se pudo descargar la URL ${input.url}. Error: ${(error as Error).message}`;
      title = title ?? "Fuente no disponible";
    }
  }

  if (!rawText && input.url) {
    rawText = input.url;
  }

  const cleanText = normalizeWhitespace(rawText || input.title || "Sin contenido para analizar.");
  const analysisText = `${title ?? ""} ${cleanText}`.trim();
  const sentiment = await analyzer.analyzeNewsSentiment(safeSymbol, [{
    id: sourceId,
    headline: title ?? summarize(cleanText).slice(0, 90),
    summary: cleanText,
    author: "",
    source: String(provider),
    url: input.url ?? "",
    symbols: [safeSymbol],
    createdAt: publishedAt
  }]);
  const credibilityScore = credibilityFor({ ...input, provider }, cleanText);
  const sentimentScore = Number((sentiment.score).toFixed(3));
  const confidenceScore = Number(Math.max(0, Math.min(1, sentiment.confidence)).toFixed(3));
  const weightedConfidence = Number((confidenceScore * credibilityScore).toFixed(3));
  const verdict = sentimentToVerdict(sentimentScore * credibilityScore);
  const calculationReason =
    `Calculo A_NOTICIAS: confianza_sentimiento(${confidenceScore.toFixed(3)}) ` +
    `x credibilidad_fuente(${credibilityScore.toFixed(3)}) = peso(${weightedConfidence.toFixed(3)}).`;

  const analyzed: AnalyzedNewsSource = {
    id: sourceId,
    title: title ?? summarize(cleanText).slice(0, 90),
    url: input.url,
    provider: String(provider),
    publishedAt,
    summary: summarize(cleanText),
    rawText: cleanText.slice(0, 5000),
    sentiment: sentimentToNews(sentiment),
    sentimentScore,
    // v13: confidence guarda la confianza del sentimiento, NO el producto doble con credibilidad.
    // El peso canonico se calcula aparte como confidence * credibilityScore.
    confidence: confidenceScore,
    credibilityScore,
    affectedSymbols: detectSymbols(analysisText, safeSymbol),
    keywords: extractKeywords(analysisText),
    verdict,
    rationale: `${sentiment.reasoning || `Sentimiento ${sentiment.label}.`} ${calculationReason}`
  };

  return attachNewsCanonicalToSource(safeSymbol, analyzed);
}

export async function analyzeNewsSources(inputs: NewsSourceInput[], symbol?: string): Promise<NewsAnalysisAggregate> {
  const safeSymbol = symbol?.trim().toUpperCase() || inputs.find((input) => input.symbol)?.symbol?.toUpperCase() || "SPY";
  const sources = await Promise.all(inputs.map((input) => analyzeNewsSource(input, safeSymbol)));
  const total = sources.length || 1;
  const weighted = sources.reduce((sum, item) => sum + item.sentimentScore * item.credibilityScore, 0) / total;
  const score = Number(Math.max(-1, Math.min(1, weighted)).toFixed(3));
  const sentiment = score > 0.12 ? "positive" : score < -0.12 ? "negative" : "neutral";
  const verdict = score > 0.18 ? "BUY" : score < -0.18 ? "SELL" : "HOLD";
  const buyCount = sources.filter((item) => item.verdict === "BUY").length;
  const sellCount = sources.filter((item) => item.verdict === "SELL").length;
  const holdCount = sources.filter((item) => item.verdict === "HOLD").length;
  const confidence = Number(Math.min(0.98, Math.max(0.2, sources.reduce((sum, item) => sum + item.confidence, 0) / total)).toFixed(3));

  const generatedAt = new Date().toISOString();

  return {
    symbol: safeSymbol,
    generatedAt,
    totalSources: sources.length,
    sentiment,
    sentimentScore: score,
    confidence,
    verdict,
    buyCount,
    holdCount,
    sellCount,
    sources,
    highlights: sources.slice(0, 4).map((item) => `${item.verdict}: ${item.title}`),
    canonical: buildNewsCanonicalPayloadFromSources(safeSymbol, sources, generatedAt, "manual-source-analysis")
  };
}

// FIC: Extract <title> text from raw HTML.
// FIC: Extrae el texto de <title> del HTML crudo.
export function extractTitle(html: string): string {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? decodeEntities(m[1].trim()) : "";
}

// FIC: Strip scripts/styles/tags and collapse whitespace, capped at maxChars.
// FIC: Elimina scripts/styles/etiquetas y colapsa espacios, acotado a maxChars.
export function extractRelevantContent(html: string, maxChars = 5000, symbol?: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const text = decodeEntities(withoutScripts.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  if (!symbol) return text.slice(0, maxChars);

  const relevant = extractTickerRelevantText(text, symbol, maxChars);
  return relevant || `No se encontro contenido dentro de la pagina que mencione directamente ${symbol.toUpperCase()}. Texto base: ${text.slice(0, Math.min(maxChars, 900))}`;
}

function extractTickerRelevantText(text: string, symbol: string, maxChars: number): string {
  const clean = normalizeWhitespace(text);
  const terms = tickerTerms(symbol);
  const chunks = clean
    .split(/(?<=[.!?])\s+|\s{2,}|\n+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= 40);
  const matches: string[] = [];

  chunks.forEach((chunk, index) => {
    if (!mentionsAny(chunk, terms)) return;
    const before = chunks[index - 1];
    const after = chunks[index + 1];
    if (before && !matches.includes(before)) matches.push(before);
    if (!matches.includes(chunk)) matches.push(chunk);
    if (after && !matches.includes(after)) matches.push(after);
  });

  const relevant = normalizeWhitespace(matches.join(" "));
  return relevant.slice(0, maxChars);
}

function tickerTerms(symbol: string): string[] {
  const safeSymbol = symbol.toUpperCase();
  return [safeSymbol, ...(SYMBOL_ALIASES[safeSymbol] ?? [])].map((term) => term.toLowerCase());
}

function mentionsAny(text: string, terms: string[]): boolean {
  const normalized = text.toLowerCase();
  return terms.some((term) => {
    if (term.length <= 5 && /^[a-z0-9.]+$/i.test(term)) {
      return new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(normalized);
    }
    return normalized.includes(term);
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
