/**
 * T020-US4: Implementar cadena de trazabilidad estrategia
 * 
 * Captura ranking completo de estrategias evaluadas, reasoning y scoring.
 * Hace reproducible la selección de estrategia.
 */

import supabase from "../../database/supabase/client";
import type { OptionStrategyOutput } from "../strategies/optionsStrategyContract";
import type { StrategyRanking } from "../strategies/strategyComparator";

function getStrategyLabel(strategy: OptionStrategyOutput): string {
  const direction = strategy.direction === "LONG" ? "Long" : "Short";
  const optionType = strategy.optionType === "CALL" ? "Call" : "Put";
  return `${direction} ${optionType}`;
}

/**
 * T020a: Estructura de auditoría de recomendación de estrategia
 */
export interface StrategyRecommendationAuditRecord {
  id: string;
  ticker: string;
  analysis_date: string; // YYYY-MM-DD
  fundamental_viability_score: number;
  direction_hypothesis: "BULLISH" | "BEARISH" | "NEUTRAL";
  comparator_results: StrategyRankingAudit[];
  top_recommended_strategy: string; // "Long Call", "Long Put", "Short Call", "Short Put"
  reasoning: string;
  timestamp: string;
  user_id?: string;
  created_at: string;
}

/**
 * T020c: Estructura de cada estrategia en el ranking
 */
export interface StrategyRankingAudit {
  strategy: string;
  rank: number;
  score: number;
  rationale: string;
  scenarios?: {
    atm?: number;
    itm?: number;
    otm?: number;
  };
  risks?: string[];
}

/**
 * T020b: Integrar en T089 (strategyComparator): guardar full ranking
 */
export async function saveStrategyRecommendationAudit(
  ticker: string,
  analysisDate: Date,
  fundamentalViabilityScore: number,
  directionHypothesis: "BULLISH" | "BEARISH" | "NEUTRAL",
  recommendedStrategy: OptionStrategyOutput,
  strategiesRanking: StrategyRanking[],
  userId?: string
): Promise<StrategyRecommendationAuditRecord> {
  // T020c: Guardar full ranking, reasoning para cada estrategia
  const comparatorResults: StrategyRankingAudit[] = strategiesRanking.map(
    (ranking, index) => ({
      strategy: getStrategyLabel(ranking.strategy),
      rank: index + 1,
      score: ranking.score,
      rationale: ranking.rationale,
      scenarios: {
        atm: ranking.strategy.scenarioAtm?.profitLoss,
        itm: ranking.strategy.scenarioPlus5?.profitLoss,
        otm: ranking.strategy.scenarioMinus5?.profitLoss
      },
      risks: ranking.strategy.warnings || []
    })
  );

  const auditRecord: Omit<
    StrategyRecommendationAuditRecord,
    "id" | "created_at"
  > = {
    ticker,
    analysis_date: analysisDate.toISOString().split("T")[0], // YYYY-MM-DD
    fundamental_viability_score: fundamentalViabilityScore,
    direction_hypothesis: directionHypothesis,
    comparator_results: comparatorResults,
    top_recommended_strategy: getStrategyLabel(recommendedStrategy),
    reasoning: buildReasoningNarrative(
      recommendedStrategy,
      strategiesRanking,
      directionHypothesis,
      fundamentalViabilityScore
    ),
    timestamp: new Date().toISOString(),
    user_id: userId
  };

  // Guardar en tabla strategy_recommendation_audit
  const { data, error } = await supabase
    .from("strategy_recommendation_audit")
    .insert([auditRecord])
    .select()
    .single();

  if (error) {
    throw new Error(
      `Failed to save strategy audit for ${ticker}: ${error.message}`
    );
  }

  return data as StrategyRecommendationAuditRecord;
}

/**
 * Construir narrativa de reasoning para auditoría
 */
function buildReasoningNarrative(
  recommendedStrategy: OptionStrategyOutput,
  strategiesRanking: StrategyRanking[],
  direction: string,
  viabilityScore: number
): string {
  const topStrategies = strategiesRanking
    .slice(0, 3)
    .map((r) => `${getStrategyLabel(r.strategy)} (score: ${r.score.toFixed(2)})`)
    .join(", ");

  return (
    `Strategy recommended based on fundamental viability (${viabilityScore.toFixed(2)}) ` +
    `and ${direction} direction hypothesis. ` +
    `Top ranked strategies: ${topStrategies}. ` +
    `Selected: ${getStrategyLabel(recommendedStrategy)} due to optimal risk-adjusted return profile.`
  );
}

/**
 * T020d: Endpoint GET /api/team-03/audit/{ticker}/{dateIso}/strategy
 */
export async function getStrategyRecommendationAudit(
  ticker: string,
  dateIso: string // YYYY-MM-DD
): Promise<StrategyRecommendationAuditRecord | null> {
  const { data, error } = await supabase
    .from("strategy_recommendation_audit")
    .select("*")
    .eq("ticker", ticker)
    .eq("analysis_date", dateIso)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows found
    throw new Error(
      `Failed to retrieve strategy audit for ${ticker} on ${dateIso}: ${error.message}`
    );
  }

  return (data as StrategyRecommendationAuditRecord) || null;
}

/**
 * T020e: Validar que audit contiene todas estrategias evaluadas y seus scores
 */
export function validateStrategyAuditCompleteness(
  record: StrategyRecommendationAuditRecord
): {
  valid: boolean;
  missingStrategies: string[];
  totalEvaluated: number;
  message: string;
} {
  const requiredStrategies = [
    "Long Call",
    "Long Put",
    "Short Call",
    "Short Put"
  ];

  const evaluatedStrategies = record.comparator_results
    .map((r) => r.strategy)
    .sort();
  const missing = requiredStrategies.filter(
    (s) => !evaluatedStrategies.includes(s)
  );

  return {
    valid: missing.length === 0,
    missingStrategies: missing,
    totalEvaluated: record.comparator_results.length,
    message:
      missing.length === 0
        ? `All 4 strategies evaluated and scored`
        : `Missing ${missing.join(", ")} from evaluation`
  };
}

/**
 * Verificar que estrategia recomendada es determinística dada los mismos datos + dirección
 */
export function validateStrategyDeterminism(
  audit1: StrategyRecommendationAuditRecord,
  audit2: StrategyRecommendationAuditRecord
): {
  deterministic: boolean;
  message: string;
} {
  // Misma dirección y viabilidad → debe dar misma recomendación
  const sameCriteria =
    audit1.direction_hypothesis === audit2.direction_hypothesis &&
    Math.abs(
      audit1.fundamental_viability_score - audit2.fundamental_viability_score
    ) < 0.01;

  const sameRecommendation =
    audit1.top_recommended_strategy === audit2.top_recommended_strategy;

  return {
    deterministic: !sameCriteria || sameRecommendation,
    message: sameCriteria
      ? sameRecommendation
        ? "Recommendation is deterministic: same inputs → same output"
        : `Recommendation diverged: ${audit1.top_recommended_strategy} vs ${audit2.top_recommended_strategy}`
      : "Cannot compare: different input criteria"
  };
}
