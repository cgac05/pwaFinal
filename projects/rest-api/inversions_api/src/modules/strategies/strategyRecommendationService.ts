import { createStrategyOutput, RecommendationType, ConfidenceLevel, StrategySource } from "./standards/strategyOutputStandard";
import type { OptionStrategyContract, OptionStrategyResult } from "./optionsStrategyContract";
import { buildOptionStrategyCandidates } from "./optionsStrategyService";
import { compareStrategies } from "./strategyComparator";

export interface RankedStrategyRecommendation {
  outputId: string;
  ticker: string;
  optionType: OptionStrategyResult["optionType"];
  direction: OptionStrategyResult["direction"];
  score: number; // confluencia_score
  expectedReturn: number;
  riskAdjustedReturn: number;
  maxLoss: number;
  recommendation: RecommendationType;
  justification: string;
}

export interface StrategyRecommendationResult {
  chosen: RankedStrategyRecommendation | null;
  alternative?: RankedStrategyRecommendation;
  ranking: RankedStrategyRecommendation[];
  warning?: string;
}

const MARGINAL_VIABILITY_THRESHOLD = 0.55;

function approximateProfitAtPrice(candidate: OptionStrategyResult, price: number): number {
  // Use payoffProfile if available
  if (candidate.payoffProfile && candidate.payoffProfile.length > 0) {
    let closest = candidate.payoffProfile[0];
    for (const point of candidate.payoffProfile) {
      if (Math.abs(point.price - price) < Math.abs(closest.price - price)) {
        closest = point;
      }
    }
    return closest.profitLoss;
  }
  
  // Fall back to scenario-based estimation
  const atPrice = candidate.scenarioAtm?.priceAtScenario ?? candidate.breakEvenPrice;
  const atPnL = candidate.scenarioAtm?.profitLoss ?? 0;
  
  if (price >= atPrice) {
    // Interpolate between ATM and +5%
    const plus5Price = candidate.scenarioPlus5?.priceAtScenario ?? (atPrice * 1.05);
    const plus5PnL = candidate.scenarioPlus5?.profitLoss ?? 0;
    const ratio = (plus5Price - atPrice) > 0 ? (price - atPrice) / (plus5Price - atPrice) : 0;
    return atPnL + ratio * (plus5PnL - atPnL);
  } else {
    // Interpolate between -5% and ATM
    const minus5Price = candidate.scenarioMinus5?.priceAtScenario ?? (atPrice * 0.95);
    const minus5PnL = candidate.scenarioMinus5?.profitLoss ?? 0;
    const ratio = (atPrice - minus5Price) > 0 ? (price - minus5Price) / (atPrice - minus5Price) : 0;
    return minus5PnL + ratio * (atPnL - minus5PnL);
  }
}

function scoreCandidate(
  candidate: OptionStrategyResult,
  params: OptionStrategyContract
): { expectedReturn: number; riskAdjustedReturn: number; recommendation: RecommendationType; justification: string } {
  // Normalize direction for comparison
  const paramDirection = (params.direction || "").toLowerCase();
  const priceTarget = paramDirection === "long" ? params.strikePrice * 1.05 : params.strikePrice * 0.95;
  const expectedReturn = approximateProfitAtPrice(candidate, priceTarget);
  const risk = candidate.maxLoss === Number.POSITIVE_INFINITY ? 1_000_000 : Math.max(1, candidate.maxLoss);
  const riskAdjustedReturn = expectedReturn / risk;

  const recommendation = paramDirection === "long" ? RecommendationType.COMPRA : RecommendationType.VENTA;
  const justification = `Basado en el perfil ${candidate.optionType}-${candidate.direction}, el retorno esperado a precio objetivo ${priceTarget.toFixed(2)} es ${expectedReturn.toFixed(2)} y el riesgo ajustado es ${riskAdjustedReturn.toFixed(4)}.`;

  return { expectedReturn, riskAdjustedReturn, recommendation, justification };
}

export function rankOptionStrategies(
  params: OptionStrategyContract,
  viabilityScore = 1
): StrategyRecommendationResult {
  if (viabilityScore < MARGINAL_VIABILITY_THRESHOLD) {
    return {
      chosen: null,
      ranking: [],
      warning: "Viabilidad insuficiente para recomendar una estrategia de opciones."
    };
  }

  const candidates = buildOptionStrategyCandidates(params);
  const outputs = candidates.map((candidate) => {
    const { expectedReturn, riskAdjustedReturn, recommendation, justification } = scoreCandidate(candidate, params);
    const strategyOutput = createStrategyOutput(
      StrategySource.FUNDAMENTAL,
      candidate.ticker,
      recommendation,
      Math.min(1, Math.max(0, 0.5 + riskAdjustedReturn * 2)),
      ConfidenceLevel.MEDIA,
      {
        total: Math.min(1, Math.max(0, 0.5 + riskAdjustedReturn * 2)),
        componentes: {
          fundamental: 0.5,
          tecnico: 0.2,
          confluence: 0,
          mecanico: 0.1,
          machine_learning: 0.2
        },
        razon: justification,
        num_estrategias_coincidentes: 1,
        num_estrategias_conflictivas: 0
      },
      [
        {
          tipo: "nivel_riesgo",
          datos: {
            expectedReturn,
            riskAdjustedReturn,
            maxLoss: candidate.maxLoss,
            requiredMargin: candidate.requiredMargin
          },
          fuente: "STRATEGY_COMPARATOR",
          capturada_en: new Date(),
          confianza: 0.75
        }
      ],
      `${params.ticker}-${candidate.optionType}-${candidate.direction}`
    );

    return {
      candidate,
      output: strategyOutput,
      expectedReturn,
      riskAdjustedReturn,
      justification
    };
  });

  const comparison = compareStrategies(outputs.map((item) => item.output));
  const ranking = outputs
    .map((item) => ({
      outputId: item.output.id,
      ticker: item.candidate.ticker,
      optionType: item.candidate.optionType,
      direction: item.candidate.direction,
      score: item.output.confluencia_score,
      expectedReturn: item.expectedReturn,
      riskAdjustedReturn: item.riskAdjustedReturn,
      maxLoss: item.candidate.maxLoss,
      recommendation: item.output.tipo_recomendacion,
      justification: item.justification
    }))
    .sort((a, b) => b.score - a.score);

  const chosen = ranking[0] ?? null;
  const alternative = ranking[1];

  return { chosen, alternative, ranking };
}
