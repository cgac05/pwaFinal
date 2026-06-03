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
  confidenceScore?: number | null;
  credibilityScore?: number | null;
  relevanceReason?: string | null;
  source: string | null;
  url: string | null;
  publishedAt: string;
  archivedAt: string;
}


export interface NewsCanonicalObservation {
  objetivo: string;
  senal: string;
  explicacion: string;
  metricas: Record<string, number | string>;
}

export interface NewsCanonicalRow {
  core: "A_NOTICIAS";
  subCore?: string;
  tipoSenal: "CALL" | "PUT" | "HOLD";
  score: number;
  peso: number;
  observacion: NewsCanonicalObservation;
  canonicalOutput: string;
}

export interface NewsCanonicalPayload {
  version: "canonical-output-v1";
  core: "A_NOTICIAS";
  symbol: string;
  generatedAt: string;
  standard: string;
  aggregate: NewsCanonicalRow;
  rows: NewsCanonicalRow[];
  output: string;
  outputs: string[];
}

export interface RelevantNewsResponse {
  ticker: string;
  count: number;
  items: RelevantNewsItem[];
  source: string;
  fetchedAt: string;
  canonical?: NewsCanonicalPayload;
}


function canonicalOutputForRow(row: Omit<NewsCanonicalRow, "canonicalOutput">): NewsCanonicalRow {
  const signal = row.tipoSenal === "CALL" ? "bullish" : row.tipoSenal === "PUT" ? "bearish" : "neutral";
  const decision = row.tipoSenal === "CALL" ? "buy" : row.tipoSenal === "PUT" ? "sell" : "wait";
  const option = row.tipoSenal === "CALL" ? "call" : row.tipoSenal === "PUT" ? "put" : "n/a";
  const metrics = Object.entries(row.observacion.metricas)
    .map(([key, value], index) => `SEÑAL_${String(index + 1).padStart(2, "0")}=${row.core}/${row.subCore ?? "CANONICO"}|LECTURA=${String(value)}|IMPACTO=neutral|PESO=${row.peso.toFixed(3)}|JUSTIFICACIÓN=${key}: ${row.observacion.explicacion}`)
    .join("; ") || "n/a";
  const output = [
    `CORE=${row.core}/${row.subCore ?? "CANONICO"}`,
    `OBJETIVO=${row.observacion.objetivo}`,
    `SEÑAL=${signal}`,
    `DECISIÓN=${decision}`,
    `OPCIÓN=${option}`,
    `EXPLICACIÓN_TÉCNICA=${row.observacion.explicacion}`,
    `CONFLUENCIA=[${metrics}]`,
    `RIESGO=Riesgo moderado — validar noticias con fuente primaria`,
    `CONFIANZA=${Math.round(Math.abs(row.score) * 100)}`,
    `RESULTADO_FINAL=A_NOTICIAS emite señal ${signal} con score ${row.score.toFixed(3)}.`
  ].join(" || ");

  return { ...row, canonicalOutput: output };
}

function buildLocalCanonicalNews(ticker: string, items: RelevantNewsItem[], source = "frontend-fallback"): NewsCanonicalPayload {
  const symbol = ticker.toUpperCase();
  const rows = items.map((item, index) => {
    const confidence = typeof item.confidenceScore === "number" ? item.confidenceScore : (item.relevanceScore ?? 0.5);
    const credibility = typeof item.credibilityScore === "number" ? item.credibilityScore : 0.5;
    const peso = Number(Math.max(0, Math.min(1, confidence * credibility)).toFixed(3));
    const score = item.sentiment === "bullish" ? peso : item.sentiment === "bearish" ? -peso : 0;
    const tipoSenal = item.sentiment === "bullish" ? "CALL" : item.sentiment === "bearish" ? "PUT" : "HOLD";
    return canonicalOutputForRow({
      core: "A_NOTICIAS",
      subCore: `${item.source ?? "NEWS"}-${String(index + 1).padStart(2, "0")}`,
      tipoSenal,
      score: Number(score.toFixed(3)),
      peso,
      observacion: {
        objetivo: item.headline,
        senal: item.sentiment ?? "neutral",
        explicacion: item.summary ?? `Noticia de respaldo para ${symbol}.`,
        metricas: {
          SENTIMIENTO: Number(score.toFixed(3)),
          CONFIANZA: Number(confidence.toFixed(3)),
          CREDIBILIDAD: Number(credibility.toFixed(3)),
          PESO_CALCULADO: peso,
          CALCULO_PESO: item.relevanceReason ?? `confianza(${confidence.toFixed(3)}) x credibilidad(${credibility.toFixed(3)}) = ${peso.toFixed(3)}`,
          PROVEEDOR: item.source ?? source
        }
      }
    });
  });
  const avg = rows.length ? rows.reduce((sum, row) => sum + row.score, 0) / rows.length : 0;
  const tipoSenal = avg > 0.12 ? "CALL" : avg < -0.12 ? "PUT" : "HOLD";
  const aggregate = canonicalOutputForRow({
    core: "A_NOTICIAS",
    subCore: "CANONICO",
    tipoSenal,
    score: Number(avg.toFixed(3)),
    peso: rows.length ? Number((rows.reduce((sum, row) => sum + row.peso, 0) / rows.length).toFixed(3)) : 0,
    observacion: {
      objetivo: `${symbol} - observacion canonica de noticias`,
      senal: `${tipoSenal}; ${rows.length} noticia(s)`,
      explicacion: "Salida canonica generada en frontend como respaldo para mantener el contrato de A_NOTICIAS.",
      metricas: { SENTIMIENTO: Number(avg.toFixed(3)), VOLUMEN: rows.length, PROVEEDOR: source }
    }
  });

  return {
    version: "canonical-output-v1",
    core: "A_NOTICIAS",
    symbol,
    generatedAt: new Date().toISOString(),
    standard: "CORE || OBJETIVO || SEÑAL || DECISIÓN || OPCIÓN || EXPLICACIÓN_TÉCNICA || CONFLUENCIA || RIESGO || CONFIANZA || RESULTADO_FINAL",
    aggregate,
    rows,
    output: aggregate.canonicalOutput,
    outputs: [aggregate.canonicalOutput, ...rows.map((row) => row.canonicalOutput)]
  };
}

