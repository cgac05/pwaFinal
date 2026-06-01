import type { OptionStrategyContract, OptionStrategyOutput } from "./optionsStrategyContract";
import { buildOptionStrategyCandidates } from "./optionsStrategyService";

export interface StrategyRecommendation {
  selected: OptionStrategyOutput | null;
  candidates: OptionStrategyOutput[];
  warning?: string;
}

export function rankOptionStrategies(
  params: OptionStrategyContract,
  viabilityScore: number
): StrategyRecommendation {
  const candidates = buildOptionStrategyCandidates(params);
  const normalizedScore = Number.isFinite(viabilityScore) ? viabilityScore : 0;

  if (normalizedScore < 0.25) {
    return {
      selected: null,
      candidates,
      warning: "Viability score bajo. No se recomienda abrir una estrategia direccional sin mas confirmacion."
    };
  }

  const sorted = [...candidates].sort((a, b) => {
    const aRisk = Number.isFinite(a.maxLoss) ? a.maxLoss : Number.MAX_SAFE_INTEGER;
    const bRisk = Number.isFinite(b.maxLoss) ? b.maxLoss : Number.MAX_SAFE_INTEGER;
    return b.riskAdjustedReturn - a.riskAdjustedReturn || aRisk - bRisk;
  });

  return {
    selected: sorted[0] ?? null,
    candidates: sorted
  };
}
