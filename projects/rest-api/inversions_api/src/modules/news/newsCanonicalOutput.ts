// FIC: Canonical output adapter for TEAM-06 news.
// FIC v13: confianza, credibilidad y peso ya no salen como constantes visuales.
// Se calculan y se exponen con formula auditable en metricas.

import { buildCanonicalOutputString, type CanonicalOutputRow } from "@inversions/utils";
import type {
  AnalyzedNewsSource,
  NewsCanonicalPayload,
  NewsCanonicalRow,
  NewsVerdict
} from "./types";

export interface RelevantNewsLike {
  id: string;
  symbol: string | null;
  headline: string;
  summary: string | null;
  sentiment: "bullish" | "bearish" | "neutral" | null;
  relevanceScore: number | null;
  confidenceScore?: number | null;
  credibilityScore?: number | null;
  relevanceReason?: string | null;
  source: string | null;
  url: string | null;
  publishedAt: string;
}

const CANONICAL_STANDARD =
  "CORE || OBJETIVO || SEÑAL || DECISIÓN || OPCIÓN || EXPLICACIÓN_TÉCNICA || CONFLUENCIA || RIESGO || CONFIANZA || RESULTADO_FINAL";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? clamp(numeric, 0, 1) : fallback;
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

function tipoSenalFromVerdict(verdict: NewsVerdict): "CALL" | "PUT" | "HOLD" {
  if (verdict === "BUY") return "CALL";
  if (verdict === "SELL") return "PUT";
  return "HOLD";
}

function tipoSenalFromRelevantSentiment(sentiment: RelevantNewsLike["sentiment"]): "CALL" | "PUT" | "HOLD" {
  if (sentiment === "bullish") return "CALL";
  if (sentiment === "bearish") return "PUT";
  return "HOLD";
}

function directionFromSentiment(sentiment: RelevantNewsLike["sentiment"]): number {
  if (sentiment === "bullish") return 1;
  if (sentiment === "bearish") return -1;
  return 0;
}

function aggregateTipoSenal(score: number): "CALL" | "PUT" | "HOLD" {
  if (score > 0.12) return "CALL";
  if (score < -0.12) return "PUT";
  return "HOLD";
}

function canonicalize(row: Omit<NewsCanonicalRow, "canonicalOutput">): NewsCanonicalRow {
  const canonicalOutput = buildCanonicalOutputString(row as CanonicalOutputRow);
  return { ...row, canonicalOutput };
}

function providerLabel(provider: string | null | undefined): string {
  return provider?.trim() || "news-provider";
}

function calculatePeso(confidence: number, credibility: number): number {
  return round3(clamp01(confidence) * clamp01(credibility));
}

function formula(confidence: number, credibility: number, peso: number): string {
  return `peso=${confidence.toFixed(3)}*${credibility.toFixed(3)}=${peso.toFixed(3)}`;
}

function compactText(value: string | null | undefined, max = 1400): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "Sin resumen disponible.";
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function buildAnalyzedNewsSummary(symbol: string, article: AnalyzedNewsSource): string {
  const title = compactText(article.title, 220);
  const summary = compactText(article.summary || article.rawText, 900);
  const rawPreview = compactText(article.rawText, 900);
  const context = summary && summary !== "Sin resumen disponible." ? summary : rawPreview;

  return [
    `Titular: ${title}`,
    `Resumen enviado al analizador: ${context}`,
    `Lectura para ${symbol}: proveedor=${providerLabel(article.provider)}, veredicto=${article.verdict}, sentimiento=${article.sentiment}.`,
    `Métricas de lectura: sentimiento=${article.sentimentScore}, confianza=${round3(clamp01(article.confidence))}, credibilidad=${round3(clamp01(article.credibilityScore, sourceCredibilityFallback(article.provider, article.url)))}.`,
    `Fecha y evidencia: ${article.publishedAt || "sin fecha"}; fuente=${article.url || article.id}.`
  ].join("\n");
}


