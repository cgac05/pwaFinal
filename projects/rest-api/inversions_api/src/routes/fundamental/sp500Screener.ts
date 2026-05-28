/**
 * T007-T081: API de screener S&P500
 * Endpoint GET /api/team-03/screener/sp500
 *
 * User Story 1: Analista Fundamental Evalúa Viabilidad de Activo
 * Rankea empresas del índice por viabilidad y retorna top N candidatos.
 */

import { Router, Request, Response } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import { FundamentalDataService } from "../../modules/fundamental/fundamentalDataService";
import { ViabilityEngine } from "../../modules/fundamental/viabilityEngine";

interface ScreenerCandidate {
  rank: number;
  ticker: string;
  company_name: string;
  viability_score: number;
  viability_classification: string;
  viability_confidence: string;
  market_cap: number;
  volatility: number;
  justification: string;
  profile_url: string;
}

interface ScreenerResponse {
  query: {
    strategy: string;
    min_viability: number;
    top_n: number;
    sort_by: string;
  };
  timestamp: string;
  total_candidates_evaluated: number;
  candidates_passed_filter: number;
  candidates_returned: number;
  results: ScreenerCandidate[];
  cache_status: "HIT" | "MISS" | "EXPIRED";
  cache_age_minutes: number;
  assumptions: Record<string, any>;
}

// Simple in-memory cache
const screenerCache = new Map<string, { data: ScreenerResponse; timestamp: Date }>();

