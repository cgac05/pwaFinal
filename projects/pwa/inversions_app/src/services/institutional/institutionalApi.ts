// FIC: Institutional analysis API service — wraps /api/institutional endpoints with cache and AbortSignal. (EN)
// FIC: Servicio API de análisis institucional — envuelve endpoints /api/institutional con caché y AbortSignal. (ES)

import { getAuthHeaders } from "../signals/signalApi";
import { getCached, setCache } from "../apiCache";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes / 5 minutos

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InstitutionalZone {
  price: number;
  type: "support" | "resistance";
  strength: number;
  confidence: number;
  volumeCluster: number;
  touches: number;
  liquidity: "low" | "medium" | "high";
}

export interface InstitutionalZonesData {
  all: InstitutionalZone[];
  support: InstitutionalZone[];
  resistance: InstitutionalZone[];
  candlesAnalyzed: number;
  institutionalScore: number;
  atr: number;
}

export interface InstitutionalTrendsData {
  direction: "bullish" | "bearish" | "neutral";
  sma50: number;
  sma200: number;
  crossover: { type: "golden" | "death"; daysAgo: number } | null;
  trendStrength: number;
  continuityProbability: number;
  volumeCorrelation: number;
  institutionalScore: number;
  candlesAnalyzed: number;
}

export interface ExpirationData {
  events: Array<{ date: string; type: string; label: string; significance: number; daysToExpiry?: number }>;
  currentRegime: "at_expiration" | "near" | "far";
  expiryBias: "bullish" | "bearish" | "neutral";
  callPutSkew: "call_skew" | "put_skew" | "symmetric";
  daysToNextOpex: number;
  theta: number;
  gamma: number;
}

export interface SourceReport {
  sourceId: string;
  status: "ok" | "partial" | "failed";
  confidence: number;
  asOf?: string;
}

export interface InstitutionalAnalysisResponse {
  request: { ticker: string; period: string; horizon: string; analysisId: string };
  analysis: { overallStatus: "ok" | "partial" | "all_failed"; usedSourceIds: string[]; cacheHit: boolean; resolvedAt: string };
  zones: InstitutionalZonesData | null;
  trends: InstitutionalTrendsData | null;
  expiration: ExpirationData | null;
  metrics: {
    ticker: string;
    volume: number;
    openPositionsCount: number;
    openPositionsNotional?: number;
    inflows: number;
    outflows: number;
    netFlow: number;
    fundsOwnershipPct: number;
    liquidity: "low" | "medium" | "high";
  };
  sourceReports: SourceReport[];
}

export interface Position13F {
  sourceId: string;
  asOf: string;
  count: number;
  notional: number;
  ownership: number;
  confidence: number;
}

export interface RegulatoryPositionsResponse {
  ticker: string;
  positions13F: Position13F[];
  flows: { inflows: number; outflows: number; netFlow: number };
  sourceReports: SourceReport[];
  cacheHit: boolean;
  usedSourceIds: string[];
  resolvedAt: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

// FIC: GET /api/institutional/analysis with cache-before-fetch and AbortSignal support. (EN)
// FIC: GET /api/institutional/analysis con caché-before-fetch y soporte de AbortSignal. (ES)
export async function getInstitutionalAnalysis(
  ticker: string,
  period = "daily",
  horizon = "medium",
  signal?: AbortSignal
): Promise<InstitutionalAnalysisResponse> {
  const cacheKey = `institutional:analysis:${ticker}:${period}:${horizon}`;
  const cached = getCached<InstitutionalAnalysisResponse>(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({ ticker, period, horizon });
  const res = await fetch(`/api/institutional/analysis?${params}`, {
    headers: { ...getAuthHeaders() },
    signal,
  });

  if (!res.ok) throw new Error(`Institutional analysis error: ${res.status}`);

  const data = (await res.json()) as InstitutionalAnalysisResponse;
  setCache(cacheKey, data, CACHE_TTL_MS);
  return data;
}

// FIC: GET /api/institutional/positions with cache-before-fetch and AbortSignal support. (EN)
// FIC: GET /api/institutional/positions con caché-before-fetch y soporte de AbortSignal. (ES)
export async function getRegulatoryPositions(
  ticker: string,
  period = "daily",
  horizon = "medium",
  signal?: AbortSignal
): Promise<RegulatoryPositionsResponse> {
  const cacheKey = `institutional:positions:${ticker}:${period}:${horizon}`;
  const cached = getCached<RegulatoryPositionsResponse>(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({ ticker, period, horizon });
  const res = await fetch(`/api/institutional/positions?${params}`, {
    headers: { ...getAuthHeaders() },
    signal,
  });

  if (!res.ok) throw new Error(`Regulatory positions error: ${res.status}`);

  const data = (await res.json()) as RegulatoryPositionsResponse;
  setCache(cacheKey, data, CACHE_TTL_MS);
  return data;
}
