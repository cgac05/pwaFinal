/**
 * T005-T079: Motor de viabilidad de inversión fundamental
 * Implementa scorecard ponderado, normalización, scoring y justificación.
 *
 * T005-T079: Fundamental investment viability engine
 * Implements weighted scorecard, normalization, scoring, and justification.
 */

import type { FundamentalAnalysisData } from "./fundamentalSourceContract";

/**
 * T005a: Pesos del scorecard ponderado
 */
export const SCORECARD_WEIGHTS = {
  marketCap: 0.15, // 15%
  dividendHistory: 0.1, // 10%
  roe: 0.2, // 20%
  peRatio: 0.15, // 15%
  volatility: 0.2, // 20%
  beta: 0.1, // 10%
  epsGrowth: 0.1 // 10%
} as const;

/**
 * Benchmarks para normalización de cada métrica
 */
export const BENCHMARKS = {
  marketCap: {
    min: 1_000_000_000, // $1B
    max: 3_000_000_000_000 // $3T
  },
  dividendYield: {
    min: 0,
    max: 8 // 8% max yield
  },
  roe: {
    min: 0,
    max: 100 // 0-100%
  },
  peRatio: {
    min: 5,
    max: 50 // P/E range
  },
  volatility: {
    min: 5, // 5% min vol
    max: 80 // 80% max vol
  },
  beta: {
    min: 0.5,
    max: 2.5
  },
  epsGrowth: {
    min: -50, // -50% to +50%
    max: 50
  }
};

/**
 * Resultado de scoring de viabilidad
 */
export interface ViabilityScore {
  overall: number; // 0-1
  classification: "VIABLE" | "NEUTRAL" | "NOT_VIABLE";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  dataCompletenessPercent: number;
  componentScores: {
    marketCap: number;
    dividendHistory: number;
    roe: number;
    peRatio: number;
    volatility: number;
    beta: number;
    epsGrowth: number;
  };
  justifications: {
    [key: string]: string; // Explicación por atributo
  };
  recommendations: string[];
  warnings: string[];
}

export class ViabilityEngine {
  /**
   * T005b: Normalizar métrica a rango [0, 1]
   * Aplica transformación lineal con clipping a boundaries
   */
  normalize(value: number, min: number, max: number): number {
    if (min === max) {
      return 0.5; // Caso degenerado
    }

    const normalized = (value - min) / (max - min);
    // Clip a [0, 1]
    return Math.max(0, Math.min(1, normalized));
  }

  /**
   * Calcular score de viabilidad general
   */
  calculateViability(data: FundamentalAnalysisData): ViabilityScore {
    const componentScores = this.calculateComponentScores(data);
    const overallScore = this.calculateWeightedScore(componentScores);
    const confidence = this.calculateConfidence(data);
    const dataCompletenessPercent = this.calculateDataCompleteness(data);

    // T005c: Clasificación basada en score
    let classification: "VIABLE" | "NEUTRAL" | "NOT_VIABLE";
    if (overallScore >= 0.65) {
      classification = "VIABLE";
    } else if (overallScore >= 0.4) {
      classification = "NEUTRAL";
    } else {
      classification = "NOT_VIABLE";
    }

    // T005d: Generar justificaciones
    const justifications = this.generateJustifications(data, componentScores);

    // T005e: Validar que confidence >= MEDIUM
    const recommendations = this.generateRecommendations(data, classification, confidence);
    const warnings = this.generateWarnings(data, confidence);

    return {
      overall: Math.round(overallScore * 1000) / 1000,
      classification,
      confidence,
      dataCompletenessPercent,
      componentScores: {
        marketCap: Math.round(componentScores.marketCap * 1000) / 1000,
        dividendHistory: Math.round(componentScores.dividendHistory * 1000) / 1000,
        roe: Math.round(componentScores.roe * 1000) / 1000,
        peRatio: Math.round(componentScores.peRatio * 1000) / 1000,
        volatility: Math.round(componentScores.volatility * 1000) / 1000,
        beta: Math.round(componentScores.beta * 1000) / 1000,
        epsGrowth: Math.round(componentScores.epsGrowth * 1000) / 1000
      },
      justifications,
      recommendations,
      warnings
    };
  }

