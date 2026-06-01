// FIC: Fundamental analysis API service — wraps /api/team-03/fundamental and /api/team-03/options endpoints. (EN)
// FIC: Servicio API de análisis fundamental — envuelve endpoints /api/team-03/fundamental y /api/team-03/options. (ES)

import { getAuthHeaders } from "../signals/signalApi";
import { getCached, setCache } from "../apiCache";
import type { ConfluenceSignalRow } from "../signals/confluenceTableApi";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes / 5 minutos

// ─── Request types ────────────────────────────────────────────────────────────

export interface FundamentalAnalysisRequest {
  ticker: string;
  source?: string;
  investmentProfile?: string;
  horizon?: string;
  selectedMetrics?: string[];
  strategy?: string;
  comparisons?: string[];
  projectionFrom?: string;
  projectionTo?: string;
  currentPrice?: number;
}

export interface OptionsCalculateRequest {
  ticker: string;
  optionType: string;
  direction: string;
  strikePrice: number;
  expirationDate?: string;
  premium?: number;
  quantity?: number;
  currentPrice?: number;
  capitalAvailable?: number;
  riskTolerance?: string;
  daysToExpiration?: number;
  assumptions?: {
    impliedVolatility?: number;
    timeDecayModel?: "LINEAR" | "EXPONENTIAL";
    interestRate?: number;
  };
}

// ─── Response types ───────────────────────────────────────────────────────────

export interface PriceScenario {
  priceMovement: string;
  priceAtScenario: number;
  profitLoss: number;
  roi: number;
}

export interface ProjectionPoint {
  date: string;
  basePrice: number;
  bullishPrice: number;
  bearishPrice: number;
  basePnL: number;
  bullishPnL: number;
  bearishPnL: number;
}

export interface StrategyScenario {
  label: "ATM" | "+5%" | "-5%";
  price: number;
  profitLoss: number;
}

export interface FundamentalProjection {
  ticker: string;
  strategy: string;
  verdict: "VIABLE" | "MARGINAL" | "NO_VIABLE";
  score: number;
  projectionFrom: string;
  projectionTo: string;
  days: number;
  initialPrice: number;
  expectedMove: number;
  expectedMovePercent: number;
  strike: number;
  premium: number;
  breakeven: number;
  maxLoss: number | "ILIMITADO";
  maxProfit: number | "ILIMITADO";
  scenarios: StrategyScenario[];
  path: ProjectionPoint[];
  drivers: string[];
  changeTriggers: string[];
  calculationSteps: string[];
  disclaimer: string;
}

export interface OptionStrategyResult {
  ticker: string;
  optionType: string;
  direction: string;
  premium: number;
  quantity: number;
  breakEvenPrice: number;
  maxProfit: number | null;
  maxLoss: number | null;
  requiredMargin: number;
  scenarioAtm: PriceScenario;
  scenarioPlus5: PriceScenario;
  scenarioMinus5: PriceScenario;
  riskAdjustedReturn: number;
  probabilityItm: number;
  warnings: string[];
  calculatedAt: string;
  calculationVersion: string;
  assumptions: Record<string, unknown>;
}

export interface FundamentalData {
  price?: number;
  marketCap?: number;
  sector?: string;
  industry?: string;
  pe?: number;
  pb?: number;
  ps?: number;
  roe?: number;
  debtToEquity?: number;
  eps?: number;
  epsGrowth?: number;
  dividendYield?: number;
  volatility?: number;
  beta?: number;
  high52w?: number;
  low52w?: number;
  change52w?: number;
  revenue?: number;
  revenueGrowth?: number;
}

export interface FundamentalAnalysisResponse {
  ticker: string;
  companyName: string;
  sourceId: string;
  overallScore: number;
  verdict: string;
  recommendation: unknown;
  projection: FundamentalProjection;
  aiAnalysis: unknown;
  sections: unknown;
  confluenceRows: ConfluenceSignalRow[];
  fundamentalData: FundamentalData;
  timestamp: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

// FIC: POST /api/team-03/fundamental/analyze with cache-before-fetch and AbortSignal support. (EN)
// FIC: POST /api/team-03/fundamental/analyze con caché-before-fetch y soporte de AbortSignal. (ES)
export async function postFundamentalAnalysis(
  params: FundamentalAnalysisRequest,
  signal?: AbortSignal
): Promise<FundamentalAnalysisResponse> {
  const cacheKey = [
    "fundamental:analyze",
    params.ticker,
    params.investmentProfile ?? "Value",
    params.strategy ?? "Long Call",
    params.currentPrice ?? "auto",
    params.projectionFrom ?? "from-auto",
    params.projectionTo ?? "to-auto",
  ].join(":");
  const cached = getCached<FundamentalAnalysisResponse>(cacheKey);
  if (cached) return cached;

  const res = await fetch("/api/team-03/fundamental/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(params),
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; message?: string };
    throw new Error(body.message ?? body.error ?? `fundamental/analyze ${res.status}`);
  }

  const data = (await res.json()) as FundamentalAnalysisResponse;
  setCache(cacheKey, data, CACHE_TTL_MS);
  return data;
}

// FIC: POST /api/team-03/options/calculate with cache-before-fetch and AbortSignal support. (EN)
// FIC: POST /api/team-03/options/calculate con caché-before-fetch y soporte de AbortSignal. (ES)
export async function postOptionsCalculate(
  params: OptionsCalculateRequest,
  signal?: AbortSignal
): Promise<OptionStrategyResult> {
  const cacheKey = `options:calculate:${params.ticker}:${params.optionType}:${params.direction}:${params.strikePrice}:${params.quantity ?? "auto"}`;
  const cached = getCached<OptionStrategyResult>(cacheKey);
  if (cached) return cached;

  const res = await fetch("/api/team-03/options/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(params),
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; details?: string };
    throw new Error(body.details ?? body.error ?? `options/calculate ${res.status}`);
  }

  const data = (await res.json()) as { strategy: OptionStrategyResult };
  setCache(cacheKey, data.strategy, CACHE_TTL_MS);
  return data.strategy;
}
