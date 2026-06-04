/**
 * T089: Motor comparador de estrategias de opciones
 * 
 * Evalúa todas las estrategias (Long Call, Long Put, Short Call, Short Put)
 * y recomienda la más adecuada basada en:
 * - Retorno ajustado por riesgo
 * - Probabilidad ITM
 * - Perfil de riesgo
 * - Contexto de viabilidad fundamental
 */

import type { OptionStrategyInput, OptionStrategyOutput } from "./optionsStrategyContract";
import type { StrategyOutput } from "./standards/strategyOutputStandard";
import { evaluateLongCall } from "./options/longCall";
import { evaluateLongPut } from "./options/longPut";
import { evaluateShortCall } from "./options/shortCall";
import { evaluateShortPut } from "./options/shortPut";

/**
 * Result from comparing StrategyOutput items (for tests and ranking)
 */
export interface ComparisonResult {
  chosen: StrategyOutput | null;
  ranking: Array<{ strategy: StrategyOutput; score: number }>;
}

export interface StrategyRanking {
  strategy: OptionStrategyOutput;
  score: number; // Risk-adjusted return score
  rank: number;
  rationale: string;
}

export interface StrategyComparisonResult {
  ticker: string;
  recommendedStrategy: OptionStrategyOutput;
  alternatives: StrategyRanking[]; // All strategies ranked
  overallRationale: string;
  warnings: string[];
  comparisionVersion: string;
}

/**
 * Compare strategies with overloaded signatures
 * - Can accept StrategyOutput[] for ranking/comparison tests
 * - Can accept OptionStrategyInput for full evaluation
 */
export function compareStrategies(items: StrategyOutput[] | OptionStrategyInput, viabilityScore?: number): ComparisonResult | StrategyComparisonResult {
  // Handle StrategyOutput[] case (for tests and ranking)
  if (Array.isArray(items)) {
    const outputs = items as StrategyOutput[];
    
    if (outputs.length === 0) {
      return {
        chosen: null,
        ranking: []
      };
    }

    // Sort by confluencia_score descending
    const sorted = [...outputs].sort((a, b) => b.confluencia_score - a.confluencia_score);
    
    // Create ranking with scores
    const ranking = sorted.map((strategy) => ({
      strategy,
      score: strategy.confluencia_score
    }));

    return {
      chosen: ranking.length > 0 ? ranking[0].strategy : null,
      ranking
    };
  }

  // Handle OptionStrategyInput case (original implementation)
  return compareStrategiesOriginal(items as OptionStrategyInput, viabilityScore ?? 0.65);
}

/**
 * Original compareStrategies implementation (refactored)
 */