  /**
   * Calcular scores de componentes individuales
   */
  private calculateComponentScores(
    data: FundamentalAnalysisData
  ): Record<string, number> {
    const scores: Record<string, number> = {
      marketCap: 0.5,
      dividendHistory: 0.5,
      roe: 0.5,
      peRatio: 0.5,
      volatility: 0.5,
      beta: 0.5,
      epsGrowth: 0.5
    };

    // Market Cap
    if (data.metrics.marketCap) {
      scores.marketCap = this.normalize(
        data.metrics.marketCap.value,
        BENCHMARKS.marketCap.min,
        BENCHMARKS.marketCap.max
      );
    }

    // Dividend History (usando dividend yield)
    if (data.metrics.dividend) {
      scores.dividendHistory = this.normalize(
        data.metrics.dividend.dividendYieldPercent,
        BENCHMARKS.dividendYield.min,
        BENCHMARKS.dividendYield.max
      );
    }

    // ROE (Return on Equity)
    if (data.metrics.financialRatios?.roe !== undefined) {
      scores.roe = this.normalize(
        data.metrics.financialRatios.roe,
        BENCHMARKS.roe.min,
        BENCHMARKS.roe.max
      );
    }

    // P/E Ratio (inverso: menor P/E es mejor)
    if (data.metrics.financialRatios?.peRatio !== undefined) {
      const peScore = 1 - this.normalize(
        data.metrics.financialRatios.peRatio,
        BENCHMARKS.peRatio.min,
        BENCHMARKS.peRatio.max
      );
      scores.peRatio = peScore;
    }

    // Volatility (menor vol es mejor)
    if (data.metrics.volatility) {
      const volScore = 1 - this.normalize(
        data.metrics.volatility.annualizedVolatility,
        BENCHMARKS.volatility.min,
        BENCHMARKS.volatility.max
      );
      scores.volatility = volScore;
    }

    // Beta (más cercano a 1 es mejor)
    if (data.metrics.beta) {
      const betaDeviation = Math.abs(data.metrics.beta.value - 1.0);
      const betaScore = 1 - Math.min(betaDeviation / 1.5, 1.0);
      scores.beta = betaScore;
    }

    // EPS Growth
    if (data.metrics.eps?.epsGrowthYoYPercent !== undefined) {
      scores.epsGrowth = this.normalize(
        data.metrics.eps.epsGrowthYoYPercent,
        BENCHMARKS.epsGrowth.min,
        BENCHMARKS.epsGrowth.max
      );
    }

    return scores;
  }

