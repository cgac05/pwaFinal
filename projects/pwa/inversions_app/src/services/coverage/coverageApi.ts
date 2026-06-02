// FIC: Coverage strategy API service — analyze, compare, simulate with retry and cache. (EN)
// FIC: Servicio API de estrategias de cobertura — analizar, comparar, simular con reintento y caché. (ES)

import { getAuthHeaders } from "../signals/signalApi";
import { getCached, setCache } from "../apiCache";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes / 5 minutos
const RETRY_DELAYS_MS = [1000, 2000]; // backoff: 1s then 2s / backoff: 1s luego 2s

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoverageRequestBody {
  ticker: string;
  currentPrice: number;
  shares?: number;
  capital?: number;
  riskTolerancePct?: number;
  putStrikePrice?: number;
  callStrikePrice?: number;
  iv?: number;
  dte?: number;
  // FIC: Real market premiums from option chain — overrides Black-Scholes estimation when set. (EN)
  // FIC: Primas reales de la cadena de opciones — sobrescribe la estimación Black-Scholes cuando se establecen. (ES)
  putPremium?: number;
  callPremium?: number;
  institutionalContext?: {
    direction: "bullish" | "bearish" | "lateral";
    continuityProbability: number;
    institutionalScore: number;
    hasNearExpiration: boolean;
  };
}

export interface CoverageStrategyResult {
  strategyId: string;
  kind: "protective_put" | "married_put" | "collar_put" | "covered_straddle";
  ticker: string;
  confidenceScore: number;
  confidenceLevel: "ALTA" | "MEDIA" | "BAJA";
  summary: {
    maxProfit: number | "∞";
    maxLoss: number;
    breakEvenPrice: number;
    stopLossPrice: number;
    netPremium: number;
    riskProfile: string;
  };
  alerts: Array<{ code: string; severity: string; message: string }>;
  payoffPoints: Array<{ underlyingPrice: number; pnl: number }>;
  generatedAt: string;
}

export interface CoverageAnalyzeResponse {
  results: CoverageStrategyResult[];
  generatedAt: string;
}

export interface CoverageComparisonResult {
  ticker: string;
  underlyingPrice: number;
  entries: Array<{
    kind: string;
    adapted: CoverageStrategyResult;
    score: number;
    rank: number;
  }>;
  winner: { kind: string; score: number; rank: number };
  generatedAt: string;
}

export interface CoverageSimulationResult {
  strategyResult: {
    kind: string;
    ticker: string;
    maxProfit: number;
    maxLoss: number;
    payoffPoints: Array<{ underlyingPrice: number; pnl: number }>;
  };
  monteCarlo: {
    iterations: number;
    meanPnl: number;
    medianPnl: number;
    p5Pnl: number;
    p95Pnl: number;
    probabilityOfProfit: number;
    skipped: boolean;
  };
  scenarios: Array<{ label: string; underlyingPrice: number; pnl: number }>;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// FIC: Fetch with automatic retry on 5xx/429 errors using exponential backoff. (EN)
// FIC: Fetch con reintentos automáticos en errores 5xx/429 usando backoff exponencial. (ES)
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  signal?: AbortSignal
): Promise<Response> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const res = await fetch(url, { ...options, signal });
    if (res.ok || res.status < 500) return res;
    if (attempt < RETRY_DELAYS_MS.length && !signal?.aborted) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
  return fetch(url, { ...options, signal }); // final attempt
}

// ─── API calls ────────────────────────────────────────────────────────────────

// FIC: POST /api/coverage/analyze — runs all 4 coverage strategies. (EN)
// FIC: POST /api/coverage/analyze — ejecuta las 4 estrategias de cobertura. (ES)
export async function postCoverageAnalyze(
  body: CoverageRequestBody,
  signal?: AbortSignal
): Promise<CoverageAnalyzeResponse> {
  const cacheKey = `coverage:analyze:${JSON.stringify(body)}`;
  const cached = getCached<CoverageAnalyzeResponse>(cacheKey);
  if (cached) return cached;

  const res = await fetchWithRetry(
    "/api/coverage/analyze",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(body),
    },
    signal
  );

  if (!res.ok) throw new Error(`Coverage analyze error: ${res.status}`);

  const data = (await res.json()) as CoverageAnalyzeResponse;
  if (!signal?.aborted) setCache(cacheKey, data, CACHE_TTL_MS);
  return data;
}

// FIC: POST /api/coverage/compare — ranks all 4 strategies. (EN)
// FIC: POST /api/coverage/compare — rankea las 4 estrategias. (ES)
export async function postCoverageCompare(
  body: CoverageRequestBody,
  signal?: AbortSignal
): Promise<CoverageComparisonResult> {
  const cacheKey = `coverage:compare:${JSON.stringify(body)}`;
  const cached = getCached<CoverageComparisonResult>(cacheKey);
  if (cached) return cached;

  const res = await fetchWithRetry(
    "/api/coverage/compare",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(body),
    },
    signal
  );

  if (!res.ok) throw new Error(`Coverage compare error: ${res.status}`);

  const data = (await res.json()) as CoverageComparisonResult;
  if (!signal?.aborted) setCache(cacheKey, data, CACHE_TTL_MS);
  return data;
}

// FIC: POST /api/coverage/simulate — Monte Carlo simulation for a protective_put. (EN)
// FIC: POST /api/coverage/simulate — simulación Monte Carlo para una protective_put. (ES)
export async function postCoverageSimulate(
  body: CoverageRequestBody,
  signal?: AbortSignal
): Promise<CoverageSimulationResult> {
  const res = await fetch("/api/coverage/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) throw new Error(`Coverage simulate error: ${res.status}`);
  return (await res.json()) as CoverageSimulationResult;
}