function compareStrategiesOriginal(
  params: OptionStrategyInput,
  viabilityScore: number = 0.65 // Fundamental viability (0-1)
): StrategyComparisonResult {
  // Validate minimum viability
  if (viabilityScore < 0.4) {
    return {
      ticker: params.ticker,
      recommendedStrategy: {} as any,
      alternatives: [],
      overallRationale: "ACTIVO NO VIABLE - Análisis fundamental insuficiente. No se recomienda ninguna estrategia.",
      warnings: [
        "Puntuación de viabilidad (${viabilityScore.toFixed(2)}) está por debajo del umbral mínimo (0.40).",
        "Require more fundamental analysis before recommending options strategies."
      ],
      comparisionVersion: "1.0"
    };
  }

  // Evaluate all strategies
  let longCallOutput: OptionStrategyOutput | undefined;
  let longPutOutput: OptionStrategyOutput | undefined;
  let shortCallOutput: OptionStrategyOutput | undefined;
  let shortPutOutput: OptionStrategyOutput | undefined;

  try {
    longCallOutput = evaluateLongCall({
      ...params,
      direction: "LONG",
      optionType: "CALL"
    });
  } catch (e) {
    // Long Call evaluation failed
  }

  try {
    longPutOutput = evaluateLongPut({
      ...params,
      direction: "LONG",
      optionType: "PUT"
    });
  } catch (e) {
    // Long Put evaluation failed
  }

  try {
    shortCallOutput = evaluateShortCall({
      ...params,
      direction: "SHORT",
      optionType: "CALL"
    });
  } catch (e) {
    // Short Call evaluation failed
  }

  try {
    shortPutOutput = evaluateShortPut({
      ...params,
      direction: "SHORT",
      optionType: "PUT"
    });
  } catch (e) {
    // Short Put evaluation failed
  }

  // Score each strategy
  const strategies: StrategyRanking[] = [];

  if (longCallOutput) {
    const score = scoreStrategy(longCallOutput, "bullish");
    strategies.push({
      strategy: longCallOutput,
      score,
      rank: 0,
      rationale: `Long Call: Risk-Adjusted Return = ${score.toFixed(2)}. Exposición directa alcista limitada.`
    });
  }

  if (longPutOutput) {
    const score = scoreStrategy(longPutOutput, "bearish");
    strategies.push({
      strategy: longPutOutput,
      score,
      rank: 0,
      rationale: `Long Put: Risk-Adjusted Return = ${score.toFixed(2)}. Protección bajista limitada.`
    });
  }

  if (shortCallOutput && viabilityScore >= 0.7) {
    // Only recommend short call if viability is HIGH
    const score = scoreStrategy(shortCallOutput, "bullish_high_vol");
    strategies.push({
      strategy: shortCallOutput,
      score,
      rank: 0,
      rationale: `Short Call: Risk-Adjusted Return = ${score.toFixed(2)}. Captura prima en volatilidad elevada. ⚠️ ALTO RIESGO.`
    });
  }

  if (shortPutOutput && viabilityScore >= 0.65) {
    // Recommend short put if viability is adequate
    const score = scoreStrategy(shortPutOutput, "bearish_moderate");
    strategies.push({
      strategy: shortPutOutput,
      score,
      rank: 0,
      rationale: `Short Put: Risk-Adjusted Return = ${score.toFixed(2)}. Captura prima en bajada. Pérdida finita.`
    });
  }

  // Rank by score (descending)
  strategies.sort((a, b) => b.score - a.score);
  strategies.forEach((s, i) => {
    s.rank = i + 1;
  });

  if (strategies.length === 0) {
    return {
      ticker: params.ticker,
      recommendedStrategy: {} as any,
      alternatives: [],
      overallRationale: "No suitable strategies available after evaluation.",
      warnings: ["All strategy evaluations failed or viability too low."],
      comparisionVersion: "1.0"
    };
  }

  const recommended = strategies[0];
  const alternatives = strategies.slice(1);

  const overallRationale = `
RECOMENDADA: ${recommended.strategy.direction} ${recommended.strategy.optionType}
${recommended.rationale}

Riesgo máximo: ${recommended.strategy.maxLoss === Infinity ? "ILIMITADO" : "$" + recommended.strategy.maxLoss.toFixed(2)}
Ganancia máxima: ${recommended.strategy.maxProfit === Infinity ? "ILIMITADA" : "$" + recommended.strategy.maxProfit.toFixed(2)}
Probabilidad ITM: ${(recommended.strategy.probabilityItm * 100).toFixed(1)}%

${alternatives.length > 0 ? "Alternativas:" : ""}
${alternatives.map(alt => `  #${alt.rank}: ${alt.rationale}`).join("\n")}
`;

  const warnings = [
    ...recommended.strategy.warnings,
    ...(viabilityScore < 0.7 ? ["Viabilidad MARGINAL. Incrementar análisis de datos."] : []),
    ...(params.daysToExpiration < 30 ? ["Menos de 30 días para expiración. Acelerar theta decay."] : [])
  ];

  return {
    ticker: params.ticker,
    recommendedStrategy: recommended.strategy,
    alternatives,
    overallRationale,
    warnings,
    comparisionVersion: "1.0"
  };
}

/**
 * Score a strategy (higher = better)
 * Takes into account risk-adjusted return, probability, and volatility
 */
function scoreStrategy(
  output: OptionStrategyOutput,
  context: "bullish" | "bearish" | "bullish_high_vol" | "bearish_moderate"
): number {
  // Base score: risk-adjusted return
  let score = output.riskAdjustedReturn;

  // Adjust for probability ITM
  if (context.includes("bullish")) {
    score *= (1 + output.probabilityItm); // Higher prob ITM is good for call buyers
  } else {
    score *= (1 + (1 - output.probabilityItm)); // Lower prob ITM is good for put sellers
  }

  // Cap infinite values
  if (!isFinite(score)) {
    score = 0.5; // Return neutral score for infinite risk
  }

  return Math.max(0, score);
}
