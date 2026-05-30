// FIC: Sentiment analysis over news articles — Anthropic Claude with a deterministic CI fallback.
// FIC: Analisis de sentimiento sobre articulos de noticias — Claude Anthropic con respaldo determinista para CI.
//
// FIC: Sigue el patron de modules/indicators/llmAnthropic.ts: import perezoso de `@anthropic-ai/sdk`,
// FIC: reintentos exponenciales y degradacion al analizador determinista si la SDK/API no estan disponibles.

import { ANTHROPIC_MODEL_ID } from "../indicators/llmAnthropic";
import type { NewsArticle, SentimentLabel, SentimentResult } from "./types";

// FIC: Neutral interface so the concrete analyzer stays swappable (mirrors LlmExplainer).
// FIC: Interfaz neutral para que el analizador concreto sea intercambiable (refleja LlmExplainer).
export interface NewsSentimentAnalyzer {
  analyzeNewsSentiment(symbol: string, articles: NewsArticle[]): Promise<SentimentResult>;
}

// FIC: Maps a numeric score to a label using the doc thresholds (>0.3 bullish, <-0.3 bearish).
// FIC: Mapea un score numerico a una etiqueta con los umbrales del documento.
export function labelForScore(score: number): SentimentLabel {
  if (score > 0.3) return "BULLISH";
  if (score < -0.3) return "BEARISH";
  return "NEUTRAL";
}

// FIC: Bilingual lexicons for the deterministic fallback scorer.
// FIC: Lexicos bilingues para el analizador determinista de respaldo.
const BULLISH_TERMS = [
  "supera",
  "solid",
  "solidos",
  "fuerte",
  "impulsa",
  "eleva",
  "crece",
  "record",
  "beat",
  "growth",
  "surge",
  "upgrade",
  "rally"
];
const BEARISH_TERMS = [
  "presion",
  "cae",
  "caida",
  "perdida",
  "demanda revision",
  "reguladores",
  "investiga",
  "miss",
  "decline",
  "drop",
  "lawsuit",
  "downgrade",
  "warning"
];

// FIC: Deterministic, network-free analyzer used in tests and as graceful-degradation fallback.
// FIC: Analizador determinista, sin red, usado en tests y como respaldo de degradacion.
export class DeterministicNewsSentimentAnalyzer implements NewsSentimentAnalyzer {
  async analyzeNewsSentiment(symbol: string, articles: NewsArticle[]): Promise<SentimentResult> {
    if (articles.length === 0) {
      return {
        score: 0,
        label: "NEUTRAL",
        confidence: 0,
        reasoning: `No se encontraron noticias recientes para ${symbol}.`,
        keyFactors: [],
        degraded: true
      };
    }

    let pos = 0;
    let neg = 0;
    const factors = new Set<string>();
    for (const a of articles) {
      const text = `${a.headline} ${a.summary}`.toLowerCase();
      for (const term of BULLISH_TERMS) {
        if (text.includes(term)) {
          pos += 1;
          factors.add(a.headline);
        }
      }
      for (const term of BEARISH_TERMS) {
        if (text.includes(term)) {
          neg += 1;
          factors.add(a.headline);
        }
      }
    }

    const total = pos + neg;
    const score = total === 0 ? 0 : Number(((pos - neg) / total).toFixed(3));
    const confidence = Number(Math.min(1, total / Math.max(1, articles.length)).toFixed(3));
    const label = labelForScore(score);

    return {
      score,
      label,
      confidence,
      reasoning:
        `Analisis determinista de ${articles.length} titulares de ${symbol}: ` +
        `${pos} señales alcistas y ${neg} bajistas.`,
      keyFactors: Array.from(factors).slice(0, 3),
      degraded: true
    };
  }
}

export interface AnthropicSentimentOptions {
  apiKey?: string;
  model?: string;
  retries?: number;
  delay?: (ms: number) => Promise<void>;
  maxArticles?: number;
}

const defaultDelay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// FIC: Real analyzer backed by Anthropic. Falls back to the deterministic scorer on any failure.
// FIC: Analizador real respaldado por Anthropic. Cae al determinista ante cualquier fallo.
export class AnthropicNewsSentimentAnalyzer implements NewsSentimentAnalyzer {
  readonly model: string;
  private apiKey?: string;
  private retries: number;
  private delay: (ms: number) => Promise<void>;
  private maxArticles: number;
  private fallback = new DeterministicNewsSentimentAnalyzer();
  private clientPromise: Promise<any> | null = null;