function buildFallbackNews(ticker: string): RelevantNewsResponse {
  const symbol = ticker.toUpperCase() || "SPY";
  const now = new Date().toISOString();

  return {
    ticker: symbol,
    count: 0,
    items: [],
    source: "unavailable-real-only",
    fetchedAt: now,
    canonical: {
      version: "canonical-output-v1",
      core: "A_NOTICIAS",
      symbol,
      generatedAt: now,
      standard: "CORE || OBJETIVO || SEÑAL || DECISIÓN || OPCIÓN || EXPLICACIÓN_TÉCNICA || CONFLUENCIA || RIESGO || CONFIANZA || RESULTADO_FINAL",
      aggregate: canonicalOutputForRow({
        core: "A_NOTICIAS",
        subCore: "CANONICO",
        tipoSenal: "HOLD",
        score: 0,
        peso: 0,
        observacion: {
          objetivo: `${symbol} - noticias reales no disponibles`,
          senal: "neutral; sin evidencia real visible en este momento",
          explicacion: "A_NOTICIAS no mostro datos ficticios. El proveedor real no entrego noticias o el backend no respondio.",
          metricas: { SENTIMIENTO: 0, VOLUMEN: 0, PROVEEDOR: "real-only" }
        }
      }),
      rows: [],
      output: "CORE=A_NOTICIAS/CANONICO || OBJETIVO=sin datos reales || SEÑAL=neutral || DECISIÓN=wait || OPCIÓN=n/a || EXPLICACIÓN_TÉCNICA=A_NOTICIAS no mostro datos ficticios. || CONFLUENCIA=[] || RIESGO=Sin evidencia real disponible || CONFIANZA=0 || RESULTADO_FINAL=No hay noticias reales para analizar.",
      outputs: []
    }
  };
}

export async function getRelevantNews(
  ticker: string,
  limit = 5,
  signal?: AbortSignal,
  dateRange?: NewsDateRange
): Promise<RelevantNewsResponse> {
  const symbol = ticker.trim().toUpperCase();
  const cacheKey = `news:relevant:${symbol}:${limit}:${dateRange?.from ?? "all"}:${dateRange?.to ?? "all"}`;
  const cached = getCached<RelevantNewsResponse>(cacheKey);
  if (cached) return cached;

  if (!symbol) {
    return buildFallbackNews("SPY");
  }

  const params = new URLSearchParams({ ticker: symbol, limit: String(limit) });
  if (dateRange?.from) params.set("from", dateRange.from);
  if (dateRange?.to) params.set("to", dateRange.to);
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
  const normalized = data.items.length > 0 ? { ...data, canonical: data.canonical ?? buildLocalCanonicalNews(symbol, data.items, data.source) } : buildFallbackNews(symbol);
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
  canonicalRow?: NewsCanonicalRow;
  canonicalOutput?: string;
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
  canonical?: NewsCanonicalPayload;
}


export type NewsOptionRecommendation = "CALL" | "PUT" | "HOLD";

export interface NewsRecommendationSummary {
  symbol: string;
  recommendation: NewsOptionRecommendation;
  verdict: NewsVerdict;
  sentiment: NewsSentiment;
  confidence: number;
  score: number;
  summary: string;
  reasoning: string;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  keyDrivers: string[];
  topBullish: string[];
  topBearish: string[];
  topNeutral: string[];
  riskNote: string;
  strategyHint: string;
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
  canonical?: NewsCanonicalPayload;
  recommendationSummary?: NewsRecommendationSummary;
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

