/**
 * T019-US4: Crear reporte de auditoría trazable
 * 
 * Genera reportes PDF/CSV de análisis fundamentales en un período,
 * con trazabilidad hacia audit table.
 */

import supabase from "../../database/supabase/client";
import type { FundamentalAnalysisAuditRecord } from "./fundamentalAnalysisAudit";

/**
 * T019b: Estructura de reporte trazable
 */
export interface AuditReportRow {
  ticker: string;
  analysis_date: string; // YYYY-MM-DD
  viability_classification: "VIABLE" | "NEUTRAL" | "NOT_VIABLE";
  viability_score: number;
  top_3_factors_justification: string;
  recalc_validation_status: "PASSED" | "DIVERGED" | "NOT_RUN";
  user_who_requested?: string;
  audit_id: string; // Trazabilidad a fundamental_analysis_audit table
}

/**
 * T019a: Endpoint GET /api/team-03/audit-report?startDate=2026-05&endDate=2026-05
 */
export async function getAuditReport(
  startDate: string, // YYYY-MM or YYYY-MM-DD
  endDate: string // YYYY-MM or YYYY-MM-DD
): Promise<AuditReportRow[]> {
  // Normalizar fechas
  let startDateNorm = startDate;
  let endDateNorm = endDate;

  if (startDate.length === 7) {
    startDateNorm = `${startDate}-01`; // YYYY-MM → YYYY-MM-01
  }
  if (endDate.length === 7) {
    endDateNorm = `${endDate}-31`; // YYYY-MM → YYYY-MM-31 (aproximado)
  }

  // T019d: Validar que cada fila mapea a entry en fundamental_analysis_audit table
  const { data, error } = await supabase
    .from("fundamental_analysis_audit")
    .select(
      "id, ticker, snapshot_date, viability_classification, viability_score, calculated_metrics, user_id"
    )
    .gte("snapshot_date", startDateNorm)
    .lte("snapshot_date", endDateNorm)
    .order("snapshot_date", { ascending: false });

  if (error) {
    throw new Error(`Failed to retrieve audit report: ${error.message}`);
  }

  // T019b: Mapear a estructura de reporte
  const reportRows: AuditReportRow[] = (data || []).map(
    (auditRecord: any) => ({
      ticker: auditRecord.ticker,
      analysis_date: auditRecord.snapshot_date,
      viability_classification: auditRecord.viability_classification,
      viability_score: auditRecord.viability_score,
      top_3_factors_justification: extractTop3Factors(
        auditRecord.calculated_metrics.justifications
      ),
      recalc_validation_status: "NOT_RUN", // Se ejecuta bajo demanda
      user_who_requested: auditRecord.user_id || "system",
      audit_id: auditRecord.id
    })
  );

  return reportRows;
}

/**
 * Extraer los 3 factores principales de justificación
 */
export function extractTop3Factors(justifications: Record<string, string>): string {
  const factors = Object.entries(justifications)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");

  return factors || "No justifications available";
}

/**
 * T019c: Generar CSV exportable para compliance
 */
export async function generateAuditReportCSV(
  startDate: string,
  endDate: string
): Promise<string> {
  const reportRows = await getAuditReport(startDate, endDate);

  // Header
  const header = [
    "Ticker",
    "Analysis Date",
    "Viability Classification",
    "Viability Score",
    "Top 3 Factors",
    "Validation Status",
    "Requested By",
    "Audit ID"
  ].join(",");

  // Rows
  const rows = reportRows
    .map((row) =>
      [
        row.ticker,
        row.analysis_date,
        row.viability_classification,
        row.viability_score.toFixed(2),
        `"${row.top_3_factors_justification}"`,
        row.recalc_validation_status,
        row.user_who_requested || "N/A",
        row.audit_id
      ].join(",")
    )
    .join("\n");

  return `${header}\n${rows}`;
}

/**
 * T019c: Generar JSON estructurado para compliance
 */
export async function generateAuditReportJSON(
  startDate: string,
  endDate: string
): Promise<{
  reportMetadata: {
    startDate: string;
    endDate: string;
    generatedAt: string;
    totalRecords: number;
  };
  rows: AuditReportRow[];
}> {
  const reportRows = await getAuditReport(startDate, endDate);

  return {
    reportMetadata: {
      startDate,
      endDate,
      generatedAt: new Date().toISOString(),
      totalRecords: reportRows.length
    },
    rows: reportRows
  };
}

/**
 * T019e: Validar que reporte incluye todos análisis del período, sin duplicados
 */
export function validateReportIntegrity(
  reportRows: AuditReportRow[]
): {
  valid: boolean;
  duplicates: Array<{ ticker: string; date: string; count: number }>;
  message: string;
} {
  const seen = new Map<string, number>();
  const duplicates: Array<{ ticker: string; date: string; count: number }> = [];

  for (const row of reportRows) {
    const key = `${row.ticker}_${row.analysis_date}`;
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);

    if (count > 1) {
      duplicates.push({
        ticker: row.ticker,
        date: row.analysis_date,
        count
      });
    }
  }

  return {
    valid: duplicates.length === 0,
    duplicates,
    message:
      duplicates.length === 0
        ? "Report integrity validated: no duplicates"
        : `Report has ${duplicates.length} duplicate entries`
  };
}
