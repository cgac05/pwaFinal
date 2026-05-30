// FIC: Custom URL analysis — fetches a news URL, extracts text, and scores its impact on an instrument.
// FIC: Analisis de URL personalizada — obtiene una URL, extrae texto y evalua su impacto en un instrumento.

import {
  createSentimentAnalyzerForRuntime,
  type NewsSentimentAnalyzer
} from "./sentimentService";
import { resolveVerdict } from "./investmentAdvisor";
import { NEWS_DISCLAIMER, type NewsArticle, type SourceAnalysisResult } from "./types";

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
        content: extractRelevantContent(html, this.maxChars),
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
}

// FIC: Extract <title> text from raw HTML.
// FIC: Extrae el texto de <title> del HTML crudo.
export function extractTitle(html: string): string {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? decodeEntities(m[1].trim()) : "";
}

// FIC: Strip scripts/styles/tags and collapse whitespace, capped at maxChars.
// FIC: Elimina scripts/styles/etiquetas y colapsa espacios, acotado a maxChars.
export function extractRelevantContent(html: string, maxChars = 5000): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const text = decodeEntities(withoutScripts.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, maxChars);
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

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