function sourceCredibilityFallback(provider: string | null | undefined, url?: string | null): number {
  const clean = `${provider ?? ""} ${url ?? ""}`.toLowerCase();
  let score = 0.48;
  if (/reuters|bloomberg|wsj|sec\.gov/.test(clean)) score += 0.32;
  else if (/yahoo|finnhub|polygon|alphavantage|alpha vantage|newsapi|marketwatch|cnbc|nasdaq/.test(clean)) score += 0.25;
  else if (/stocktwits|seekingalpha|benzinga/.test(clean)) score += 0.16;
  if ((url ?? "").startsWith("https://")) score += 0.07;
  return round3(clamp(score, 0.18, 0.98));
}

export function buildCanonicalRowFromAnalyzedSource(
  symbol: string,
  article: AnalyzedNewsSource,
  index = 0,
): NewsCanonicalRow {
  const tipoSenal = tipoSenalFromVerdict(article.verdict);
  const confidence = round3(clamp01(article.confidence, 0));
  const credibility = round3(clamp01(article.credibilityScore, sourceCredibilityFallback(article.provider, article.url)));
  const peso = calculatePeso(confidence, credibility);
  const score = round3(clamp(article.sentimentScore * credibility, -1, 1));
  const provider = providerLabel(article.provider);
  const resumenNoticia = buildAnalyzedNewsSummary(symbol, article);
  const textoAnalizadoIa = `${article.title || ""} ${article.rawText || article.summary || ""}`.replace(/\s+/g, " ").trim();

  return canonicalize({
    core: "A_NOTICIAS",
    subCore: `${provider.toUpperCase()}-${String(index + 1).padStart(2, "0")}`,
    tipoSenal,
    score,
    peso,
    observacion: {
      objetivo: article.title || `${symbol} - noticia sin titulo`,
      senal: `${article.verdict} / ${article.sentiment}`,
      explicacion:
        `Resumen de la noticia usado para BUY/SELL/HOLD:\n${resumenNoticia}\n\nRazonamiento: ${
          article.rationale ||
          article.summary ||
          `Noticia evaluada por A_NOTICIAS para ${symbol} con score ${score}.`
        }`,
      metricas: {
        TICKER: symbol,
        TITULAR: article.title || `${symbol} - noticia sin titulo`,
        RESUMEN_NOTICIA: resumenNoticia,
        TEXTO_ANALIZADO_IA: textoAnalizadoIa,
        SENTIMIENTO: article.sentimentScore,
        CONFIANZA: confidence,
        CREDIBILIDAD: credibility,
        PESO_CALCULADO: peso,
        CALCULO_PESO: formula(confidence, credibility, peso),
        PROVEEDOR: provider,
        FECHA_NOTICIA: article.publishedAt,
        FUENTE_URL: article.url || article.id,
      },
    },
  });
}

export function attachNewsCanonicalToSource(symbol: string, article: AnalyzedNewsSource, index = 0): AnalyzedNewsSource {
  const canonicalRow = buildCanonicalRowFromAnalyzedSource(symbol, article, index);
  return {
    ...article,
    canonicalRow,
    canonicalOutput: canonicalRow.canonicalOutput,
  };
}

export function attachNewsCanonicalToSources(symbol: string, articles: AnalyzedNewsSource[]): AnalyzedNewsSource[] {
  return articles.map((article, index) => attachNewsCanonicalToSource(symbol, article, index));
}

export function buildCanonicalRowFromRelevantItem(symbol: string, item: RelevantNewsLike, index = 0): NewsCanonicalRow {
  const tipoSenal = tipoSenalFromRelevantSentiment(item.sentiment);
  const provider = providerLabel(item.source);
  const credibility = round3(clamp01(item.credibilityScore, sourceCredibilityFallback(item.source, item.url)));
  const confidenceFallback = typeof item.relevanceScore === "number" && credibility > 0
    ? clamp(item.relevanceScore / credibility, 0, 1)
    : 0.35;
  const confidence = round3(clamp01(item.confidenceScore, confidenceFallback));
  const peso = calculatePeso(confidence, credibility);
  const score = round3(directionFromSentiment(item.sentiment) * peso);

  return canonicalize({
    core: "A_NOTICIAS",
    subCore: `${provider.toUpperCase()}-${String(index + 1).padStart(2, "0")}`,
    tipoSenal,
    score,
    peso,
    observacion: {
      objetivo: item.headline || `${symbol} - noticia sin titulo`,
      senal: item.sentiment ?? "neutral",
      explicacion:
        item.summary ||
        `Titular relevante para ${symbol}; se normaliza al formato canonico A_NOTICIAS.`,
      metricas: {
        SENTIMIENTO: score,
        CONFIANZA: confidence,
        CREDIBILIDAD: credibility,
        PESO_CALCULADO: peso,
        CALCULO_PESO: item.relevanceReason || formula(confidence, credibility, peso),
        PROVEEDOR: provider,
      },
    },
  });
}

