import { Router, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OptionStrategyContract } from "../../modules/strategies/optionsStrategyContract";
import { buildOptionStrategyResult, buildOptionStrategyCandidates } from "../../modules/strategies/optionsStrategyService";
import { simulateStrategy } from "../../modules/strategies/simulationEngine";
import { rankOptionStrategies } from "../../modules/strategies/strategyRecommendationService";

export function createOptionsRouter(supabaseClient: SupabaseClient): Router {
  const router = Router();

  router.post("/calculate", async (req: Request, res: Response) => {
    try {
      const params = req.body as OptionStrategyContract;
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

      return res.status(200).json({ strategy: strategyResult });
    } catch (error) {
      return res.status(400).json({ error: "Invalid strategy request", details: String(error) });
    }
  });

  router.post("/recommend", async (req: Request, res: Response) => {
    try {
      const params = req.body as OptionStrategyContract;
      const viabilityScore = Number(req.body.viabilityScore ?? 1);
      const recommendation = rankOptionStrategies(params, viabilityScore);

      await auditLog(supabaseClient, {
        action: "options_recommendation_requested",
        ticker: params.ticker,
        viability_score: viabilityScore,
        timestamp: new Date().toISOString()
      });

      if (recommendation.warning) {
        return res.status(422).json(recommendation);
      }

      return res.status(200).json(recommendation);
    } catch (error) {
      return res.status(400).json({ error: "Invalid recommendation request", details: String(error) });
    }
  });

  router.post("/simulate", async (req: Request, res: Response) => {
    try {
      const { contract, pricePath } = req.body as {
        contract: OptionStrategyContract;
        pricePath: number[];
      };
      if (!Array.isArray(pricePath) || pricePath.length === 0) {
        return res.status(400).json({ error: "pricePath must be a non-empty array" });
      }

      const simulation = simulateStrategy(contract, pricePath);

      await auditLog(supabaseClient, {
        action: "options_simulation_requested",
        ticker: contract.ticker,
        price_path_length: pricePath.length,
        timestamp: new Date().toISOString()
      });

      return res.status(200).json({ simulation });
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
