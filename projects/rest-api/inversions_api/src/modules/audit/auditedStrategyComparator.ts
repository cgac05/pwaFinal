/**
 * T020 Integration Adapter
 * 
 * Integra saveStrategyRecommendationAudit en el flujo de T089 (strategyComparator)
 * Después de comparar estrategias, guarda ranking completo en audit table
 */

import type { OptionStrategyInput, OptionStrategyOutput } from "../strategies/optionsStrategyContract";
import type { StrategyRanking, StrategyComparisonResult } from "../strategies/strategyComparator";
import { compareStrategies } from "../strategies/strategyComparator";
import { saveStrategyRecommendationAudit } from "./strategyRecommendationAudit";

/**
 * Wrapper de strategyComparator que incluye auditoría
 */
export class AuditedStrategyComparator {
  /**
   * T089 + T020: Comparar estrategias y guardar ranking en auditoría
   */
  async compareStrategiesWithAudit(
    params: OptionStrategyInput,
    viabilityScore: number,
    userId?: string
  ): Promise<{
    comparisonResult: StrategyComparisonResult;
    auditId: string;
  }> {
    // T089: Comparar estrategias
    const comparisonResult = compareStrategies(
      params,
      viabilityScore
    ) as StrategyComparisonResult;

    // Determinar dirección hypothesis basada en params (assumption: params tiene directionHypothesis)
    const directionHypothesis = (params as any).directionHypothesis || "NEUTRAL";

    // T020b-d: Guardar ranking completo en audit table
    const strategiesRanking: StrategyRanking[] =
      comparisonResult.alternatives || [];

    const auditRecord = await saveStrategyRecommendationAudit(
      params.ticker,
      new Date(),
      viabilityScore,
      directionHypothesis,
      comparisonResult.recommendedStrategy,
      strategiesRanking,
      userId
    );

    return {
      comparisonResult,
      auditId: auditRecord.id
    };
  }
}
