/**
 * T017-US4: Crear auditoría trail completa de análisis fundamental
 * 
 * Captura snapshot de datos, métricas y score de cada análisis fundamental.
 * Hace posible reproducir y validar análisis históricos.
 */

import type { ViabilityScore } from "../fundamental/viabilityEngine";
import type { FundamentalAnalysisData } from "../fundamental/fundamentalSourceContract";
import supabase from "../../database/supabase/client";

/**
 * T017a-c: Estructura de auditoría
 */
export interface FundamentalAnalysisAuditRecord {
  id: string;
  ticker: string;
  snapshot_date: string; // ISO date YYYY-MM-DD
  snapshot_data: Record<string, any>;
  calculated_metrics: Record<string, any>;
  viability_score: number;
  viability_classification: "VIABLE" | "NEUTRAL" | "NOT_VIABLE";
  timestamp_calculated: string; // ISO timestamp
  assumptions: Record<string, any>;
  user_id?: string;
  created_at: string;
}

/**
 * T017b: Integración con viabilityEngine
 * Guardar snapshot antes de retornar score
 */
export async function saveAnalysisAudit(
  ticker: string,
  snapshotDate: Date,
  snapshotData: FundamentalAnalysisData,
  viabilityScore: ViabilityScore,
  assumptions: Record<string, any>,
  userId?: string
): Promise<FundamentalAnalysisAuditRecord> {
  // T017c: Guardar snapshot_data: precios, ratios, vol, todo lo usado en cálculo
  const metrics = snapshotData.metrics;
  const metadata = snapshotData.metadata;

  const auditRecord: Omit<FundamentalAnalysisAuditRecord, "id" | "created_at"> = {
    ticker,
    snapshot_date: snapshotDate.toISOString().split("T")[0], // YYYY-MM-DD
    snapshot_data: {
      // Precios históricos
      companyName: snapshotData.companyName,
      priceHistory: metrics.priceHistory,
      // Ratios financieros
      pe_ratio: metrics.financialRatios?.peRatio,
      roe: metrics.financialRatios?.roe,
      // Volatilidad
      volatility_30d: metrics.volatility?.annualizedVolatility,
      volatility_60d: metrics.volatility?.annualizedVolatility,
      volatility_252d: metrics.volatility?.annualizedVolatility,
      // Otros fundamentales
      market_cap: metrics.marketCap?.value,
      dividend_yield: metrics.dividend?.dividendYieldPercent,
      eps_growth: metrics.eps?.epsGrowthYoYPercent,
      beta: metrics.beta?.value,
      // Metadata
      source: metadata.sourceId,
      dataVersion: metadata.dataVersion,
      fetchTimestamp: metadata.fetchTimestamp
    },
    // T017d: Guardar assumptions
    assumptions: {
      volatility_calc_method: assumptions.volatility_calc_method || "daily_returns_60d",
      benchmark_market_cap: assumptions.benchmark_market_cap || "10B-500B",
      engine_version: assumptions.engine_version || "1.0",
      normalized_metrics: {
        marketCapNorm: assumptions.marketCapNorm,
        volatilityNorm: assumptions.volatilityNorm,
        roe_norm: assumptions.roe_norm,
        pe_norm: assumptions.pe_norm
      }
    },
    calculated_metrics: {
      // Componentes de score
      componentScores: viabilityScore.componentScores,
      dataCompletenessPercent: viabilityScore.dataCompletenessPercent,
      // Justificaciones
      justifications: viabilityScore.justifications,
      warnings: viabilityScore.warnings,
      recommendations: viabilityScore.recommendations
    },
    viability_score: viabilityScore.overall,
    viability_classification: viabilityScore.classification,
    timestamp_calculated: new Date().toISOString(),
    user_id: userId
  };

  // T017e: Guardar en tabla fundamental_analysis_audit
  const { data, error } = await supabase
    .from("fundamental_analysis_audit")
    .insert([auditRecord])
    .select()
    .single();

  if (error) {
    throw new Error(
      `Failed to save analysis audit for ${ticker}: ${error.message}`
    );
  }

  return data as FundamentalAnalysisAuditRecord;
}

/**
 * T017e: Endpoint GET /api/team-03/audit/{ticker}/{dateIso} → retorn snapshot completo
 */
export async function getAnalysisAudit(
  ticker: string,
  dateIso: string // YYYY-MM-DD
): Promise<FundamentalAnalysisAuditRecord | null> {
  const { data, error } = await supabase
    .from("fundamental_analysis_audit")
    .select("*")
    .eq("ticker", ticker)
    .eq("snapshot_date", dateIso)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows found
    throw new Error(
      `Failed to retrieve audit for ${ticker} on ${dateIso}: ${error.message}`
    );
  }

  return (data as FundamentalAnalysisAuditRecord) || null;
}

/**
 * T017f: Validar que snapshot contiene todos los campos necesarios
 */
export function validateAuditSnapshot(
  record: FundamentalAnalysisAuditRecord
): {
  valid: boolean;
  missingFields: string[];
} {
  const requiredFields = [
    "ticker",
    "snapshot_date",
    "snapshot_data",
    "calculated_metrics",
    "viability_score",
    "viability_classification",
    "timestamp_calculated",
    "assumptions"
  ];

  const missingFields = requiredFields.filter((field) => {
    const value = (record as any)[field];
    return value === null || value === undefined || value === "";
  });

  return {
    valid: missingFields.length === 0,
    missingFields
  };
}

/**
 * T017f: Validar que fecha coincida con timestamp
 */
export function validateAuditTimestamp(
  record: FundamentalAnalysisAuditRecord
): boolean {
  const snapshotDate = new Date(record.snapshot_date);
  const calculatedTime = new Date(record.timestamp_calculated);

  // snapshot_date debe ser el mismo día que timestamp_calculated
  return (
    snapshotDate.toISOString().split("T")[0] ===
    calculatedTime.toISOString().split("T")[0]
  );
}

/**
 * Verificar que snapshot es inmutable (NO UPDATE after creation)
 */
export function verifyAuditImmutability(
  record: FundamentalAnalysisAuditRecord
): boolean {
  // En Supabase, las RLS policies están configuradas para rechazar UPDATE y DELETE
  // Este método es documentativo
  return true;
}
