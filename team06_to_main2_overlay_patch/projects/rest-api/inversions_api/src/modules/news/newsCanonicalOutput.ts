// FIC: Canonical output adapter for TEAM-06 news.
// FIC v15: agrega contexto completo usado por IA/NLP a la tabla canonica.
// FIC: confianza, credibilidad y peso se calculan y se exponen con formula auditable.

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

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function limitText(value: string | null | undefined, maxLength = 1400, fallback = "Sin contexto textual disponible."): string {
  const clean = normalizeText(value);
  if (!clean) return fallback;
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1).trim()}…` : clean;
}

function splitSentences(value: string): string[] {
  return normalizeText(value)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function formatContextDate(value: string | null | undefined): string {
  if (!value) return "fecha no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

function sentimentReadable(value: string | null | undefined): string {
  if (value === "positive" || value === "bullish") return "alcista/positiva";
  if (value === "negative" || value === "bearish") return "bajista/negativa";
  return "neutral";
}

function ensureFiveContextLines(lines: string[]): string {
  const cleanLines = lines
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .map((line) => (line.length > 340 ? `${line.slice(0, 337).trim()}…` : line));

  while (cleanLines.length < 5) {
    cleanLines.push("Lectura adicional: no se recibió más texto del proveedor; el motor conserva el análisis con los datos disponibles sin inventar información externa.");
  }

  return cleanLines.join("\n");
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

function compactMetricList(values: string[]): string {
  return values.map((value) => normalizeText(value)).filter(Boolean).join(", ") || "n/a";
}

function promptDigestFromArticle(symbol: string, article: AnalyzedNewsSource, provider: string): string {
  const title = limitText(article.title, 240, `${symbol} headline`);
  const summary = limitText(article.summary || article.rawText, 1200);
  return `Ticker analizado: ${symbol}\nFormato enviado al analizador: [${provider}] ${title} — ${summary}`;
}

function promptDigestFromRelevantItem(symbol: string, item: RelevantNewsLike, provider: string): string {
  const title = limitText(item.headline, 240, `${symbol} headline`);
  const summary = limitText(item.summary, 1200);
  return `Ticker analizado: ${symbol}\nFormato enviado al analizador: [${provider}] ${title} — ${summary}`;
}

function contextFromArticle(symbol: string, article: AnalyzedNewsSource, provider: string, confidence: number, credibility: number, peso: number): string {
  const title = limitText(article.title, 320, `${symbol} - noticia sin titulo`);
  const summary = normalizeText(article.summary);
  const rawText = normalizeText(article.rawText);
  const combined = summary && rawText && rawText !== summary ? `${summary} ${rawText}` : summary || rawText || title;
  const sentences = splitSentences(combined);
  const firstDetail = sentences[0] || combined || title;
  const secondDetail = sentences[1] || sentences[0] || combined || title;

  return ensureFiveContextLines([
    `Titular analizado: ${title}`,
    `Resumen/descripcion recibido por el motor: ${firstDetail}`,
    `Detalle contextual adicional del texto: ${secondDetail}`,
    `Lectura para ${symbol}: proveedor=${provider}, veredicto=${article.verdict}, sentimiento=${sentimentReadable(article.sentiment)} (${article.sentimentScore}).`,
    `Métricas derivadas del análisis: confianza=${confidence.toFixed(3)}, credibilidad=${credibility.toFixed(3)}, peso=${peso.toFixed(3)} y score=${round3(article.sentimentScore * credibility).toFixed(3)}.` ,
    `Fecha y evidencia: publicada el ${formatContextDate(article.publishedAt)}; fuente=${article.url ?? article.id}.`,
  ]);
}

function contextFromRelevantItem(symbol: string, item: RelevantNewsLike, provider: string, tipoSenal: string, confidence: number, credibility: number, peso: number): string {
  const title = limitText(item.headline, 320, `${symbol} - noticia sin titulo`);
  const summary = limitText(item.summary, 1400, title);
  const sentences = splitSentences(summary);
  const firstDetail = sentences[0] || summary;
  const secondDetail = sentences[1] || sentences[0] || summary;

  return ensureFiveContextLines([
    `Titular analizado: ${title}`,
    `Resumen/descripcion recibido por el motor: ${firstDetail}`,
    `Detalle contextual adicional del texto: ${secondDetail}`,
    `Lectura para ${symbol}: proveedor=${provider}, señal canónica=${tipoSenal}, sentimiento=${item.sentiment ?? "neutral"}.`,
    `Métricas derivadas del análisis: confianza=${confidence.toFixed(3)}, credibilidad=${credibility.toFixed(3)} y peso=${peso.toFixed(3)}.` ,
    `Fecha y evidencia: publicada el ${formatContextDate(item.publishedAt)}; fuente=${item.url ?? item.id}.`,
  ]);
}

function analyzedIaContextFromArticle(symbol: string, article: AnalyzedNewsSource, provider: string, confidence: number, credibility: number, peso: number, score: number): string {
  const title = limitText(article.title, 320, `${symbol} - noticia sin titulo`);
  const summary = limitText(article.summary, 1400);
  const rawText = limitText(article.rawText, 1800);
  const promptDigest = promptDigestFromArticle(symbol, article, provider);
  const keywords = compactMetricList(article.keywords ?? []);
  const affectedSymbols = compactMetricList(article.affectedSymbols ?? []);

  return [
    "CONTEXTO COMPLETO USADO POR IA/NLP PARA BUY/SELL/HOLD",
    `1) Ticker objetivo: ${symbol}`,
    `2) Proveedor/fuente: ${provider}`,
    `3) Titular enviado al analizador: ${title}`,
    `4) Resumen/descripcion enviado al analizador: ${summary}`,
    `5) Texto crudo disponible para el análisis: ${rawText}`,
    `6) Prompt/digest interno del analizador: ${promptDigest}`,
    `7) Fecha de publicación: ${formatContextDate(article.publishedAt)}`,
    `8) URL/evidencia: ${article.url ?? article.id}`,
    `9) Símbolos afectados detectados: ${affectedSymbols}`,
    `10) Palabras clave detectadas: ${keywords}`,
    `11) Salida del analizador: veredicto=${article.verdict}, sentimiento=${article.sentiment}, sentimentScore=${article.sentimentScore}, confidence=${confidence.toFixed(3)}.` ,
    `12) Cálculo posterior del backend: score=${score.toFixed(3)}, credibilidad=${credibility.toFixed(3)}, peso=${peso.toFixed(3)} (${formula(confidence, credibility, peso)}).`,
    `13) Razonamiento devuelto por el analizador: ${limitText(article.rationale, 1000)}`,
  ].join("\n");
}

function analyzedIaContextFromRelevantItem(symbol: string, item: RelevantNewsLike, provider: string, tipoSenal: string, confidence: number, credibility: number, peso: number, score: number): string {
  const title = limitText(item.headline, 320, `${symbol} - noticia sin titulo`);
  const summary = limitText(item.summary, 1600);
  const promptDigest = promptDigestFromRelevantItem(symbol, item, provider);

  return [
    "CONTEXTO COMPLETO USADO POR IA/NLP PARA BUY/SELL/HOLD",
    `1) Ticker objetivo: ${symbol}`,
    `2) Proveedor/fuente: ${provider}`,
    `3) Titular enviado al analizador: ${title}`,
    `4) Resumen/descripcion enviado al analizador: ${summary}`,
    `5) Prompt/digest interno del analizador: ${promptDigest}`,
    `6) Fecha de publicación: ${formatContextDate(item.publishedAt)}`,
    `7) URL/evidencia: ${item.url ?? item.id}`,
    `8) Salida normalizada: tipoSenal=${tipoSenal}, sentimiento=${item.sentiment ?? "neutral"}, score=${score.toFixed(3)}, confidence=${confidence.toFixed(3)}.` ,
    `9) Cálculo posterior del backend: credibilidad=${credibility.toFixed(3)}, peso=${peso.toFixed(3)} (${formula(confidence, credibility, peso)}).`,
    `10) Razonamiento/relevancia: ${limitText(item.relevanceReason, 1000)}`,
  ].join("\n");
}

function newsExplanation(params: {
  symbol: string;
  provider: string;
  context: string;
  iaContext: string;
  rationale?: string | null;
  verdictLabel: string;
  sentimentLabel: string;
  confidence: number;
  credibility: number;
  peso: number;
}): string {
  const calculation = `Calculo A_NOTICIAS: confianza_sentimiento(${params.confidence.toFixed(3)}) x credibilidad_fuente(${params.credibility.toFixed(3)}) = peso(${params.peso.toFixed(3)}).`;
  const rationale = limitText(params.rationale, 720);
  const hasCalculation = /calculo a_noticias|cálculo a_noticias|confianza_sentimiento/i.test(rationale);
  return [
    "Contexto de la noticia:",
    params.context,
    "",
    "Texto/contexto que alimenta el análisis BUY/SELL/HOLD:",
    params.iaContext,
    "",
    `Lectura para ${params.symbol}: proveedor=${params.provider}, veredicto=${params.verdictLabel}, sentimiento=${params.sentimentLabel}.`,
    rationale && rationale !== "Sin contexto textual disponible." ? `Razonamiento: ${rationale}` : "",
    hasCalculation ? "" : calculation,
  ].filter((part) => part !== "").join("\n");
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
  const contextoNoticia = contextFromArticle(symbol, article, provider, confidence, credibility, peso);
  const contextoAnalizadoIa = analyzedIaContextFromArticle(symbol, article, provider, confidence, credibility, peso, score);
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
      explicacion: newsExplanation({
        symbol,
        provider,
        context: contextoNoticia,
        iaContext: contextoAnalizadoIa,
        rationale: article.rationale,
        verdictLabel: article.verdict,
        sentimentLabel: article.sentiment,
        confidence,
        credibility,
        peso,
      }),
      metricas: {
        TICKER: symbol,
        TITULAR: article.title || `${symbol} - noticia sin titulo`,
        RESUMEN_NOTICIA: contextoNoticia,
        CONTEXTO_NOTICIA: contextoNoticia,
        CONTEXTO_ANALIZADO_IA: contextoAnalizadoIa,
        TEXTO_ANALIZADO_IA: textoAnalizadoIa || contextoAnalizadoIa,
        RAW_TEXT_NOTICIA: limitText(article.rawText, 1800),
        PROMPT_RESUMEN_IA: promptDigestFromArticle(symbol, article, provider),
        RAZONAMIENTO_IA: limitText(article.rationale, 1000),
        VEREDICTO: article.verdict,
        SENTIMIENTO: article.sentimentScore,
        CONFIANZA: confidence,
        CREDIBILIDAD: credibility,
        PESO_CALCULADO: peso,
        CALCULO_PESO: formula(confidence, credibility, peso),
        PROVEEDOR: provider,
        FECHA_NOTICIA: article.publishedAt,
        SIMBOLOS_AFECTADOS: compactMetricList(article.affectedSymbols ?? []),
        PALABRAS_CLAVE: compactMetricList(article.keywords ?? []),
        FUENTE_URL: article.url ?? article.id,
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
  const contextoNoticia = contextFromRelevantItem(symbol, item, provider, tipoSenal, confidence, credibility, peso);
  const contextoAnalizadoIa = analyzedIaContextFromRelevantItem(symbol, item, provider, tipoSenal, confidence, credibility, peso, score);
  const textoAnalizadoIa = `${item.headline || ""} ${item.summary || ""}`.replace(/\s+/g, " ").trim();

  return canonicalize({
    core: "A_NOTICIAS",
    subCore: `${provider.toUpperCase()}-${String(index + 1).padStart(2, "0")}`,
    tipoSenal,
    score,
    peso,
    observacion: {
      objetivo: item.headline || `${symbol} - noticia sin titulo`,
      senal: item.sentiment ?? "neutral",
      explicacion: newsExplanation({
        symbol,
        provider,
        context: contextoNoticia,
        iaContext: contextoAnalizadoIa,
        rationale: item.relevanceReason,
        verdictLabel: tipoSenal,
        sentimentLabel: item.sentiment ?? "neutral",
        confidence,
        credibility,
        peso,
      }),
      metricas: {
        TICKER: symbol,
        TITULAR: item.headline || `${symbol} - noticia sin titulo`,
        RESUMEN_NOTICIA: contextoNoticia,
        CONTEXTO_NOTICIA: contextoNoticia,
        CONTEXTO_ANALIZADO_IA: contextoAnalizadoIa,
        TEXTO_ANALIZADO_IA: textoAnalizadoIa || contextoAnalizadoIa,
        PROMPT_RESUMEN_IA: promptDigestFromRelevantItem(symbol, item, provider),
        RAZONAMIENTO_IA: limitText(item.relevanceReason, 1000),
        VEREDICTO: tipoSenal,
        SENTIMIENTO: score,
        CONFIANZA: confidence,
        CREDIBILIDAD: credibility,
        PESO_CALCULADO: peso,
        CALCULO_PESO: item.relevanceReason || formula(confidence, credibility, peso),
        PROVEEDOR: provider,
        FECHA_NOTICIA: item.publishedAt,
        FUENTE_URL: item.url ?? item.id,
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
          ? `A_NOTICIAS evaluo ${rows.length} noticia(s) reales. Cada fila conserva el contexto textual usado para BUY/SELL/HOLD, junto con confianza, credibilidad y peso.`
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
