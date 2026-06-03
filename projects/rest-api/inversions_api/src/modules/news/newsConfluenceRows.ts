import {
  ALGORITHM_VERSION,
  type ConfluenceSignalRow,
  type EstadoSenal,
  type Timeframe,
  type TipoSenal,
  type Tendencia
} from "../indicators/types";
import { evaluateNewsImpact } from "./newsImpactEngine";
import type { AnalyzedNewsSource, NewsImpactResponse, NewsVerdict } from "./types";

interface BuildNewsRowsInput {
  ticket: string;
  timeframe: Timeframe;
  precio: number;
  sourceInputHash: string;
  previousRows?: ConfluenceSignalRow[];
  now?: Date;
  limit?: number;
  from?: string;
  to?: string;
}

const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400
};

function vigenciaIso(now: Date, timeframe: Timeframe): string {
  const seconds = TIMEFRAME_SECONDS[timeframe] * 5;
  return new Date(now.getTime() + seconds * 1000).toISOString();
}

function tipoSenalFromVerdict(verdict: NewsVerdict): TipoSenal {
  if (verdict === "BUY") return "CALL";
  if (verdict === "SELL") return "PUT";
  return "HOLD";
}

function tendenciaFromScore(score: number): Tendencia {
  if (score > 0.12) return "ALCISTA";
  if (score < -0.12) return "BAJISTA";
  return "LATERAL";
}

function estadoFromArticle(article: AnalyzedNewsSource): EstadoSenal {
  return article.credibilityScore > 0 ? "ACTIVA" : "DEGRADADA";
}

function publishedDate(article: AnalyzedNewsSource, fallback: Date): string {
  const date = new Date(article.publishedAt);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : fallback.toISOString().slice(0, 10);
}

function shortProvider(provider: string): string {
  const clean = provider.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (clean.includes("yahoo")) return "YAHOO";
  if (clean.includes("finnhub")) return "FINNHUB";
  if (clean.includes("newsapi")) return "NEWSAPI";
  if (clean.includes("polygon")) return "POLYGON";
  if (clean.includes("alpha")) return "ALPHA";
  return provider.slice(0, 10).toUpperCase() || "NEWS";
}

function deltaForArticle(
  previousRows: ConfluenceSignalRow[] | undefined,
  article: AnalyzedNewsSource,
  tipoSenal: TipoSenal
) {
  const prev = previousRows?.find((row) => row.core === "A_NOTICIAS" && row.evidencia_refs?.includes(article.url ?? article.id));
  if (!prev) return "NUEVA" as const;
  return prev.tipoSenal === tipoSenal ? "CONFIRMADA" as const : "INVERTIDA" as const;
}

function buildRowFromArticle(
  input: BuildNewsRowsInput,
  article: AnalyzedNewsSource,
  index: number,
  computedAt: Date,
  aggregate: NewsImpactResponse
): ConfluenceSignalRow {
  const canonicalRow = article.canonicalRow;
  const tipoSenal = canonicalRow?.tipoSenal ?? tipoSenalFromVerdict(article.verdict);
  const estado = estadoFromArticle(article);
  const direction = article.verdict === "BUY" ? 1 : article.verdict === "SELL" ? -1 : 0;
  const score = canonicalRow?.score ?? Number(Math.max(-1, Math.min(1, direction * article.confidence * article.credibilityScore)).toFixed(3));
  const peso = canonicalRow?.peso ?? Number(Math.max(0, Math.min(1, article.confidence * article.credibilityScore)).toFixed(3));
  const evidenceRef = article.url ?? `news:${article.id}`;
  const metricas = canonicalRow?.observacion.metricas ?? {
    SENTIMIENTO: score,
    CONFIANZA: article.confidence,
    CREDIBILIDAD: article.credibilityScore,
    PESO_CALCULADO: peso,
    CALCULO_PESO: `peso=${article.confidence.toFixed(3)}*${article.credibilityScore.toFixed(3)}=${peso.toFixed(3)}`,
    PROVEEDOR: article.provider
  };

  return {
    ticket: input.ticket,
    core: "A_NOTICIAS",
    subCore: `${shortProvider(article.provider)} · ${String(index + 1).padStart(2, "0")}`,
    precio: input.precio,
    tipoSenal,
    fecha: publishedDate(article, computedAt),
    timeframe: input.timeframe,
    tendencia: tendenciaFromScore(score),
    score,
    peso,
    invertir: estado === "ACTIVA" && tipoSenal !== "HOLD" && article.confidence >= 0.35,
    estado,
    vigencia: vigenciaIso(computedAt, input.timeframe),
    fuente: article.provider,
    evidencia_refs: [evidenceRef],
    ia_revisada: false,
    delta_vs_anterior: deltaForArticle(input.previousRows, article, tipoSenal),
    observacion: {
      objetivo: canonicalRow?.observacion.objetivo ?? article.title,
      senal: canonicalRow?.observacion.senal ?? (article.summary || `${article.verdict} convertido a ${tipoSenal} con confianza ${(article.confidence * 100).toFixed(0)}%.`),
      explicacion: canonicalRow?.observacion.explicacion ?? (article.rationale || `${article.verdict} convertido a ${tipoSenal} con confianza ${(article.confidence * 100).toFixed(0)}%.`),
      metricas
    },
    algorithm_version: ALGORITHM_VERSION,
    computed_at: computedAt.toISOString(),
    source_input_hash: `${input.sourceInputHash}:news:${article.id}`
  };
}

export async function buildNewsConfluenceRows(input: BuildNewsRowsInput): Promise<ConfluenceSignalRow[]> {
  const computedAt = input.now ?? new Date();
  const limit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 20)));
  let aggregate = await evaluateNewsImpact({
    symbol: input.ticket,
    limit,
    from: input.from,
    to: input.to,
    includeFallback: false
  });

  // Las APIs de noticias normalmente entregan informacion reciente, mientras que la
  // simulacion usa el rango de estrategia (por ejemplo hoy -> +30 dias). Si ese
  // rango deja fuera las noticias ya recibidas, reintentamos sin rango para que
  // A_NOTICIAS no vuelva al stub degradado cuando si hay evidencia real.
  if (aggregate.articles.length === 0 && (input.from || input.to)) {
    const relaxedAggregate = await evaluateNewsImpact({
      symbol: input.ticket,
      limit,
      includeFallback: false
    });
    if (relaxedAggregate.articles.length > 0) {
      aggregate = relaxedAggregate;
    }
  }

  return aggregate.articles.map((article, index) => buildRowFromArticle(input, article, index, computedAt, aggregate));
}
