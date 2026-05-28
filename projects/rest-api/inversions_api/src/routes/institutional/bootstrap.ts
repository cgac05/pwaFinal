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
      sourceId: "sec_edgar_13f",
      priority: 1,
      cacheTtlMs: 600_000,
      rateLimit: { maxRequests: 10, windowMs: 60_000 },
      parse: parseSecEdgar13fReal,
    },
    {
      sourceId: "finra_short_interest",
      priority: 2,
      cacheTtlMs: 600_000,
      rateLimit: { maxRequests: 10, windowMs: 60_000 },
      parse: parseFinraShortInterestReal,
    },
    {
      sourceId: "yahoo_options_flow",
      priority: 3,
      cacheTtlMs: 120_000,
      rateLimit: { maxRequests: 20, windowMs: 60_000 },
      parse: parseYahooOptionsFlow,
    },
    {
      sourceId: "yahoo_institutional",
      priority: 4,
      cacheTtlMs: 300_000,
      rateLimit: { maxRequests: 20, windowMs: 60_000 },
      parse: parseYahooInstitutional,
    },
  ];

  const dataService = new InstitutionalDataService(sources);

  // FIC: Pre-warm FINRA cache in background — does not block startup. (EN)
  // FIC: Pre-calienta la caché FINRA en background — no bloquea el startup. (ES)
  ensureFinraCache().catch(() => {});

  _context = {
    dataService,
    zonesEngine: new InstitutionalZonesEngine(),
    trendEngine: new InstitutionalTrendEngine(),
    expirationEngine: new ExpirationAnalysisEngine(),
  };

  return _context;
}

// ─── Synthetic contract builder ───────────────────────────────────────────────

const PERIOD_FACTOR: Record<InstitutionalAnalysisPeriod, number> = {
  intraday: 0.15,
  daily: 0.35,
  weekly: 0.65,
  monthly: 1.0,
  quarterly: 1.5,
};

const HORIZON_FACTOR: Record<InstitutionalHorizon, number> = {
  short: 0.6,
  medium: 1.0,
  long: 1.4,
};

// FIC: Build an InstitutionalAnalysisContract with deterministic synthetic values from query params. (EN)
// FIC: Construye un InstitutionalAnalysisContract con valores sintéticos deterministas desde query params. (ES)
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

  // FIC: Deterministic seed from ticker character codes — same ticker always yields same values. (EN)
  // FIC: Semilla determinista desde códigos de caracteres del ticker — mismo ticker = mismos valores. (ES)
  const seed = ticker.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);

  const pf = PERIOD_FACTOR[safePeriod];
  const hf = HORIZON_FACTOR[safeHorizon];

  const volume = Math.round(900_000 + seed * 850 * pf * hf);
  const liquidity = volume >= 2_000_000 ? "high" : volume >= 1_200_000 ? "medium" : "low";

  const fundsOwnershipPct = 18 + (seed % 34) + (hf > 1 ? 4 : 0) + (pf > 1 ? 3 : 0);
  const inflows = volume * (0.34 + (seed % 10) * 0.008);
  const outflows = volume * (0.18 + (seed % 7) * 0.005);

  return createInstitutionalAnalysisContract({
    ticker,
    period: safePeriod,
    volume,
    liquidity,
    horizon: safeHorizon,
    fundsOwnershipPct: Math.min(fundsOwnershipPct, 95),
    flows: {
      inflows,
      outflows,
      asOf: new Date().toISOString(),
    },
    openPositions: {
      count: 50 + (seed % 200),
      notional: volume * 12,
    },
    sourceIds: ["sec_edgar_13f", "finra_short_interest", "yahoo_options_flow", "yahoo_institutional"],
    requestedAt: new Date().toISOString(),
    analysisId: randomUUID(),
  });
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
export function buildInstitutionalPositionsSummary(contract: InstitutionalAnalysisContract) {
  return {
    ticker: contract.ticker,
    positions13F: contract.sourceIds?.map((sourceId) => ({
      sourceId,
      asOf: contract.flows.asOf,
      count: contract.openPositions.count,
      notional: contract.openPositions.notional ?? 0,
      ownership: contract.fundsOwnershipPct,
      confidence: 0.80,
    })) ?? [],
    flows: {
      inflows: contract.flows.inflows,
      outflows: contract.flows.outflows,
      netFlow: contract.flows.inflows - contract.flows.outflows,
    },
  };
}
