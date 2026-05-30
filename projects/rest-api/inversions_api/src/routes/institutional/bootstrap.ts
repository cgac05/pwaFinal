// FIC: Institutional route bootstrap — singleton context with 4 sources, 3 engines, and contract builder. (EN)
// FIC: Bootstrap de rutas institucionales — contexto singleton con 4 fuentes, 3 engines y constructor de contratos. (ES)

import { randomUUID } from "node:crypto";
import type { Request } from "express";
import {
  InstitutionalDataService,
  type DataSourceConfig,
} from "../../modules/institutional/institutionalDataService";
import {
  createInstitutionalAnalysisContract,
  type InstitutionalAnalysisContract,
  type InstitutionalAnalysisPeriod,
  type InstitutionalHorizon,
} from "../../modules/institutional/institutionalContract";
import { InstitutionalZonesEngine } from "../../modules/institutional/institutionalZonesEngine";
import { InstitutionalTrendEngine } from "../../modules/institutional/institutionalTrendEngine";
import { ExpirationAnalysisEngine } from "../../modules/institutional/expirationAnalysisEngine";
import { parseSecEdgar13fReal, parseFinraShortInterestReal, ensureFinraCache } from "../../modules/institutional/realSourceParsers";
import { parseYahooOptionsFlow } from "../../modules/institutional/yahooOptionsParser";
import { parseYahooInstitutional } from "../../modules/institutional/yahooInstitutionalParser";
import { parseYahooChart } from "../../modules/institutional/yahooChartParser";
import { getYahooSession } from "../../modules/institutional/yahooCrumbSession";

// ─── Route context (singleton) ────────────────────────────────────────────────

export interface InstitutionalRouteContext {
  dataService: InstitutionalDataService;
  zonesEngine: InstitutionalZonesEngine;
  trendEngine: InstitutionalTrendEngine;
  expirationEngine: ExpirationAnalysisEngine;
}

let _context: InstitutionalRouteContext | null = null;

// FIC: Returns a singleton route context — creates once, reuses across requests. (EN)
// FIC: Retorna un contexto de ruta singleton — crea una vez, reutiliza entre requests. (ES)
export function getInstitutionalRouteContext(): InstitutionalRouteContext {
  if (_context) return _context;

  const sources: DataSourceConfig[] = [
    {
      sourceId: "yahoo_chart",
      priority: 1,
      cacheTtlMs: 300_000,
      rateLimit: { maxRequests: 30, windowMs: 60_000 },
      parse: parseYahooChart,
    },
    {
      sourceId: "sec_edgar_13f",
      priority: 2,
      cacheTtlMs: 600_000,
      rateLimit: { maxRequests: 10, windowMs: 60_000 },
      parse: parseSecEdgar13fReal,
    },
    {
      sourceId: "finra_short_interest",
      priority: 3,
      cacheTtlMs: 600_000,
      rateLimit: { maxRequests: 10, windowMs: 60_000 },
      parse: parseFinraShortInterestReal,
    },
    {
      sourceId: "yahoo_options_flow",
      priority: 4,
      cacheTtlMs: 120_000,
      rateLimit: { maxRequests: 20, windowMs: 60_000 },
      parse: parseYahooOptionsFlow,
    },
    {
      sourceId: "yahoo_institutional",
      priority: 5,
      cacheTtlMs: 300_000,
      rateLimit: { maxRequests: 20, windowMs: 60_000 },
      parse: parseYahooInstitutional,
    },
  ];

  const dataService = new InstitutionalDataService(sources);

  // FIC: Pre-warm caches in background — first real request arrives with warm data. (EN)
  // FIC: Pre-calienta cachés en background — el primer request llega con datos calientes. (ES)
  ensureFinraCache().catch(() => {});
  getYahooSession().catch(() => {});
  // Pre-warm chart cache for the two most common tickers
  dataService.resolveSingleSource(sources[0], "SPY", "daily").catch(() => {});
  dataService.resolveSingleSource(sources[0], "QQQ", "daily").catch(() => {});

  _context = {
    dataService,
    zonesEngine: new InstitutionalZonesEngine(),
    trendEngine: new InstitutionalTrendEngine(),
    expirationEngine: new ExpirationAnalysisEngine(),
  };

  return _context;
}

// ─── Contract builder ─────────────────────────────────────────────────────────

