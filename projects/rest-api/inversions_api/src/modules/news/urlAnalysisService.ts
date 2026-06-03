// FIC: Custom URL analysis — fetches a news URL, extracts text, and scores its impact on an instrument.
// FIC: Analisis de URL personalizada — obtiene una URL, extrae texto y evalua su impacto en un instrumento.

import {
  createSentimentAnalyzerForRuntime,
  type NewsSentimentAnalyzer
} from "./sentimentService";
import { resolveVerdict } from "./investmentAdvisor";
import { NEWS_DISCLAIMER, type AnalyzedNewsSource, type NewsArticle, type NewsSourceInput, type NewsVerdict, type SentimentResult, type SourceAnalysisResult } from "./types";

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

// Punto 2 — URLs de búsqueda específicas por dominio.
// En lugar de la página raíz (genérica), se busca el ticker/empresa directamente.
const SEARCH_TEMPLATES: Record<string, (company: string) => string> = {
  "nasdaq.com":        c => `https://www.nasdaq.com/search?q=${encodeURIComponent(c)}+stock+news`,
  "investing.com":     c => `https://www.investing.com/search/?q=${encodeURIComponent(c)}+stock`,
  "cnbc.com":          c => `https://www.cnbc.com/search/?query=${encodeURIComponent(c)}+stock+news`,
  "bloomberg.com":     c => `https://www.bloomberg.com/search?query=${encodeURIComponent(c)}+stock`,
  "reuters.com":       c => `https://www.reuters.com/search/news?blob=${encodeURIComponent(c)}+stock`,
  "marketwatch.com":   c => `https://www.marketwatch.com/search?q=${encodeURIComponent(c)}&ts=0&tab=All%20News`,
  "finance.yahoo.com": c => `https://finance.yahoo.com/quote/${encodeURIComponent(c)}/news/`,
  "seekingalpha.com":  c => `https://seekingalpha.com/search?q=${encodeURIComponent(c)}+stock`,
};

function buildSearchUrl(domain: string, company: string): string {
  const host = hostnameOf(domain.startsWith("http") ? domain : `https://${domain}`);
  const key  = Object.keys(SEARCH_TEMPLATES).find(k => host.includes(k));
  return key ? SEARCH_TEMPLATES[key](company) : (domain.startsWith("http") ? domain : `https://${domain}`);
}

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

  // FIC: Validate that a domain is reachable. Returns true if HTTP response is ok.
  // FIC: Valida que un dominio sea accesible. Devuelve true si la respuesta HTTP es ok.
  async validateURL(domain: string): Promise<boolean> {
    const fullUrl = domain.startsWith("http") ? domain : `https://${domain}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await this.fetchImpl(fullUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: controller.signal
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  // FIC: Analyze multiple source domains for a company and return a consolidated verdict.
  // FIC: Analiza multiples dominios de fuentes para una empresa y devuelve un veredicto consolidado.
  async analyzeSourcesForCompany(
    company: string,
    domains: string[]
  ): Promise<{
    url: string;
    company: string;
    verdict: string;
    score: number;
    confidence: number;
    reasoning: string;
    keyPoints: string[];
    timestamp: string;
  }> {
    const results: SourceAnalysisResult[] = [];

    for (const domain of domains) {
      // Punto 2 — usa URL de búsqueda específica al ticker, no la homepage genérica
      const searchUrl = buildSearchUrl(domain, company);
      try {
        const content = await this.fetchURLContent(searchUrl, company);
        const analysis = await this.analyzeSourceImpact(content, company);
        results.push(analysis);
      } catch {
        // FIC: Fuente inaccesible — se omite del consolidado sin lanzar error.
      }
    }

    const timestamp = new Date().toISOString();

    if (results.length === 0) {
      return {
        url: domains.join(", "),
        company: company.toUpperCase(),
        verdict: "HOLD",
        score: 0,
        confidence: 0,
        reasoning: `No fue posible obtener contenido de ninguna fuente para ${company}. Verifica que los dominios sean accesibles.`,
        keyPoints: [],
        timestamp
      };
    }

    const avgScore = Number(
      (results.reduce((s, r) => s + r.score, 0) / results.length).toFixed(3)
    );
    const avgConfidence = Number(
      (results.reduce((s, r) => s + r.confidence, 0) / results.length).toFixed(3)
    );
    const keyPoints = [...new Set(results.flatMap(r => r.keyPoints))].slice(0, 5);
    const sourcesLabel = results.map(r => hostnameOf(r.url)).join(", ");

    const aggregated: SentimentResult = {
      score: avgScore,
      label: avgScore > 0.3 ? "BULLISH" : avgScore < -0.3 ? "BEARISH" : "NEUTRAL",
      confidence: avgConfidence,
      reasoning: "",
      keyFactors: keyPoints
    };

    // Punto 3 — razonamiento transparente que explica el score al usuario
    const positiveResults = results.filter(r => r.score >  0.1);
    const negativeResults = results.filter(r => r.score < -0.1);
    const neutralResults  = results.filter(r => r.score >= -0.1 && r.score <= 0.1);
    const topReason = results.sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0]?.reasoning ?? "";

    const reasoningParts = [
      `Análisis de ${results.length} fuente(s) sobre ${company}: ` +
      `${positiveResults.length} alcista(s), ${negativeResults.length} bajista(s), ${neutralResults.length} neutral(es).`,
      positiveResults.length > 0
        ? `Señales positivas: ${positiveResults.map(r => hostnameOf(r.url)).join(", ")}.`
        : "",
      negativeResults.length > 0
        ? `Señales negativas: ${negativeResults.map(r => hostnameOf(r.url)).join(", ")}.`
        : "",
      topReason ? `Razonamiento principal: ${topReason}` : "",
    ].filter(Boolean).join(" ");

    return {
      url: domains.join(", "),
      company: company.toUpperCase(),
      verdict: resolveVerdict(aggregated),
      score: avgScore,
      confidence: avgConfidence,
      reasoning: reasoningParts,
      keyPoints,
      timestamp
    };
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

// FIC: Analyze a raw NewsSourceInput (from any provider) and return a scored AnalyzedNewsSource.
// FIC: Analiza un NewsSourceInput crudo (de cualquier proveedor) y devuelve un AnalyzedNewsSource puntuado.
export async function analyzeNewsSource(source: NewsSourceInput, symbol: string): Promise<AnalyzedNewsSource> {
  const analyzer = createSentimentAnalyzerForRuntime();
  const pseudoArticle: NewsArticle = {
    id: source.id,
    headline: source.title ?? "",
    summary: source.text ?? "",
    author: "",
    source: source.provider,
    url: source.url ?? "",
    symbols: [symbol.toUpperCase()],
    createdAt: source.publishedAt ?? new Date().toISOString()
  };

  const sentiment = await analyzer.analyzeNewsSentiment(symbol.toUpperCase(), [pseudoArticle]);
  const verdict: NewsVerdict = sentiment.score > 0.3 ? "BUY" : sentiment.score < -0.3 ? "SELL" : "HOLD";

  return {
    id: source.id,
    url: source.url,
    title: source.title ?? "",
    summary: source.text,
    rationale: sentiment.reasoning,
    verdict,
    sentimentScore: sentiment.score,
    confidence: sentiment.confidence,
    credibilityScore: sentiment.degraded ? 0.3 : 0.7,
    provider: source.provider,
    publishedAt: source.publishedAt ?? new Date().toISOString()
  };
}
