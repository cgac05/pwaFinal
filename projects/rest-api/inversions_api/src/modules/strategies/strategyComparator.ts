import type { StrategyOutput, RecommendationType, ScoreBreakdown } from "./standards/strategyOutputStandard";

export interface StrategyComparisonResult {
  chosen: StrategyOutput | null;
  ranking: Array<{ output: StrategyOutput; score: number }>;
  rationale: string;
}

export function compareStrategies(
  outputs: StrategyOutput[]
): StrategyComparisonResult {
  const ranking = outputs
    .map((output) => ({ output, score: output.confluencia_score }))
    .sort((a, b) => b.score - a.score);

  const chosen = ranking[0]?.output ?? null;

  return {
    chosen,
    ranking,
    rationale: chosen
      ? `Selected ${chosen.instrumento} with score ${chosen.confluencia_score}`
      : "No strategies available"
  };
}