// FIC: Build an InstitutionalAnalysisContract with zero-based defaults — engines override with real data. (EN)
// FIC: Construye un InstitutionalAnalysisContract con defaults en cero — los engines los sobrescriben con datos reales. (ES)
// Volume, fundsOwnershipPct, inflows and outflows start at 0 so that when real institutional
// sources (SEC 13F, FINRA, Yahoo) succeed they fully override these values. If sources fail,
// the metrics show 0 ("unknown") rather than fabricated numbers.
export function buildInstitutionalAnalysisContractFromRequest(
  req: Request
): InstitutionalAnalysisContract {
  const ticker = String(req.query.ticker ?? "SPY").toUpperCase().trim();
  const period = (String(req.query.period ?? "daily")) as InstitutionalAnalysisPeriod;
  const horizon = (String(req.query.horizon ?? "medium")) as InstitutionalHorizon;

  const validPeriods: InstitutionalAnalysisPeriod[] = ["intraday", "daily", "weekly", "monthly", "quarterly"];
  const validHorizons: InstitutionalHorizon[] = ["short", "medium", "long"];
  const safePeriod = validPeriods.includes(period) ? period : "daily";
  const safeHorizon = validHorizons.includes(horizon) ? horizon : "medium";

  return createInstitutionalAnalysisContract({
    ticker,
    period: safePeriod,
    horizon: safeHorizon,
    // FIC: All market metrics default to 0 — real values come from data sources resolved by the engines. (EN)
    volume: 0,
    liquidity: "low",
    fundsOwnershipPct: 0,
    flows: { inflows: 0, outflows: 0, asOf: new Date().toISOString() },
    openPositions: { count: 0, notional: 0 },
    sourceIds: ["yahoo_chart", "sec_edgar_13f", "finra_short_interest", "yahoo_options_flow", "yahoo_institutional"],
    requestedAt: new Date().toISOString(),
    analysisId: randomUUID(),
  });
}

// FIC: Build a contract from ticker alone — used by the simulation runner (no Express Request). (EN)
// FIC: Construye un contrato desde solo el ticker — usado por el runner de simulación (sin Express Request). (ES)
export function buildInstitutionalContractForSimulation(
  ticker: string
): InstitutionalAnalysisContract {
  return buildInstitutionalAnalysisContractFromRequest({
    query: { ticker, period: "daily", horizon: "medium" }
  } as any);
}

// ─── Summary builders ─────────────────────────────────────────────────────────

// FIC: Build a compact trend summary object for embedding in API responses. (EN)
// FIC: Construye un resumen compacto de tendencia para incluir en respuestas API. (ES)
export function buildInstitutionalTrendSummary(contract: InstitutionalAnalysisContract) {
  return {
    ticker: contract.ticker,
    period: contract.period,
    horizon: contract.horizon,
    liquidity: contract.liquidity,
    fundsOwnershipPct: contract.fundsOwnershipPct,
    netFlow: contract.flows.inflows - contract.flows.outflows,
  };
}

// FIC: Build an institutional metrics summary for API responses. (EN)
// FIC: Construye un resumen de métricas institucionales para respuestas API. (ES)
export function buildInstitutionalMetricsSummary(contract: InstitutionalAnalysisContract) {
  return {
    ticker: contract.ticker,
    volume: contract.volume,
    openPositionsCount: contract.openPositions.count,
    openPositionsNotional: contract.openPositions.notional,
    inflows: contract.flows.inflows,
    outflows: contract.flows.outflows,
    netFlow: contract.flows.inflows - contract.flows.outflows,
    fundsOwnershipPct: contract.fundsOwnershipPct,
    liquidity: contract.liquidity,
  };
}

// FIC: Build an institutional positions summary for API responses (regulatory/13F view). (EN)
// FIC: Construye un resumen de posiciones institucionales para respuestas API (vista regulatoria/13F). (ES)
export function buildInstitutionalPositionsSummary(
  contract: InstitutionalAnalysisContract,
  merged?: {
    fundsOwnershipPct?: number;
    flows?: { inflows: number; outflows: number; asOf?: string };
    openPositions?: { count: number; notional?: number };
  }
) {
  const ownership = merged?.fundsOwnershipPct ?? contract.fundsOwnershipPct;
  const inflows   = merged?.flows?.inflows    ?? contract.flows.inflows;
  const outflows  = merged?.flows?.outflows   ?? contract.flows.outflows;
  const count     = merged?.openPositions?.count    ?? contract.openPositions.count;
  const notional  = merged?.openPositions?.notional ?? contract.openPositions.notional;

  return {
    ticker: contract.ticker,
    positions13F: contract.sourceIds?.map((sourceId) => ({
      sourceId,
      asOf: contract.flows.asOf,
      count,
      notional: notional ?? 0,
      ownership,
      confidence: 0.80,
    })) ?? [],
    flows: {
      inflows,
      outflows,
      netFlow: inflows - outflows,
    },
  };
}