export function createSp500ScreenerRouter(supabaseClient: SupabaseClient): Router {
  const router = Router();
  const fundamentalDataService = new FundamentalDataService(supabaseClient);
  const viabilityEngine = new ViabilityEngine();

  /**
   * T007a: GET /api/team-03/screener/sp500
   * Query params:
   *   - strategy (long_call|long_put|short_call|short_put)
   *   - minViability (0.0-1.0, default 0.65)
   *   - topN (default 10, max 100)
   *   - sortBy (viability|volatility|market_cap, default viability)
   */
  router.get("/", async (req: Request, res: Response) => {
    try {
      const {
        strategy = "long_call",
        minViability = 0.65,
        topN = 10,
        sortBy = "viability"
      } = req.query;

      const userId = (req as any).user?.id || "anonymous";
      const minVia = Math.max(0, Math.min(1, Number(minViability)));
      const top = Math.max(1, Math.min(100, Number(topN)));

      // T007f: Audit log
      const auditEntry = {
        action: "screener_requested",
        strategy: String(strategy),
        min_viability: minVia,
        top_n: top,
        sort_by: String(sortBy),
        user_id: userId,
        timestamp: new Date().toISOString()
      };

      // T007d: Cache full screener cada 6h (360 min)
      const cacheKey = `sp500_${strategy}_${minVia}_${top}_${sortBy}`;
      const cachedResult = screenerCache.get(cacheKey);
      let cacheStatus: "HIT" | "MISS" | "EXPIRED" = "MISS";
      let cacheAgeMinutes = 0;

      if (cachedResult) {
        const ageMs = Date.now() - cachedResult.timestamp.getTime();
        cacheAgeMinutes = Math.floor(ageMs / 60000);

        if (cacheAgeMinutes < 360) {
          // 6 hours
          cacheStatus = "HIT";
          await auditLog(supabaseClient, {
            ...auditEntry,
            cache_status: "HIT",
            cache_age_minutes: cacheAgeMinutes
          });
          return res.status(200).json({
            ...cachedResult.data,
            cache_status: cacheStatus,
            cache_age_minutes: cacheAgeMinutes
          });
        } else {
          cacheStatus = "EXPIRED";
        }
      }

      // T007b: Implementar pipeline
      // 1. Fetch S&P500 constituents (simulado)
      const sp500Constituents = getSp500Constituents();

      // 2. Map to viabilityEngine → filter by minViability
      const candidatesWithScores = await Promise.all(
        sp500Constituents.map(async (ticker) => {
          try {
            const data = await fundamentalDataService.fetch(ticker, 252);
            if (!data.success || !data.data) {
              return null;
            }

            const viability = viabilityEngine.calculateViability(data.data);

            if (viability.overall < minVia) {
              return null;
            }

            return {
              ticker,
              company_name: data.data.companyName,
              viability_score: viability.overall,
              viability_classification: viability.classification,
              viability_confidence: viability.confidence,
              market_cap: data.data.metrics.marketCap?.value || 0,
              volatility: data.data.metrics.volatility?.annualizedVolatility || 0,
              justifications: viability.justifications,
              warnings: viability.warnings
            };
          } catch (error) {
            console.error(`Error processing ${ticker}:`, error);
            return null;
          }
        })
      );

      const filteredCandidates = candidatesWithScores.filter((c) => c !== null);

      // 3. Rank by sortBy
      const sorted = filteredCandidates.sort((a, b) => {
        switch (sortBy) {
          case "volatility":
            return a.volatility - b.volatility; // Lower vol first
          case "market_cap":
            return b.market_cap - a.market_cap; // Larger cap first
          case "viability":
          default:
            return b.viability_score - a.viability_score; // Higher score first
        }
      });

      // 4. Return top N
      const topCandidates = sorted.slice(0, top);

      // T007c: Incluir ranking, score, justificación, supuestos
      const results: ScreenerCandidate[] = topCandidates.map((candidate, idx) => ({
        rank: idx + 1,
        ticker: candidate.ticker,
        company_name: candidate.company_name,
        viability_score: Math.round(candidate.viability_score * 1000) / 1000,
        viability_classification: candidate.viability_classification,
        viability_confidence: candidate.viability_confidence,
        market_cap: candidate.market_cap,
        volatility: Math.round(candidate.volatility * 100) / 100,
        justification:
          candidate.justifications.marketCap ||
          candidate.justifications.roe ||
          `Empresa con score ${candidate.viability_score.toFixed(3)}`,
        // T007c: Enlace a /fundamental/{ticker} para drill-down
        profile_url: `/api/team-03/fundamental/${candidate.ticker}`
      }));

      const response: ScreenerResponse = {
        query: {
          strategy: String(strategy),
          min_viability: minVia,
          top_n: top,
          sort_by: String(sortBy)
        },
        timestamp: new Date().toISOString(),
        total_candidates_evaluated: sp500Constituents.length,
        candidates_passed_filter: filteredCandidates.length,
        candidates_returned: results.length,
        results,
        cache_status: cacheStatus,
        cache_age_minutes: cacheAgeMinutes,
        assumptions: {
          strategy_type: strategy,
          min_viability_threshold: minVia,
          lookback_days: 252,
          calculation_version: "1.0"
        }
      };

      // Cache para 6h
      screenerCache.set(cacheKey, {
        data: response,
        timestamp: new Date()
      });

      // T007e: Rate limiting (10 req/min por IP) - manejado por middleware
      res.set("Cache-Control", "public, max-age=3600"); // 1 hour HTTP cache

      // Audit success
      await auditLog(supabaseClient, {
        ...auditEntry,
        status: "success",
        results_count: results.length
      });

      return res.status(200).json(response);
    } catch (error) {
      console.error("Error running S&P500 screener:", error);

      return res.status(500).json({
        error: "Internal server error",
        message: String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}

/**
 * Helper: Retorna constituents del S&P500 (simulado)
 * En producción: fetch desde tabla Supabase
 */
function getSp500Constituents(): string[] {
  return [
    "AAPL",
    "MSFT",
    "GOOGL",
    "AMZN",
    "NVDA",
    "META",
    "TSLA",
    "BRK.B",
    "AVGO",
    "JNJ",
    "V",
    "WMT",
    "JPM",
    "XOM",
    "KO",
    "PG",
    "COST",
    "DIS",
    "MCD",
    "VZ"
  ];
}

/**
 * Helper para audit logging
 */
async function auditLog(
  supabaseClient: SupabaseClient,
  entry: Record<string, any>
): Promise<void> {
  try {
    await supabaseClient
      .from("audit_trail")
      .insert({
        action: "screener_api_call",
        details: JSON.stringify(entry),
        timestamp: new Date().toISOString()
      });
  } catch (error) {
    console.warn("Failed to log audit entry:", error);
  }
}
