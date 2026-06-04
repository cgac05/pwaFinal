/**
 * T017 Integration Adapter
 * 
 * Integra saveAnalysisAudit en el flujo de T005 (viabilityEngine)
 * Antes de retornar score, guarda snapshot en audit table
 */

import type { FundamentalAnalysisData } from "../fundamental/fundamentalSourceContract";
import type { ViabilityScore } from "../fundamental/viabilityEngine";
import { ViabilityEngine } from "../fundamental/viabilityEngine";
import { saveAnalysisAudit } from "./fundamentalAnalysisAudit";

/**
 * Wrapper de ViabilityEngine que incluye auditoría
 */
export class AuditedViabilityEngine {
  private engine: ViabilityEngine;

  constructor() {
    this.engine = new ViabilityEngine();
  }

  /**
   * T005 + T017: Calcular viabilidad y guardar snapshot en auditoría
   */
  async calculateViabilityWithAudit(
    data: FundamentalAnalysisData,
    userId?: string
  ): Promise<{
    viabilityScore: ViabilityScore;
    auditId: string;
  }> {
    // T005: Calcular score de viabilidad
    const viabilityScore = this.engine.calculateViability(data);

    // T017b-d: Guardar snapshot en audit table
    const assumptions = {
      volatility_calc_method: "daily_returns_60d",
      benchmark_market_cap: "10B-500B",
      engine_version: "1.0",
      marketCapNorm: this.engine.normalize(
        data.metrics.marketCap?.value || 0,
        1000000000,
        3000000000000
      ),
      volatilityNorm: this.engine.normalize(
        data.metrics.volatility?.annualizedVolatility || 0,
        5,
        80
      ),
      roe_norm: this.engine.normalize(data.metrics.financialRatios?.roe || 0, 0, 100),
      pe_norm: this.engine.normalize(data.metrics.financialRatios?.peRatio || 0, 5, 50)
    };

    const auditRecord = await saveAnalysisAudit(
      data.ticker,
      new Date(),
      data,
      viabilityScore,
      assumptions,
      userId
    );

    return {
      viabilityScore,
      auditId: auditRecord.id
    };
  }
}
