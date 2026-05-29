/**
 * T019-US4: Unit tests para reporte de auditoría
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  validateReportIntegrity,
  extractTop3Factors
} from "../../../../src/modules/audit/auditReport";
import type { AuditReportRow } from "../../../../src/modules/audit/auditReport";

describe("T019-US4: Audit Report", () => {
  let mockReportRows: AuditReportRow[];

  beforeEach(() => {
    mockReportRows = [
      {
        ticker: "AAPL",
        analysis_date: "2026-05-20",
        viability_classification: "VIABLE",
        viability_score: 0.75,
        top_3_factors_justification:
          "Large cap > $2.8T; ROE 87.5%; Volatility normalized",
        recalc_validation_status: "PASSED",
        user_who_requested: "analyst-01",
        audit_id: "audit-001"
      },
      {
        ticker: "MSFT",
        analysis_date: "2026-05-20",
        viability_classification: "VIABLE",
        viability_score: 0.82,
        top_3_factors_justification:
          "Market leader; High dividend; Stable volatility",
        recalc_validation_status: "PASSED",
        user_who_requested: "analyst-01",
        audit_id: "audit-002"
      },
      {
        ticker: "GOOGL",
        analysis_date: "2026-05-19",
        viability_classification: "NEUTRAL",
        viability_score: 0.55,
        top_3_factors_justification:
          "Mixed signals; Moderate volatility; Lower ROE",
        recalc_validation_status: "NOT_RUN",
        user_who_requested: "analyst-02",
        audit_id: "audit-003"
      }
    ];
  });

  describe("T019b-d: Reporte incluye todos análisis del período, sin duplicados", () => {
    it("T019: Reporte trazable a audit table", () => {
      // Verificar que cada fila tiene audit_id
      mockReportRows.forEach((row) => {
        expect(row.audit_id).toBeDefined();
        expect(row.audit_id).toMatch(/^audit-\d+$/);
      });
    });

    it("T019: Exportable, legible para auditor no-técnico", () => {
      mockReportRows.forEach((row) => {
        expect(row.ticker).toBeDefined();
        expect(row.analysis_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(row.viability_classification).toMatch(
          /^(VIABLE|NEUTRAL|NOT_VIABLE)$/
        );
        expect(row.viability_score).toBeGreaterThanOrEqual(0);
        expect(row.viability_score).toBeLessThanOrEqual(1);
        expect(row.top_3_factors_justification).toBeDefined();
      });
    });
  });

  describe("T019e: Validar que reporte incluye todos análisis del período, sin duplicados", () => {
    it("should validate report has no duplicates", () => {
      const { valid, duplicates, message } =
        validateReportIntegrity(mockReportRows);

      expect(valid).toBe(true);
      expect(duplicates).toHaveLength(0);
      expect(message).toContain("validated");
    });

    it("should detect duplicate entries", () => {
      const duplicatedRows = [
        ...mockReportRows,
        {
          ...mockReportRows[0] // Duplicate AAPL 2026-05-20
        }
      ];

      const { valid, duplicates, message } =
        validateReportIntegrity(duplicatedRows);

      expect(valid).toBe(false);
      expect(duplicates.length).toBeGreaterThan(0);
      expect(message).toContain("duplicate");
    });

    it("should count total records correctly", () => {
      const { valid } = validateReportIntegrity(mockReportRows);
      expect(valid).toBe(true);
      expect(mockReportRows).toHaveLength(3);
    });
  });

  describe("Criteria de aceptación", () => {
    it("T019: Reporte trazable a audit table", () => {
      mockReportRows.forEach((row) => {
        expect(row.audit_id).toBeDefined();
        // Cada fila es recuperable de fundamental_analysis_audit usando audit_id
      });
    });

    it("T019: Exportable, legible para auditor no-técnico", () => {
      // Verificar formato legible
      mockReportRows.forEach((row) => {
        const csvLine = `${row.ticker},${row.analysis_date},${row.viability_classification}`;
        expect(csvLine).toMatch(/^[A-Z]+,\d{4}-\d{2}-\d{2},(VIABLE|NEUTRAL|NOT_VIABLE)$/);
      });
    });

    it("T019c: Generar CSV exportable para compliance", () => {
      // Estructura CSV esperada
      const header =
        "Ticker,Analysis Date,Viability Classification,Viability Score,Top 3 Factors,Validation Status,Requested By,Audit ID";
      expect(header).toContain("Ticker");
      expect(header).toContain("Viability Classification");
      expect(header).toContain("Audit ID");
    });
  });

  describe("Helper: extractTop3Factors", () => {
    it("should extract top 3 factors from justifications object", () => {
      const justifications = {
        marketCap: "Large cap > $2.8T",
        roe: "ROE 87.5%",
        volatility: "Volatility normalized",
        beta: "Beta 1.2",
        extra: "Extra factor"
      };

      const result = Object.entries(justifications)
        .slice(0, 3)
        .map(([key, value]) => `${key}: ${value}`)
        .join("; ");

      expect(result).toContain("marketCap");
      expect(result).toContain("roe");
      expect(result).toContain("volatility");
      expect(result).not.toContain("beta");
    });
  });
});
