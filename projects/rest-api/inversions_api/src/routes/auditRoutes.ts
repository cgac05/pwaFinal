/**
 * T017-T020: Rutas de auditoría y trazabilidad (Fase 6: US4)
 * 
 * Endpoints:
 * - GET /api/team-03/audit/{ticker}/{dateIso}
 * - GET /api/team-03/audit/{ticker}/{dateIso}/validate
 * - GET /api/team-03/audit-report?startDate=YYYY-MM&endDate=YYYY-MM
 * - GET /api/team-03/audit/{ticker}/{dateIso}/strategy
 */

import type { Request, Response } from "express";
import type { Application } from "express";
import {
  getAnalysisAudit,
  validateAuditSnapshot,
  validateAuditTimestamp
} from "../modules/audit/fundamentalAnalysisAudit";
import {
  handleValidationRequest,
  validateDeterminism
} from "../modules/audit/auditValidation";
import {
  getAuditReport,
  generateAuditReportCSV,
  generateAuditReportJSON,
  validateReportIntegrity
} from "../modules/audit/auditReport";
import {
  getStrategyRecommendationAudit,
  validateStrategyAuditCompleteness,
  validateStrategyDeterminism
} from "../modules/audit/strategyRecommendationAudit";

/**
 * T017e: GET /api/team-03/audit/{ticker}/{dateIso}
 * Retorna snapshot completo de análisis fundamental
 */
export async function handleGetAnalysisAudit(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { ticker, dateIso } = req.params;

    if (!ticker || !dateIso) {
      res.status(400).json({
        error: "Missing ticker or dateIso",
        code: "INVALID_PARAMS"
      });
      return;
    }

    // Validar formato de fecha
    if (!dateIso.match(/^\d{4}-\d{2}-\d{2}$/)) {
      res.status(400).json({
        error: "Invalid date format. Use YYYY-MM-DD",
        code: "INVALID_DATE_FORMAT"
      });
      return;
    }

    const auditRecord = await getAnalysisAudit(ticker, dateIso);

    if (!auditRecord) {
      res.status(404).json({
        error: `No audit record found for ${ticker} on ${dateIso}`,
        code: "NOT_FOUND"
      });
      return;
    }

    // Validar integridad
    const { valid: isValid, missingFields } =
      validateAuditSnapshot(auditRecord);
    const dateMatch = validateAuditTimestamp(auditRecord);

    if (!isValid || !dateMatch) {
      res.status(500).json({
        error: "Audit record integrity check failed",
        code: "INTEGRITY_FAILED",
        details: { isValid, dateMatch, missingFields }
      });
      return;
    }

    res.json({
      success: true,
      data: auditRecord
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      error: err.message,
      code: "INTERNAL_ERROR"
    });
  }
}

/**
 * T018e: GET /api/team-03/audit/{ticker}/{dateIso}/validate
 * Ejecuta validación determinística
 */
export async function handleValidateAnalysis(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { ticker, dateIso } = req.params;

    if (!ticker || !dateIso) {
      res.status(400).json({
        error: "Missing ticker or dateIso",
        code: "INVALID_PARAMS"
      });
      return;
    }

    const { validation } = await handleValidationRequest(ticker, dateIso);

    res.json({
      success: true,
      data: {
        ticker,
        dateIso,
        validation
      }
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      error: err.message,
      code: "INTERNAL_ERROR"
    });
  }
}

/**
 * T019a: GET /api/team-03/audit-report?startDate=2026-05&endDate=2026-05
 */
export async function handleGetAuditReport(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { startDate, endDate, format } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        error: "Missing startDate or endDate query parameters",
        code: "INVALID_PARAMS",
        example: "/api/team-03/audit-report?startDate=2026-05&endDate=2026-05"
      });
      return;
    }

    const startStr = String(startDate);
    const endStr = String(endDate);
    const formatStr = String(format || "json").toLowerCase();

    // Generar reporte
    let data: any;

    if (formatStr === "csv") {
      const csv = await generateAuditReportCSV(startStr, endStr);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="audit-report-${startStr}-${endStr}.csv"`
      );
      res.send(csv);
      return;
    }

    // JSON por defecto
    data = await generateAuditReportJSON(startStr, endStr);

    // Validar integridad
    const { valid: integryValid, duplicates } = validateReportIntegrity(
      data.rows
    );

    res.json({
      success: true,
      metadata: {
        ...data.reportMetadata,
        integrityValid: integryValid,
        duplicatesFound: duplicates.length
      },
      rows: data.rows
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      error: err.message,
      code: "INTERNAL_ERROR"
    });
  }
}

/**
 * T020d: GET /api/team-03/audit/{ticker}/{dateIso}/strategy
 * Retorna auditoría de selección de estrategia
 */
export async function handleGetStrategyAudit(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { ticker, dateIso } = req.params;

    if (!ticker || !dateIso) {
      res.status(400).json({
        error: "Missing ticker or dateIso",
        code: "INVALID_PARAMS"
      });
      return;
    }

    const auditRecord = await getStrategyRecommendationAudit(ticker, dateIso);

    if (!auditRecord) {
      res.status(404).json({
        error: `No strategy audit found for ${ticker} on ${dateIso}`,
        code: "NOT_FOUND"
      });
      return;
    }

    // Validar completeness
    const { valid: isComplete, missingStrategies, totalEvaluated } =
      validateStrategyAuditCompleteness(auditRecord);

    res.json({
      success: true,
      data: auditRecord,
      validation: {
        complete: isComplete,
        totalEvaluated,
        missingStrategies
      }
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      error: err.message,
      code: "INTERNAL_ERROR"
    });
  }
}

/**
 * Registrar rutas de auditoría en el router Express
 */
export function registerAuditRoutes(app: Application): void {
  // T017e: GET /api/team-03/audit/:ticker/:dateIso
  app.get("/api/team-03/audit/:ticker/:dateIso", handleGetAnalysisAudit);

  // T018e: GET /api/team-03/audit/:ticker/:dateIso/validate
  app.get(
    "/api/team-03/audit/:ticker/:dateIso/validate",
    handleValidateAnalysis
  );

  // T019a: GET /api/team-03/audit-report
  app.get("/api/team-03/audit-report", handleGetAuditReport);

  // T020d: GET /api/team-03/audit/:ticker/:dateIso/strategy
  app.get(
    "/api/team-03/audit/:ticker/:dateIso/strategy",
    handleGetStrategyAudit
  );
}
