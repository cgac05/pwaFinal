// FIC: Institutional analysis route — zones, trends, and expiration from a single resolve call. (EN)
// FIC: Ruta de análisis institucional — zonas, tendencias y vencimientos desde una sola llamada resolve. (ES)

import { Router, type Request, type Response } from "express";
import { authContextMiddleware } from "../../middleware/authContext";
import {
  getInstitutionalRouteContext,
  buildInstitutionalAnalysisContractFromRequest,
  buildInstitutionalMetricsSummary,
} from "./bootstrap";

export const institutionalAnalysisRouter = Router();

// FIC: GET /api/institutional/analysis — resolve data once, fan out to 3 engines in parallel. (EN)
// FIC: GET /api/institutional/analysis — resuelve datos una vez, despacha a 3 engines en paralelo. (ES)
institutionalAnalysisRouter.get(
  "/analysis",
  authContextMiddleware,
  async (req: Request, res: Response) => {
    const { dataService, zonesEngine, trendEngine, expirationEngine } =
      getInstitutionalRouteContext();

    const contract = buildInstitutionalAnalysisContractFromRequest(req);

    // FIC: Resolve sources once and share preResolvedResult with all 3 engines. (EN)
    // FIC: Resuelve fuentes una vez y comparte preResolvedResult con los 3 engines. (ES)
    const preResolvedResult = await dataService.resolve(contract);

    if (preResolvedResult.overallStatus === "all_failed") {
      return res.status(503).json({ code: "ALL_SOURCES_UNAVAILABLE" });
    }

    // FIC: Run all 3 engines in parallel using the pre-resolved result. (EN)
    // FIC: Ejecuta los 3 engines en paralelo usando el resultado pre-resuelto. (ES)
    const [zonesSettled, trendsSettled, expirationSettled] = await Promise.allSettled([
      zonesEngine.analyze(contract, preResolvedResult),
      trendEngine.analyze(contract, preResolvedResult),
      expirationEngine.analyze(contract, preResolvedResult),
    ]);

    const zones = zonesSettled.status === "fulfilled" ? zonesSettled.value : null;
    const trends = trendsSettled.status === "fulfilled" ? trendsSettled.value : null;
    const expiration = expirationSettled.status === "fulfilled" ? expirationSettled.value : null;

    const sourceReports = preResolvedResult.observations.map((obs) => ({
      sourceId: obs.sourceId,
      status: obs.status,
      confidence: obs.confidence,
      asOf: obs.asOf,
    }));

    return res.status(200).json({
      request: {
        ticker: contract.ticker,
        period: contract.period,
        horizon: contract.horizon,
        analysisId: contract.analysisId,
      },
      analysis: {
        overallStatus: preResolvedResult.overallStatus,
        usedSourceIds: preResolvedResult.usedSourceIds,
        cacheHit: preResolvedResult.cacheHit,
        resolvedAt: preResolvedResult.resolvedAt,
      },
      zones: zones
        ? {
            all: zones.zones,
            support: zones.supportZones,
            resistance: zones.resistanceZones,
            candlesAnalyzed: zones.candlesAnalyzed,
            institutionalScore: zones.institutionalScore,
            atr: zones.atr,
          }
        : null,
      trends: trends
        ? {
            direction: trends.direction,
            sma50: trends.sma50,
            sma200: trends.sma200,
            crossover: trends.crossover ?? null,
            trendStrength: trends.trendStrength,
            continuityProbability: trends.continuityProbability,
            volumeCorrelation: trends.volumeCorrelation,
            institutionalScore: trends.institutionalScore,
            candlesAnalyzed: trends.candlesAnalyzed,
          }
        : null,
      expiration: expiration
        ? {
            events: expiration.events,
            currentRegime: expiration.currentRegime,
            theta: expiration.theta,
            gamma: expiration.gamma,
            expiryBias: expiration.expiryBias,
            callPutSkew: expiration.callPutSkew,
            daysToNextOpex: expiration.daysToNextOpex,
            quarterlyReportImpact: expiration.quarterlyReportImpact,
          }
        : null,
      metrics: (() => {
        const m = preResolvedResult.merged;
        return {
          ticker:                contract.ticker,
          volume:                m.volume                  ?? contract.volume,
          openPositionsCount:    m.openPositions?.count    ?? contract.openPositions.count,
          openPositionsNotional: m.openPositions?.notional ?? contract.openPositions.notional,
          inflows:               m.flows?.inflows          ?? contract.flows.inflows,
          outflows:              m.flows?.outflows         ?? contract.flows.outflows,
          netFlow:               m.flows
            ? m.flows.inflows - m.flows.outflows
            : contract.flows.inflows - contract.flows.outflows,
          fundsOwnershipPct:     m.fundsOwnershipPct       ?? contract.fundsOwnershipPct,
          liquidity:             m.liquidity               ?? contract.liquidity,
        };
      })(),
      sourceReports,
    });
  }
);