export function buildNewsCanonicalPayloadFromRows(
  symbol: string,
  rows: NewsCanonicalRow[],
  generatedAt = new Date().toISOString(),
  source = "news-core",
): NewsCanonicalPayload {
  const totalWeight = rows.reduce((sum, row) => sum + Math.max(0, row.peso), 0);
  const aggregateScore = totalWeight > 0
    ? round3(clamp(rows.reduce((sum, row) => sum + row.score * Math.max(0, row.peso), 0) / totalWeight, -1, 1))
    : 0;
  const aggregateWeight = rows.length > 0
    ? round3(clamp(rows.reduce((sum, row) => sum + row.peso, 0) / rows.length, 0, 1))
    : 0;
  const callCount = rows.filter((row) => row.tipoSenal === "CALL").length;
  const putCount = rows.filter((row) => row.tipoSenal === "PUT").length;
  const holdCount = rows.filter((row) => row.tipoSenal === "HOLD").length;
  const tipoSenal = aggregateTipoSenal(aggregateScore);
  const signalText = tipoSenal === "CALL" ? "bullish" : tipoSenal === "PUT" ? "bearish" : "neutral";

  const aggregate = canonicalize({
    core: "A_NOTICIAS",
    subCore: "CANONICO",
    tipoSenal,
    score: aggregateScore,
    peso: aggregateWeight,
    observacion: {
      objetivo: `${symbol} - observacion canonica de noticias`,
      senal: `${signalText}; ${callCount} CALL, ${putCount} PUT, ${holdCount} HOLD`,
      explicacion:
        rows.length > 0
          ? `A_NOTICIAS evaluo ${rows.length} noticia(s) reales, calculo confianza x credibilidad y lo normalizo al formato canonico.`
          : `A_NOTICIAS no encontro noticias suficientes; se emite salida canonica neutral/degradada para que el core de IA pueda analizarla.`,
      metricas: {
        SENTIMIENTO: aggregateScore,
        CONFIANZA_PROMEDIO: aggregateWeight,
        VOLUMEN: rows.length,
        PROVEEDOR: source,
      },
    },
  });

  return {
    version: "canonical-output-v1",
    core: "A_NOTICIAS",
    symbol,
    generatedAt,
    standard: CANONICAL_STANDARD,
    aggregate,
    rows,
    output: aggregate.canonicalOutput,
    outputs: [aggregate.canonicalOutput, ...rows.map((row) => row.canonicalOutput)],
  };
}

export function buildNewsCanonicalPayloadFromSources(
  symbol: string,
  articles: AnalyzedNewsSource[],
  generatedAt = new Date().toISOString(),
  source = "news-confluence",
): NewsCanonicalPayload {
  const rows = attachNewsCanonicalToSources(symbol, articles).map((article) => article.canonicalRow).filter(Boolean) as NewsCanonicalRow[];
  return buildNewsCanonicalPayloadFromRows(symbol, rows, generatedAt, source);
}

export function buildNewsCanonicalPayloadFromRelevantItems(
  symbol: string,
  items: RelevantNewsLike[],
  source = "news-relevant",
  generatedAt = new Date().toISOString(),
): NewsCanonicalPayload {
  const rows = items.map((item, index) => buildCanonicalRowFromRelevantItem(symbol, item, index));
  return buildNewsCanonicalPayloadFromRows(symbol, rows, generatedAt, source);
}
