/**
 * POST /api/team-03/options/analysis-qa
 *
 * Deterministic Q&A engine for option strategies.
 * It resolves real option-chain market data before calculating the 4 strategies.
 */

import { Router, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildOptionStrategyCandidates } from "../../modules/strategies/optionsStrategyService";
import { enrichOptionContractWithMarketData } from "../../modules/strategies/realOptionMarketData";
import {
  generateOptionsAnswer,
  type OptionsQARequest,
  type StrategyKey,
  type StrategiesSnapshot,
  type DashboardContext,
} from "../../modules/strategies/optionsAnalysisCore";
import type { OptionStrategyOutput } from "../../modules/strategies/optionsStrategyContract";

export function createOptionsAnalysisQARouter(supabaseClient: SupabaseClient): Router {
  const router = Router();

  router.post("/analysis-qa", async (req: Request, res: Response) => {
    const {
      ticker,
      question,
      selectedStrategy,
      strikePrice,
      currentPrice,
      expirationDate,
      daysToExpiration,
      premiumPerContract,
      numberOfContracts,
      availableCapital,
      riskTolerance,
      assumptions,
      dashboardContext,
    } = req.body;

    if (!ticker || typeof ticker !== "string") {
      return res.status(400).json({ error: "ticker requerido" });
    }
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "question requerida" });
    }

    let enrichedContract: Awaited<ReturnType<typeof enrichOptionContractWithMarketData>>;
    let candidates: OptionStrategyOutput[];
    try {
      enrichedContract = await enrichOptionContractWithMarketData({
        ticker: String(ticker).toUpperCase(),
        optionType: "call",
        direction: "long",
        strikePrice,
        currentPrice,
        expirationDate,
        daysToExpiration,
        premium: premiumPerContract,
        quantity: numberOfContracts,
        premiumPerContract,
        numberOfContracts,
        capitalAvailable: availableCapital,
        availableCapital,
        riskTolerance: riskTolerance ?? "MEDIUM",
        assumptions: assumptions ?? {},
      });
      candidates = buildOptionStrategyCandidates(enrichedContract.contract);
    } catch (err) {
      return res.status(400).json({
        error: "No se pudieron resolver datos reales de opciones para el Q&A",
        details: String(err),
      });
    }

    const byKey = (dir: string, type: string): OptionStrategyOutput | undefined =>
      candidates.find(
        (c) => String(c.direction).toUpperCase() === dir && String(c.optionType).toUpperCase() === type
      );

    const longCall = byKey("LONG", "CALL");
    const longPut = byKey("LONG", "PUT");
    const shortCall = byKey("SHORT", "CALL");
    const shortPut = byKey("SHORT", "PUT");

    if (!longCall || !longPut || !shortCall || !shortPut) {
      return res.status(500).json({ error: "No se obtuvieron las 4 estrategias del calculo" });
    }

    const snapshot: StrategiesSnapshot = { longCall, longPut, shortCall, shortPut };

    const validStrategyKeys: StrategyKey[] = ["LONG_CALL", "LONG_PUT", "SHORT_CALL", "SHORT_PUT"];
    const resolvedStrategy: StrategyKey | undefined =
      typeof selectedStrategy === "string" && validStrategyKeys.includes(selectedStrategy as StrategyKey)
        ? (selectedStrategy as StrategyKey)
        : undefined;

    const resolvedCurrentPrice = enrichedContract.contract.currentPrice;
    if (typeof resolvedCurrentPrice !== "number" || resolvedCurrentPrice <= 0) {
      return res.status(500).json({ error: "La cadena real no devolvio precio actual valido" });
    }

    const qaRequest: OptionsQARequest = {
      ticker: String(ticker).toUpperCase(),
      question: String(question),
      strategies: snapshot,
      selectedStrategy: resolvedStrategy,
      currentPrice: resolvedCurrentPrice,
      dashboardContext: dashboardContext as DashboardContext | undefined,
    };

    const qaResponse = generateOptionsAnswer(qaRequest);

    try {
      await supabaseClient.from("audit_trail").insert({
        action: "options_analysis_qa",
        details: JSON.stringify({
          ticker: qaRequest.ticker,
          intent: qaResponse.intent,
          strategyFocus: qaResponse.strategyFocus ?? null,
          question: question.slice(0, 200),
          marketData: {
            source: "real-option-chain",
            usedFields: enrichedContract.marketDataUsed,
          },
        }),
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Audit failures must not break the response.
    }

    return res.status(200).json({
      ...qaResponse,
      marketData: {
        source: "real-option-chain",
        usedFields: enrichedContract.marketDataUsed,
        context: enrichedContract.marketContext,
      },
    });
  });

  return router;
}
