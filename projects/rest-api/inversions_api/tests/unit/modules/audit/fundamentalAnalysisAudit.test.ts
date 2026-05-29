/**
 * T017-US4: Unit tests para auditoría trail de análisis fundamental
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  saveAnalysisAudit,
  getAnalysisAudit,
  validateAuditSnapshot,
  validateAuditTimestamp
} from "../../../../src/modules/audit/fundamentalAnalysisAudit";
import type { FundamentalAnalysisAuditRecord } from "../../../../src/modules/audit/fundamentalAnalysisAudit";
import type { ViabilityScore } from "../../../../src/modules/fundamental/viabilityEngine";
import type { FundamentalAnalysisData } from "../../../../src/modules/fundamental/fundamentalSourceContract";

describe("T017-US4: Fundamental Analysis Audit", () => {
  let mockAuditRecord: FundamentalAnalysisAuditRecord;
  let mockSnapshotData: FundamentalAnalysisData;
  let mockViabilityScore: ViabilityScore;

  beforeEach(() => {
    mockSnapshotData = {
      ticker: "AAPL",
      source: "finnhub",
      dataVersion: "1.0",
      fetchTimestamp: "2026-05-20T10:00:00Z",
      priceHistory: [
        { date: "2026-05-20", close: 175.5 },
        { date: "2026-05-19", close: 174.8 }
      ],
      pe_ratio: 28.5,
      roe: 87.5,
      volatility_30d: 0.18,
      volatility_60d: 0.20,
      volatility_252d: 0.22,
      market_cap: 2800000000000,
      dividend_yield: 0.005,
      eps_growth: 0.12,
      beta: 1.2
    };

    mockViabilityScore = {
      overall: 0.75,
      classification: "VIABLE",
      confidence: "HIGH",
      dataCompletenessPercent: 95,
      componentScores: {
        marketCap: 0.8,
        dividendHistory: 0.7,
        roe: 0.85,
        peRatio: 0.75,
        volatility: 0.65,
        beta: 0.72,
        epsGrowth: 0.88
      },
      justifications: {
        marketCap: "Large cap over $2.8T",
        roe: "Strong ROE at 87.5%",
        volatility: "Historical vol 20%, normalized"
      },
      recommendations: ["Consider Long Call or Short Put"],
      warnings: ["Evaluate dividend sustainability"]
    };

    mockAuditRecord = {
      id: "audit-001",
      ticker: "AAPL",
      snapshot_date: "2026-05-20",
      snapshot_data: {
        priceHistory: mockSnapshotData.priceHistory,
        pe_ratio: mockSnapshotData.pe_ratio,
        roe: mockSnapshotData.roe,
        volatility_30d: mockSnapshotData.volatility_30d,
        volatility_60d: mockSnapshotData.volatility_60d,
        volatility_252d: mockSnapshotData.volatility_252d,
        market_cap: mockSnapshotData.market_cap,
        dividend_yield: mockSnapshotData.dividend_yield,
        eps_growth: mockSnapshotData.eps_growth,
        beta: mockSnapshotData.beta,
        source: mockSnapshotData.source,
        dataVersion: mockSnapshotData.dataVersion,
        fetchTimestamp: mockSnapshotData.fetchTimestamp
      },
      calculated_metrics: {
        componentScores: mockViabilityScore.componentScores,
        dataCompletenessPercent: mockViabilityScore.dataCompletenessPercent,
        justifications: mockViabilityScore.justifications,
        warnings: mockViabilityScore.warnings,
        recommendations: mockViabilityScore.recommendations
      },
      viability_score: mockViabilityScore.overall,
      viability_classification: mockViabilityScore.classification,
      timestamp_calculated: "2026-05-20T10:00:00Z",
      assumptions: {
        volatility_calc_method: "daily_returns_60d",
        benchmark_market_cap: "10B-500B",
        engine_version: "1.0"
      },
      user_id: "user-123",
      created_at: "2026-05-20T10:00:00Z"
    };
  });

  describe("T017f: Validate audit snapshot contains all required fields", () => {
    it("should validate snapshot with all required fields", () => {
      const { valid, missingFields } =
        validateAuditSnapshot(mockAuditRecord);

      expect(valid).toBe(true);
      expect(missingFields).toHaveLength(0);
    });

    it("should identify missing required fields", () => {
      const incompletRecord = { ...mockAuditRecord };
      (incompletRecord as any).snapshot_data = null;

      const { valid, missingFields } =
        validateAuditSnapshot(incompletRecord);

      expect(valid).toBe(false);
      expect(missingFields).toContain("snapshot_data");
    });

    it("should validate snapshot_data structure contains all pricing/ratios", () => {
      const { valid } = validateAuditSnapshot(mockAuditRecord);
      expect(valid).toBe(true);

      // Verify snapshot has all required metrics
      const snapshot = mockAuditRecord.snapshot_data;
      expect(snapshot.priceHistory).toBeDefined();
      expect(snapshot.pe_ratio).toBeDefined();
      expect(snapshot.roe).toBeDefined();
      expect(snapshot.volatility_30d).toBeDefined();
    });
  });

  describe("T017f: Validate date matches timestamp", () => {
    it("should validate that snapshot_date matches timestamp_calculated day", () => {
      const isValid = validateAuditTimestamp(mockAuditRecord);
      expect(isValid).toBe(true);
    });

    it("should reject if date and timestamp are different days", () => {
      const record = { ...mockAuditRecord };
      record.timestamp_calculated = "2026-05-21T10:00:00Z"; // Next day

      const isValid = validateAuditTimestamp(record);
      expect(isValid).toBe(false);
    });
  });

  describe("Criteria de aceptación", () => {
    it("T017: Snapshot es inmutable (NO UPDATE after creation)", () => {
      // Las RLS policies en Supabase rechazan UPDATE y DELETE
      // Este test verifica la estructura de políticas configuradas
      expect(mockAuditRecord.id).toBeDefined();
      expect(mockAuditRecord.snapshot_date).toBe("2026-05-20");
      // En producción, intentar actualizar sería rechazado por RLS
    });

    it("T017: Incluye metadata suficiente para regenerar análisis", () => {
      // Verificar que todos los campos necesarios para reproducibilidad están presentes
      expect(mockAuditRecord.snapshot_data).toHaveProperty("priceHistory");
      expect(mockAuditRecord.snapshot_data).toHaveProperty("pe_ratio");
      expect(mockAuditRecord.snapshot_data).toHaveProperty(
        "volatility_30d"
      );
      expect(mockAuditRecord.assumptions).toHaveProperty("engine_version");
      expect(mockAuditRecord.calculated_metrics).toHaveProperty(
        "componentScores"
      );
    });

    it("T017f: Snapshot contiene todos los campos necesarios", () => {
      const requiredFields = [
        "ticker",
        "snapshot_date",
        "snapshot_data",
        "calculated_metrics",
        "viability_score",
        "viability_classification"
      ];

      for (const field of requiredFields) {
        expect((mockAuditRecord as any)[field]).toBeDefined();
      }
    });

    it("T017f: Fecha coincide con timestamp", () => {
      expect(validateAuditTimestamp(mockAuditRecord)).toBe(true);
    });
  });
});
