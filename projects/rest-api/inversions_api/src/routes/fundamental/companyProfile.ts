/**
 * T006-T080: API REST de perfil fundamental por empresa
 * Endpoint GET /api/team-03/fundamental/{ticker}
 *
 * User Story 1: Analista Fundamental Evalúa Viabilidad de Activo
 * Retorna perfil completo con volatilidad, ratios, viabilidad y justificación.
 */

import { Router, Request, Response } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import type { FundamentalAnalysisData } from "../../modules/fundamental/fundamentalSourceContract";
import { FundamentalDataService } from "../../modules/fundamental/fundamentalDataService";
import { ViabilityEngine } from "../../modules/fundamental/viabilityEngine";

export function createCompanyProfileRouter(supabaseClient: SupabaseClient): Router {
  const router = Router();
  const fundamentalDataService = new FundamentalDataService(supabaseClient);
  const viabilityEngine = new ViabilityEngine();

  /**
   * T006a: GET /api/team-03/fundamental/{ticker}
   * Query params:
   *   - lookbackDays (default 252)
   *   - cache (true/false, default true)
   */
  router.get("/:ticker", async (req: Request, res: Response) => {
    try {
      const { ticker } = req.params;
      const { lookbackDays = 252, cache = true } = req.query;
      const userId = (req as any).user?.id || "anonymous";

      // T006f: Audit log
      const auditEntry = {
        action: "profile_requested",
        ticker: ticker.toUpperCase(),
        user_id: userId,
        timestamp: new Date().toISOString(),
        lookbackDays: Number(lookbackDays)
      };

      // T006b: Orquestar llamadas
      // fetch(ticker) → viabilityEngine.score(data)
      const fundamentalData = await fundamentalDataService.fetch(
        ticker.toUpperCase(),
        Number(lookbackDays)
      );

      if (!fundamentalData.success || !fundamentalData.data) {
        // Audit error
        await auditLog(supabaseClient, {
          ...auditEntry,
          status: "error",
          error: fundamentalData.error
        });

        return res.status(400).json({
          error: "Failed to fetch fundamental data",
          message: fundamentalData.error || "Unknown error",
          ticker: ticker.toUpperCase()
        });
      }

      const data = fundamentalData.data;

      // Validar histórico mínimo (>= 30 días)
      const daysAvailable =
        data.metrics.volatility?.lookbackDays ?? Number(lookbackDays);
      if (data.metrics.priceHistory && daysAvailable < 30) {
        await auditLog(supabaseClient, {
          ...auditEntry,
          status: "rejected_insufficient_history",
          days_available: daysAvailable
        });

        return res.status(422).json({
          error: "Insufficient historical data",
          message: `Insuficientes datos históricos (${daysAvailable}d disponibles, mínimo 30d requerido)`,
          ticker: ticker.toUpperCase(),
          min_required_days: 30,
          days_available: daysAvailable
        });
      }

      // Calcular viabilidad
      const viabilityScore = viabilityEngine.calculateViability(data);

      // T006c: Retornar objeto JSON estructurado
      const response = {
        ticker: ticker.toUpperCase(),
        company_name: data.companyName,
        profile: {
          market_cap: data.metrics.marketCap?.value,
          market_cap_currency: data.metrics.marketCap?.currency || "USD",
          revenue: data.metrics.sales?.annualRevenue,
          revenue_currency: data.metrics.marketCap?.currency || "USD",
          employees: data.metrics.employees?.count,
          sector: data.metrics.sector?.sector,
          industry: data.metrics.sector?.industry,
          country: data.metrics.country?.primaryListing
        },
        metrics: {
          price: data.metrics.priceHistory?.currentPrice,
          volatility: data.metrics.volatility?.annualizedVolatility,
          volatility_lookback_days: data.metrics.volatility?.lookbackDays,
          beta: data.metrics.beta?.value,
          beta_confidence: data.metrics.beta?.confidenceLevel,
          dividend_yield: data.metrics.dividend?.dividendYieldPercent,
          eps: data.metrics.eps?.eps,
          eps_growth_yoy: data.metrics.eps?.epsGrowthYoYPercent,
          pe_ratio: data.metrics.financialRatios?.peRatio,
          roe: data.metrics.financialRatios?.roe,
          pb_ratio: data.metrics.financialRatios?.pbRatio,
          ps_ratio: data.metrics.financialRatios?.psRatio,
          debt_to_equity: data.metrics.financialRatios?.debtToEquity
        },
        viability: {
          score: viabilityScore.overall,
          classification: viabilityScore.classification,
          confidence: viabilityScore.confidence,
          data_completeness_percent: viabilityScore.dataCompletenessPercent,
          component_scores: viabilityScore.componentScores,
          justifications: viabilityScore.justifications,
          recommendations: viabilityScore.recommendations,
          warnings: viabilityScore.warnings
        },
        timestamp: new Date().toISOString(),
        assumptions: {
          volatility_calculation_method: data.metadata.assumptions?.volatilityCalculationMethod,
          lookback_days_used: Number(lookbackDays)
        },
        metadata: {
          data_source_id: data.metadata.sourceId,
          data_version: data.metadata.dataVersion,
          calculation_version: "1.0",
          sources: [data.metadata.sourceId]
        }
      };

      // T006d: ETag para caché a nivel endpoint
      const responseETag = `"${Buffer.from(JSON.stringify(response)).toString(
        "base64"
      ).slice(0, 16)}"`;

      // T006e: Rate limiting (100 req/min por IP) - manejado por middleware
      res.set("ETag", responseETag);
      res.set("Cache-Control", "public, max-age=300"); // 5 min cache

      // Audit success
      await auditLog(supabaseClient, {
        ...auditEntry,
        status: "success",
        viability_classification: viabilityScore.classification
      });

      return res.status(200).json(response);
    } catch (error) {
      console.error("Error fetching company profile:", error);

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
        action: "profile_api_call",
        details: JSON.stringify(entry),
        timestamp: new Date().toISOString()
      });
  } catch (error) {
    console.warn("Failed to log audit entry:", error);
  }
}
