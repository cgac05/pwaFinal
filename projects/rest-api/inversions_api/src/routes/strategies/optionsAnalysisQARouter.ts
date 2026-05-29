/**
 * POST /api/team-03/options/analysis-qa
 *
 * Motor de Q&A determinístico para estrategias de opciones.
 * Sin IA. Las respuestas se derivan del cálculo de las 4 estrategias.
 *
 * Body esperado:
 *   ticker          string  — símbolo (ej: AAPL)
 *   question        string  — pregunta del usuario
 *   selectedStrategy? string — "LONG_CALL" | "LONG_PUT" | "SHORT_CALL" | "SHORT_PUT"
 *
 *   // Parámetros para calcular las estrategias (si no se proveen pre-calculadas):
 *   strikePrice     number
 *   currentPrice    number
 *   expirationDate  string  — ISO 8601
 *   daysToExpiration number
 *   premiumPerContract number
 *   numberOfContracts  number
 *   availableCapital   number
 *   riskTolerance?  "LOW" | "MEDIUM" | "HIGH"
 *   assumptions?    { impliedVolatility?, timeDecayModel?, interestRate? }
 */

import { Router, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildOptionStrategyCandidates } from "../../modules/strategies/optionsStrategyService";
import {
  generateOptionsAnswer,
  type OptionsQARequest,
  type StrategyKey,
  type StrategiesSnapshot,
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
    } = req.body;

    // ── Validación básica ─────────────────────────────────────────────────
    if (!ticker || typeof ticker !== "string") {
      return res.status(400).json({ error: "ticker requerido" });
    }
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "question requerida" });
    }

    const requiredNumericFields = [
      ["strikePrice", strikePrice],
      ["currentPrice", currentPrice],
      ["premiumPerContract", premiumPerContract],
      ["numberOfContracts", numberOfContracts],
      ["availableCapital", availableCapital],
    ] as const;

    for (const [field, value] of requiredNumericFields) {
      if (typeof value !== "number" || isNaN(value) || value <= 0) {
        return res.status(400).json({ error: `${field} debe ser un número positivo` });
      }
    }

    if (!expirationDate || typeof expirationDate !== "string") {
      return res.status(400).json({ error: "expirationDate requerido (ISO 8601)" });
    }

    const dte = typeof daysToExpiration === "number" && daysToExpiration > 0
      ? daysToExpiration
      : Math.max(1, Math.round((new Date(expirationDate).getTime() - Date.now()) / 86_400_000));

    // ── Calcular las 4 estrategias ────────────────────────────────────────
    let candidates: OptionStrategyOutput[];
    try {
      candidates = buildOptionStrategyCandidates({
        ticker: String(ticker).toUpperCase(),
        optionType: "call",
        direction: "long",
        strikePrice,
        currentPrice,
        expirationDate,
        daysToExpiration: dte,
        premium: premiumPerContract,
        quantity: numberOfContracts,
        premiumPerContract,
        numberOfContracts,
        capitalAvailable: availableCapital,
        availableCapital,
        riskTolerance: riskTolerance ?? "MEDIUM",
        assumptions: assumptions ?? {},
      });
    } catch (err) {
      return res.status(500).json({ error: "Error al calcular estrategias", details: String(err) });
    }

    // ── Construir snapshot ────────────────────────────────────────────────
    const byKey = (dir: string, type: string): OptionStrategyOutput | undefined =>
      candidates.find(
        (c) => String(c.direction).toUpperCase() === dir && String(c.optionType).toUpperCase() === type
      );

    const longCall  = byKey("LONG",  "CALL");
    const longPut   = byKey("LONG",  "PUT");
    const shortCall = byKey("SHORT", "CALL");
    const shortPut  = byKey("SHORT", "PUT");

    if (!longCall || !longPut || !shortCall || !shortPut) {
      return res.status(500).json({ error: "No se obtuvieron las 4 estrategias del cálculo" });
    }

    const snapshot: StrategiesSnapshot = { longCall, longPut, shortCall, shortPut };

    const validStrategyKeys: StrategyKey[] = ["LONG_CALL", "LONG_PUT", "SHORT_CALL", "SHORT_PUT"];
    const resolvedStrategy: StrategyKey | undefined =
      typeof selectedStrategy === "string" && validStrategyKeys.includes(selectedStrategy as StrategyKey)
        ? (selectedStrategy as StrategyKey)
        : undefined;

    const qaRequest: OptionsQARequest = {
      ticker: String(ticker).toUpperCase(),
      question: String(question),
      strategies: snapshot,
      selectedStrategy: resolvedStrategy,
      currentPrice,
    };

    // ── Generar respuesta determinística ──────────────────────────────────
    const qaResponse = generateOptionsAnswer(qaRequest);

    // ── Audit log (best-effort) ───────────────────────────────────────────
    try {
      await supabaseClient.from("audit_trail").insert({
        action: "options_analysis_qa",
        details: JSON.stringify({
          ticker: qaRequest.ticker,
          intent: qaResponse.intent,
          strategyFocus: qaResponse.strategyFocus ?? null,
          question: question.slice(0, 200),
        }),
        timestamp: new Date().toISOString(),
      });
    } catch {
      // no-op — audit failures must not break the response
    }

    return res.status(200).json(qaResponse);
  });

  return router;
}
