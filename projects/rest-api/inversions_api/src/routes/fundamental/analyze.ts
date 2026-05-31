/**
 * POST /api/team-03/fundamental/analyze
 * Cerebro de análisis fundamental automatizado.
 * Obtiene datos de la fuente seleccionada, los analiza con Claude,
 * y devuelve análisis narrativo + filas de confluencia para A_FUNDAMENTAL.
 */

import { Router, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FundamentalDataService } from "../../modules/fundamental/fundamentalDataService";
import { analyzeFundamental, type AnalysisOptions } from "../../modules/fundamental/fundamentalAnalyzer";

export function createFundamentalAnalyzeRouter(supabaseClient: SupabaseClient): Router {
  const router = Router();
  const dataService = new FundamentalDataService(supabaseClient);

  router.post("/analyze", async (req: Request, res: Response) => {
    try {
      const {
        ticker,
        source,
        investmentProfile = "Value",
        horizon = "Largo plazo",
        selectedMetrics = ["Valoración", "Crecimiento", "Rentabilidad", "Salud Financiera", "Flujo de Caja", "Riesgo", "Ventaja Competitiva"],
        strategy = "Long Call",
        comparisons = [],
        projectionFrom,
        projectionTo
      } = req.body;

      if (!ticker || typeof ticker !== "string") {
        return res.status(400).json({ error: "ticker requerido" });
      }

      const sym = ticker.toUpperCase();
      const sourceId = typeof source === "string" && source ? source : undefined;

      // Fetch fundamental data from selected source
      const dataResult = await dataService.fetch(sym, 252, sourceId);

      if (!dataResult.success || !dataResult.data) {
        return res.status(400).json({
          error: "No se pudieron obtener datos fundamentales",
          message: dataResult.error ?? "source_failed",
          ticker: sym,
          source: sourceId ?? "auto"
        });
      }

      const opts: AnalysisOptions = {
        ticker: sym,
        investmentProfile: String(investmentProfile),
        horizon: String(horizon),
        selectedMetrics: Array.isArray(selectedMetrics) ? selectedMetrics.map(String) : [],
        strategy: String(strategy),
        comparisons: Array.isArray(comparisons) ? comparisons.map(String) : [],
        projectionFrom: typeof projectionFrom === "string" && projectionFrom ? projectionFrom : undefined,
        projectionTo: typeof projectionTo === "string" && projectionTo ? projectionTo : undefined
      };

      const analysis = await analyzeFundamental(dataResult.data, opts);

      // Audit log (non-blocking)
      supabaseClient.from("audit_trail").insert({
        action: "fundamental_analyze",
        details: JSON.stringify({
          ticker: sym,
          source: sourceId ?? "auto",
          profile: opts.investmentProfile,
          horizon: opts.horizon,
          overallScore: analysis.overallScore,
          verdict: analysis.verdict
        }),
        timestamp: new Date().toISOString()
      }).match({}).then(() => {}, () => {});

      return res.status(200).json({
        ticker: sym,
        companyName: analysis.companyName,
        sourceId: analysis.sourceId,
        overallScore: analysis.overallScore,
        verdict: analysis.verdict,
        recommendation: analysis.recommendation,
        projection: analysis.projection,
        aiAnalysis: analysis.aiAnalysis,
        sections: analysis.sections,
        confluenceRows: analysis.confluenceRows,
        fundamentalData: {
          price: dataResult.data.metrics.priceHistory?.currentPrice,
          marketCap: dataResult.data.metrics.marketCap?.value,
          sector: dataResult.data.metrics.sector?.sector,
          industry: dataResult.data.metrics.sector?.industry,
          pe: dataResult.data.metrics.financialRatios?.peRatio,
          pb: dataResult.data.metrics.financialRatios?.pbRatio,
          ps: dataResult.data.metrics.financialRatios?.psRatio,
          roe: dataResult.data.metrics.financialRatios?.roe,
          debtToEquity: dataResult.data.metrics.financialRatios?.debtToEquity,
          eps: dataResult.data.metrics.eps?.eps,
          epsGrowth: dataResult.data.metrics.eps?.epsGrowthYoYPercent,
          dividendYield: dataResult.data.metrics.dividend?.dividendYieldPercent,
          volatility: dataResult.data.metrics.volatility?.annualizedVolatility,
          beta: dataResult.data.metrics.beta?.value,
          high52w: dataResult.data.metrics.priceHistory?.priceHigh52Week,
          low52w: dataResult.data.metrics.priceHistory?.priceLow52Week,
          change52w: dataResult.data.metrics.priceHistory?.priceChange52WeekPercent,
          revenue: dataResult.data.metrics.sales?.annualRevenue,
          revenueGrowth: dataResult.data.metrics.sales?.revenueGrowthPercent
        },
        timestamp: analysis.timestamp
      });
    } catch (error) {
      console.error("[FundamentalAnalyze] Error:", error);
      return res.status(500).json({
        error: "Error interno en análisis fundamental",
        message: String(error)
      });
    }
  });

  return router;
}