  /**
   * Calcular score ponderado
   */
  private calculateWeightedScore(componentScores: Record<string, number>): number {
    let totalScore = 0;
    let totalWeight = 0;

    Object.entries(SCORECARD_WEIGHTS).forEach(([key, weight]) => {
      totalScore += componentScores[key] * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? totalScore / totalWeight : 0.5;
  }

  /**
   * T005e: Calcular confidence score basado en completitud de datos
   * 100% datos → HIGH, 70-99% → MEDIUM, <70% → LOW
   */
  private calculateConfidence(data: FundamentalAnalysisData): "HIGH" | "MEDIUM" | "LOW" {
    const completeness = this.calculateDataCompleteness(data);

    if (completeness >= 100) {
      return "HIGH";
    } else if (completeness >= 70) {
      return "MEDIUM";
    } else {
      return "LOW";
    }
  }

  /**
   * Calcular porcentaje de completitud de datos
   */
  private calculateDataCompleteness(data: FundamentalAnalysisData): number {
    const metricsCount = Object.keys(data.metrics).length;
    const populatedCount = Object.values(data.metrics).filter((m) => m !== undefined)
      .length;

    if (metricsCount === 0) return 0;
    return Math.round((populatedCount / metricsCount) * 100);
  }

  /**
   * T005d: Generar justificaciones por atributo
   * Explicaciones comprensibles sin jerga técnica
   */
  private generateJustifications(
    data: FundamentalAnalysisData,
    componentScores: Record<string, number>
  ): Record<string, string> {
    const justifications: Record<string, string> = {};

    // Market Cap
    if (data.metrics.marketCap) {
      const marketCap = data.metrics.marketCap.value;
      const marketCapBillions = marketCap / 1_000_000_000;

      if (marketCapBillions > 500) {
        justifications.marketCap = `Empresa grande y establecida (${marketCapBillions.toFixed(0)}B USD). Excelente base fundamental.`;
      } else if (marketCapBillions > 50) {
        justifications.marketCap = `Empresa de tamaño medio (${marketCapBillions.toFixed(0)}B USD). Bien posicionada.`;
      } else {
        justifications.marketCap = `Empresa pequeña (${marketCapBillions.toFixed(0)}B USD). Más riesgo pero potencial.`;
      }
    }

    // P/E Ratio
    if (data.metrics.financialRatios?.peRatio !== undefined) {
      const pe = data.metrics.financialRatios.peRatio;
      if (pe < 15) {
        justifications.peRatio = `P/E bajo (${pe.toFixed(1)}). Podría estar subvaluada.`;
      } else if (pe < 25) {
        justifications.peRatio = `P/E moderado (${pe.toFixed(1)}). Valuación razonable.`;
      } else {
        justifications.peRatio = `P/E elevado (${pe.toFixed(1)}). Precio alto relativo a ganancias.`;
      }
    }

    // ROE
    if (data.metrics.financialRatios?.roe !== undefined) {
      const roe = data.metrics.financialRatios.roe;
      if (roe > 15) {
        justifications.roe = `ROE fuerte (${roe.toFixed(1)}%). La empresa genera buenas ganancias con su capital.`;
      } else if (roe > 8) {
        justifications.roe = `ROE moderada (${roe.toFixed(1)}%). Desempeño aceptable.`;
      } else {
        justifications.roe = `ROE débil (${roe.toFixed(1)}%). La empresa no es muy eficiente con su capital.`;
      }
    }

    // Volatility
    if (data.metrics.volatility) {
      const vol = data.metrics.volatility.annualizedVolatility;
      if (vol < 20) {
        justifications.volatility = `Baja volatilidad (${vol.toFixed(1)}%). Stock estable.`;
      } else if (vol < 40) {
        justifications.volatility = `Volatilidad moderada (${vol.toFixed(1)}%). Variabilidad normal.`;
      } else {
        justifications.volatility = `Alta volatilidad (${vol.toFixed(1)}%). Movimientos grandes de precio.`;
      }
    }

    // Dividend
    if (data.metrics.dividend) {
      const yield_ = data.metrics.dividend.dividendYieldPercent;
      if (yield_ > 0) {
        justifications.dividendHistory = `Dividendo consistente (${yield_.toFixed(2)}% yield). Buena para ingresos.`;
      } else {
        justifications.dividendHistory = `No paga dividendos. Potencial de reinversión de ganancias.`;
      }
    }

    return justifications;
  }

  /**
   * Generar recomendaciones
   */
  private generateRecommendations(
    data: FundamentalAnalysisData,
    classification: string,
    confidence: string
  ): string[] {
    const recs: string[] = [];

    if (classification === "VIABLE") {
      recs.push("Activo viable para análisis de estrategias de opciones.");
      if (confidence === "HIGH") {
        recs.push("Datos completos y confiables para análisis detallado.");
      }
    } else if (classification === "NEUTRAL") {
      recs.push("Activo neutral. Evaluar contexto de mercado adicional.");
    } else {
      recs.push("Activo no viable en este momento. Considere alternativas.");
    }

    if (data.metrics.volatility && data.metrics.volatility.annualizedVolatility > 50) {
      recs.push("Alta volatilidad: considere estrategias defensivas (protective puts).");
    }

    return recs;
  }

  /**
   * T005e: Generar warnings
   */
  private generateWarnings(
    data: FundamentalAnalysisData,
    confidence: string
  ): string[] {
    const warnings: string[] = [];

    if (confidence === "LOW") {
      warnings.push("⚠️ Datos incompletos. Análisis tiene baja confiabilidad.");
    }

    // Detectar penny stocks
    if (data.metrics.marketCap && data.metrics.marketCap.value < 300_000_000) {
      warnings.push("⚠️ Empresa pequeña (< $300M). Alto riesgo de volatilidad extrema.");
    }

    // Detectar IPO reciente
    if (data.metadata.fetchTimestamp) {
      const fetchDate = new Date(data.metadata.fetchTimestamp);
      const now = new Date();
      const daysSinceFetch = (now.getTime() - fetchDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceFetch < 30) {
        warnings.push("⚠️ IPO reciente (< 30 días). Datos históricos limitados.");
      }
    }

    return warnings;
  }
}
