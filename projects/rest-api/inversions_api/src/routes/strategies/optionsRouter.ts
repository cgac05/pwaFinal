import { Router, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OptionStrategyContract } from "../../modules/strategies/optionsStrategyContract";
import { buildOptionStrategyResult, buildOptionStrategyCandidates } from "../../modules/strategies/optionsStrategyService";
import { simulateStrategy } from "../../modules/strategies/simulationEngine";
import { rankOptionStrategies } from "../../modules/strategies/strategyRecommendationService";
import { enrichOptionContractWithMarketData, fetchRealPricePath } from "../../modules/strategies/realOptionMarketData";

export function createOptionsRouter(supabaseClient: SupabaseClient): Router {
  const router = Router();

  router.post("/calculate", async (req: Request, res: Response) => {
    try {
      const enriched = await enrichOptionContractWithMarketData(req.body as Partial<OptionStrategyContract>);
      const params = enriched.contract;
      const strategyResult = buildOptionStrategyResult(params);

      await auditLog(supabaseClient, {
        action: "options_formula_calculated",
        ticker: params.ticker,
        optionType: params.optionType,
        direction: params.direction,
        strikePrice: params.strikePrice,
        premium: params.premium,
        quantity: params.quantity,
        timestamp: new Date().toISOString()
      });

      return res.status(200).json({
        strategy: strategyResult,
        marketData: {
          source: "real-option-chain",
          usedFields: enriched.marketDataUsed,
          context: enriched.marketContext,
        },
      });
    } catch (error) {
      return res.status(400).json({ error: "Invalid strategy request", details: String(error) });
    }
  });

  router.post("/recommend", async (req: Request, res: Response) => {
    try {
      const enriched = await enrichOptionContractWithMarketData(req.body as Partial<OptionStrategyContract>);
      const params = enriched.contract;
      const viabilityScore = Number(req.body.viabilityScore ?? 1);
      const recommendation = rankOptionStrategies(params, viabilityScore);

      await auditLog(supabaseClient, {
        action: "options_recommendation_requested",
        ticker: params.ticker,
        viability_score: viabilityScore,
        timestamp: new Date().toISOString()
      });

      if (recommendation.warning) {
        return res.status(422).json({
          ...recommendation,
          marketData: {
            source: "real-option-chain",
            usedFields: enriched.marketDataUsed,
            context: enriched.marketContext,
          },
        });
      }

      return res.status(200).json({
        ...recommendation,
        marketData: {
          source: "real-option-chain",
          usedFields: enriched.marketDataUsed,
          context: enriched.marketContext,
        },
      });
    } catch (error) {
      return res.status(400).json({ error: "Invalid recommendation request", details: String(error) });
    }
  });

  router.post("/simulate", async (req: Request, res: Response) => {
    try {
      const { contract, pricePath } = req.body as {
        contract: OptionStrategyContract;
        pricePath?: number[];
      };
      const enriched = await enrichOptionContractWithMarketData(contract);
      const resolvedPricePath =
        Array.isArray(pricePath) && pricePath.length > 0
          ? pricePath
          : await fetchRealPricePath(enriched.contract.ticker);

      const simulation = simulateStrategy(enriched.contract, resolvedPricePath);

      await auditLog(supabaseClient, {
        action: "options_simulation_requested",
        ticker: enriched.contract.ticker,
        price_path_length: resolvedPricePath.length,
        price_path_source: Array.isArray(pricePath) && pricePath.length > 0 ? "request" : "yahoo_chart",
        timestamp: new Date().toISOString()
      });

      return res.status(200).json({
        simulation,
        marketData: {
          optionSource: "real-option-chain",
          pricePathSource: Array.isArray(pricePath) && pricePath.length > 0 ? "request" : "yahoo_chart",
          usedFields: enriched.marketDataUsed,
          context: enriched.marketContext,
        },
      });
    } catch (error) {
      return res.status(400).json({ error: "Invalid simulation request", details: String(error) });
    }
  });

  return router;
}

async function auditLog(supabaseClient: SupabaseClient, entry: Record<string, unknown>) {
  try {
    await supabaseClient.from("audit_trail").insert({ action: entry.action, details: JSON.stringify(entry), timestamp: new Date().toISOString() });
  } catch {
    // Audit failures are non-blocking.
  }
}
