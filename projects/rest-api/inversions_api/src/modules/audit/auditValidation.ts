/**
 * T018-US4: Implementar herramienta de validación determinística
 * 
 * Valida que un análisis es reproducible: recalcula con los mismos datos
 * y comprueba que los scores coinciden.
 */

import type { FundamentalAnalysisData } from "../fundamental/fundamentalSourceContract";
import type { ViabilityScore } from "../fundamental/viabilityEngine";
import { ViabilityEngine } from "../fundamental/viabilityEngine";
import { getAnalysisAudit } from "./fundamentalAnalysisAudit";

/**
 * T018a: Resultado de validación determinística
 */
export interface DeterminismValidationResult {
  matches: boolean; // True si scores son idénticos
  divergencePoint?: string; // Qué métrica divergió
  original_score: number;
  recalculated_score: number;
  divergence_details?: {
    original_components: Record<string, number>;
    recalculated_components: Record<string, number>;
    differences: Record<string, number>;
  };
  message: string; // Resumen legible
}

/**
 * T018b-c: Reconstituir snapshot y re-ejecutar viabilityEngine.score()
 */
export async function validateDeterminism(
  ticker: string,
  originalDate: string // YYYY-MM-DD
): Promise<DeterminismValidationResult> {
  // Obtener snapshot de auditoría
  const auditRecord = await getAnalysisAudit(ticker, originalDate);

  if (!auditRecord) {
    return {
      matches: false,
      original_score: 0,
      recalculated_score: 0,
      message: `No audit record found for ${ticker} on ${originalDate}`
    };
  }

  // Reconstituir datos de snapshot
  const snapshot = auditRecord.snapshot_data;
  const reconstructedData: FundamentalAnalysisData = {
    ticker: auditRecord.ticker,
    companyName: snapshot.companyName || `Company ${auditRecord.ticker}`,
    metrics: {
      marketCap:
        typeof snapshot.market_cap === "number"
          ? {
              value: snapshot.market_cap,
              currency: "USD",
              timestamp: snapshot.fetchTimestamp
            }
          : undefined,
      priceHistory: snapshot.priceHistory,
      financialRatios: {
        roe: Number(snapshot.roe || 0),
        peRatio: Number(snapshot.pe_ratio || 0),
        pbRatio: 0,
        psRatio: 0,
        debtToEquity: 0,
        timestamp: snapshot.fetchTimestamp
      },
      beta:
        typeof snapshot.beta === "number"
          ? {
              value: snapshot.beta,
              confidenceLevel: "MEDIUM",
              calculationMethod: "audit_snapshot",
              timestamp: snapshot.fetchTimestamp
            }
          : undefined,
      eps:
        typeof snapshot.eps_growth === "number"
          ? {
              eps: 0,
              epsGrowthYoYPercent: snapshot.eps_growth,
              timestamp: snapshot.fetchTimestamp
            }
          : undefined,
      volatility:
        typeof snapshot.volatility_60d === "number"
          ? {
              annualizedVolatility: snapshot.volatility_60d,
              lookbackDays: 60,
              calculationMethod: "audit_snapshot",
              timestamp: snapshot.fetchTimestamp
            }
          : undefined
    },
    metadata: {
      sourceId: snapshot.source || "audit_snapshot",
      fetchTimestamp: snapshot.fetchTimestamp || auditRecord.timestamp_calculated,
      dataVersion: snapshot.dataVersion || "audit",
      assumptions: {
        volatilityCalculationMethod:
          auditRecord.assumptions.volatility_calc_method || "audit_snapshot",
        lookbackPeriod: 60,
        riskFreeRate: 0,
        marketIndexBench: "SPX"
      },
      quality: {
        completenessPercent: 100,
        lastValidation: new Date().toISOString()
      }
    }
  };

  // T018b: Re-ejecutar viabilityEngine.score() con mismos datos
  const engine = new ViabilityEngine();
  const recalculatedScore: ViabilityScore = engine.calculateViability(
    reconstructedData
  );

  // T018c: Comparar scores
  const originalScore = auditRecord.viability_score;
  const recalculatedValue = recalculatedScore.overall;

  // Permitir diferencia mínima por redondeo (0.01)
  const tolerance = 0.01;
  const matches = Math.abs(originalScore - recalculatedValue) < tolerance;

  if (matches) {
    // T018d: PASSED
    return {
      matches: true,
      original_score: originalScore,
      recalculated_score: recalculatedValue,
      message: `PASSED: Scores idénticos (${originalScore.toFixed(2)})`
    };
  }

  // T018d: DIVERGED - identificar qué métrica divergió
  const divergencePoint = identifyDivergence(
    auditRecord.calculated_metrics.componentScores,
    recalculatedScore.componentScores
  );

  return {
    matches: false,
    divergencePoint,
    original_score: originalScore,
    recalculated_score: recalculatedValue,
    divergence_details: {
      original_components: auditRecord.calculated_metrics.componentScores,
      recalculated_components: recalculatedScore.componentScores,
      differences: calculateDifferences(
        auditRecord.calculated_metrics.componentScores,
        recalculatedScore.componentScores
      )
    },
    message: `DIVERGED: Original score ${originalScore.toFixed(2)}, recalculated ${recalculatedValue.toFixed(2)} (divergence at ${divergencePoint})`
  };
}

/**
 * T018f: Identificar fuente de divergencia (data vs logic)
 */
function identifyDivergence(
  originalComponents: Record<string, number>,
  recalculatedComponents: Record<string, number>
): string {
  const keys = Object.keys(originalComponents);

  for (const key of keys) {
    const original = originalComponents[key];
    const recalculated = recalculatedComponents[key];

    const diff = Math.abs(original - recalculated);
    if (diff > 0.01) {
      return `${key} (original: ${original.toFixed(4)}, recalculated: ${recalculated.toFixed(4)})`;
    }
  }

  return "unknown";
}

/**
 * Calcular diferencias entre scores de componentes
 */
function calculateDifferences(
  original: Record<string, number>,
  recalculated: Record<string, number>
): Record<string, number> {
  const differences: Record<string, number> = {};

  for (const key of Object.keys(original)) {
    differences[key] = recalculated[key] - original[key];
  }

  return differences;
}

/**
 * T018e: Endpoint GET /api/team-03/audit/{ticker}/{dateIso}/validate
 * Esta función es el handler del endpoint
 */
export async function handleValidationRequest(
  ticker: string,
  dateIso: string
): Promise<{ validation: DeterminismValidationResult }> {
  const validation = await validateDeterminism(ticker, dateIso);
  return { validation };
}