  constructor(opts: AnthropicSentimentOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
    this.model = opts.model ?? ANTHROPIC_MODEL_ID;
    this.retries = opts.retries ?? 2;
    this.delay = opts.delay ?? defaultDelay;
    this.maxArticles = opts.maxArticles ?? 10;
  }

  private async getClient(): Promise<any | null> {
    if (!this.apiKey) return null;
    if (this.clientPromise) return this.clientPromise;
    this.clientPromise = (async () => {
      try {
        const mod = await import(/* @vite-ignore */ ("@anthropic-ai/sdk" as string)).catch(() => null);
        if (!mod) return null;
        const Anthropic = (mod as any).default ?? (mod as any).Anthropic;
        return new Anthropic({ apiKey: this.apiKey });
      } catch {
        return null;
      }
    })();
    return this.clientPromise;
  }

  async analyzeNewsSentiment(symbol: string, articles: NewsArticle[]): Promise<SentimentResult> {
    const client = await this.getClient();
    if (!client || articles.length === 0) {
      return this.fallback.analyzeNewsSentiment(symbol, articles);
    }

    const digest = articles
      .slice(0, this.maxArticles)
      .map((a, i) => `${i + 1}. [${a.source}] ${a.headline} — ${a.summary}`)
      .join("\n");

    const prompt = buildSentimentPrompt(symbol, digest);

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const resp = await client.messages.create({
          model: this.model,
          max_tokens: 512,
          system: [
            {
              type: "text",
              text:
                "Eres un analista financiero. Respondes UNICAMENTE con JSON valido. " +
                "No recomiendas ni ejecutas operaciones; solo evaluas el sentimiento de las noticias.",
              cache_control: { type: "ephemeral" }
            }
          ],
          messages: [{ role: "user", content: prompt }]
        });
        const text =
          (resp?.content?.[0]?.text as string | undefined) ??
          (typeof resp?.content === "string" ? resp.content : "") ??
          "";
        return parseSentimentJson(text, symbol);
      } catch (err) {
        lastError = err;
        if (attempt < this.retries) {
          await this.delay((attempt + 1) * 1000);
        }
      }
    }

    void lastError;
    return this.fallback.analyzeNewsSentiment(symbol, articles);
  }
}

// FIC: Builds the Spanish JSON-only prompt for sentiment scoring.
// FIC: Construye el prompt en español, solo-JSON, para el analisis de sentimiento.
export function buildSentimentPrompt(symbol: string, digest: string): string {
  return [
    `Eres un analista financiero experto. Analiza las siguientes noticias recientes sobre ${symbol}`,
    "y determina el sentimiento de inversion.",
    "",
    digest,
    "",
    "Responde UNICAMENTE con JSON:",
    '{ "score": <-1.0 a 1.0>, "label": "BULLISH|BEARISH|NEUTRAL", "confidence": <0.0 a 1.0>,',
    '  "reasoning": "<2-3 oraciones>", "keyFactors": ["factor1", "factor2", "factor3"] }'
  ].join("\n");
}

// FIC: Robust JSON extraction that strips markdown fences and clamps numeric ranges.
// FIC: Extraccion robusta de JSON que limpia cercas markdown y acota los rangos numericos.
export function parseSentimentJson(text: string, symbol: string): SentimentResult {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Respuesta del modelo sin JSON parseable para ${symbol}.`);
  }
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Partial<SentimentResult>;
  const score = clamp(Number(parsed.score ?? 0), -1, 1);
  const confidence = clamp(Number(parsed.confidence ?? 0), 0, 1);
  const label: SentimentLabel =
    parsed.label === "BULLISH" || parsed.label === "BEARISH" || parsed.label === "NEUTRAL"
      ? parsed.label
      : labelForScore(score);
  return {
    score: Number(score.toFixed(3)),
    label,
    confidence: Number(confidence.toFixed(3)),
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    keyFactors: Array.isArray(parsed.keyFactors) ? parsed.keyFactors.map(String).slice(0, 5) : []
  };
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

// FIC: Factory — deterministic in NODE_ENV=test or without an API key, Anthropic otherwise.
// FIC: Factory — determinista en NODE_ENV=test o sin API key, Anthropic en caso contrario.
export function createSentimentAnalyzerForRuntime(): NewsSentimentAnalyzer {
  if (process.env.NODE_ENV === "test" || !process.env.ANTHROPIC_API_KEY) {
    return new DeterministicNewsSentimentAnalyzer();
  }
  return new AnthropicNewsSentimentAnalyzer();
}
