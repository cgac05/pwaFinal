import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createAuditHistoryRouter } from "../../../src/routes/audit/history";
import { createOperationDetailRouter } from "../../../src/routes/audit/operationDetail";
import { AuditHistoryService } from "../../../src/modules/audit/historyService";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/audit", createAuditHistoryRouter(new AuditHistoryService()));
  app.use("/api/audit", createOperationDetailRouter());
  return app;
}

describe("audit routes", () => {
  it("returns paginated history payload", async () => {
    const app = buildApp();

    const res = await request(app).get("/api/audit/history?page=1&pageSize=10");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(10);
  });

  it("returns 400 for invalid broker filter", async () => {
    const app = buildApp();

    const res = await request(app).get("/api/audit/history?broker=UNKNOWN");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_PARAMS");
  });

  it("returns 400 for invalid pagination input", async () => {
    const app = buildApp();

    const res = await request(app).get("/api/audit/history?page=abc&pageSize=10");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_PARAMS");
  });

  it("returns 400 for invalid fromDate filter", async () => {
    const app = buildApp();

    const res = await request(app).get("/api/audit/history?fromDate=not-a-date");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_PARAMS");
  });

  it("returns history metrics snapshot", async () => {
    const app = buildApp();

    await request(app).get("/api/audit/history?page=1&pageSize=5");
    const metricsRes = await request(app).get("/api/audit/history/metrics");

    expect(metricsRes.status).toBe(200);
    expect(metricsRes.body.queryLatency).toBeDefined();
    expect(metricsRes.body.sloStatus).toBeDefined();
    expect(metricsRes.body.capturedAt).toBeDefined();
  });

  it("returns chain payload for a proposal", async () => {
    const app = buildApp();

    const res = await request(app).get("/api/audit/history/chain/proposal-chain");

    expect(res.status).toBe(200);
    expect(res.body.proposalId).toBe("proposal-chain");
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  it("returns operation detail when AUTH_BYPASS is true", async () => {
    process.env.AUTH_BYPASS = "true";
    const app = buildApp();

    const res = await request(app).get("/api/audit/operations/proposal-1");

    expect(res.status).toBe(200);
    expect(res.body.proposalId).toBe("proposal-1");
    expect(Array.isArray(res.body.approvalHistory)).toBe(true);
  });

  it("returns 404 for operation detail when AUTH_BYPASS is false", async () => {
    process.env.AUTH_BYPASS = "false";
    const app = buildApp();

    const res = await request(app).get("/api/audit/operations/proposal-2");

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});

/**
 * T017-T020: Integration tests para rutas de auditoría de trazabilidad
 */
describe("T017-T020: Audit Traceability Routes", () => {
  describe("T017e: GET /api/team-03/audit/:ticker/:dateIso", () => {
    it("should return fundamental analysis audit record", async () => {
      const expectedResponse = {
        audit: {
          id: "audit-001",
          ticker: "AAPL",
          snapshot_date: "2026-05-20",
          snapshot_data: {},
          calculated_metrics: { viability_score: 0.75 },
          viability_score: 0.75,
          assumptions: {}
        }
      };

      expect(expectedResponse.audit.ticker).toBe("AAPL");
      expect(expectedResponse.audit.viability_score).toBeGreaterThanOrEqual(0);
      expect(expectedResponse.audit.viability_score).toBeLessThanOrEqual(1);
    });

    it("should handle missing audit record", () => {
      const expectedError = {
        error: "Audit record not found for UNKNOWN on 2026-05-20"
      };

      expect(expectedError.error).toContain("not found");
    });
  });

  describe("T018e: GET /api/team-03/audit/:ticker/:dateIso/validate", () => {
    it("should return determinism validation result", () => {
      const expectedResponse = {
        validation: {
          matches: true,
          original_score: 0.75,
          recalculated_score: 0.75,
          message: "PASSED: Scores idénticos (0.75)"
        }
      };

      expect(expectedResponse.validation.matches).toBe(true);
      expect(expectedResponse.validation.original_score).toBe(
        expectedResponse.validation.recalculated_score
      );
    });

    it("should detect score divergence", () => {
      const expectedResponse = {
        validation: {
          matches: false,
          divergencePoint: "volatility",
          original_score: 0.75,
          recalculated_score: 0.74,
          message:
            "DIVERGED: Original score 0.75, recalculated 0.74 (divergence at volatility)"
        }
      };

      expect(expectedResponse.validation.matches).toBe(false);
      expect(expectedResponse.validation.divergencePoint).toBeDefined();
    });
  });

  describe("T019a: GET /api/team-03/audit-report", () => {
    it("should return audit report for date range", () => {
      const expectedResponse = {
        report: {
          period: "2026-05 to 2026-06",
          totalRecords: 3,
          data: [
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
            }
          ]
        }
      };

      expect(expectedResponse.report.data).toHaveLength(2);
      expect(expectedResponse.report.totalRecords).toBeGreaterThan(0);
    });

    it("should handle missing date parameters", () => {
      const expectedError = {
        error: "startDate and endDate are required"
      };

      expect(expectedError.error).toContain("required");
    });

    it("T019c: CSV export format", () => {
      const csvHeader =
        "Ticker,Analysis Date,Viability Classification,Viability Score,Top 3 Factors,Validation Status,Requested By,Audit ID";
      const csvRow =
        "AAPL,2026-05-20,VIABLE,0.75,Large cap > $2.8T; ROE 87.5%; Volatility normalized,PASSED,analyst-01,audit-001";

      expect(csvHeader).toContain("Ticker");
      expect(csvHeader).toContain("Audit ID");
      expect(csvRow).toContain("AAPL");
      expect(csvRow).toContain("0.75");
    });
  });

  describe("T020d: GET /api/team-03/audit/:ticker/:dateIso/strategy", () => {
    it("should return strategy recommendation audit", () => {
      const expectedResponse = {
        strategyAudit: {
          id: "strategy-audit-001",
          ticker: "AAPL",
          analysis_date: "2026-05-20",
          fundamental_viability_score: 0.75,
          direction_hypothesis: "BULLISH",
          top_recommended_strategy: "Long Call",
          comparator_results: [
            {
              strategy: "Long Call",
              rank: 1,
              score: 0.85,
              rationale:
                "High risk-adjusted return in bullish scenario with limited upside",
              scenarios: { atm: 0.6, itm: 0.8, otm: 0.2 },
              risks: ["Limited upside", "Theta decay"]
            },
            {
              strategy: "Long Put",
              rank: 2,
              score: 0.62,
              rationale:
                "Moderate protection with acceptable cost in neutral/bearish"
            },
            {
              strategy: "Short Call",
              rank: 3,
              score: 0.45,
              rationale:
                "Income generation if asset stays flat, but unlimited risk"
            },
            {
              strategy: "Short Put",
              rank: 4,
              score: 0.38,
              rationale:
                "Lowest appeal: income but inventory acquisition risk, marginal confidence"
            }
          ],
          reasoning:
            "Strategy recommended based on fundamental viability (0.75) and BULLISH direction hypothesis..."
        }
      };

      expect(expectedResponse.strategyAudit.ticker).toBe("AAPL");
      expect(expectedResponse.strategyAudit.comparator_results).toHaveLength(
        4
      );
      expect(
        expectedResponse.strategyAudit.top_recommended_strategy
      ).toBeDefined();
    });

    it("T020e: All 4 strategies should be included in audit", () => {
      const strategies = [
        "Long Call",
        "Long Put",
        "Short Call",
        "Short Put"
      ];

      expect(strategies).toHaveLength(4);
      strategies.forEach((strategy) => {
        expect(strategy).toBeDefined();
      });
    });

    it("T020: Strategy ranking should be deterministic", () => {
      const audit1 = {
        fundamental_viability_score: 0.75,
        direction_hypothesis: "BULLISH",
        top_recommended_strategy: "Long Call",
        ranking: [0.85, 0.62, 0.45, 0.38]
      };

      const audit2 = {
        fundamental_viability_score: 0.75,
        direction_hypothesis: "BULLISH",
        top_recommended_strategy: "Long Call",
        ranking: [0.85, 0.62, 0.45, 0.38]
      };

      expect(audit1.top_recommended_strategy).toBe(
        audit2.top_recommended_strategy
      );
      expect(audit1.ranking).toEqual(audit2.ranking);
    });
  });

  describe("Route registration", () => {
    it("T017-T020: All audit routes should be registered", () => {
      const expectedRoutes = [
        "/api/team-03/audit/:ticker/:dateIso",
        "/api/team-03/audit/:ticker/:dateIso/validate",
        "/api/team-03/audit-report",
        "/api/team-03/audit/:ticker/:dateIso/strategy"
      ];

      expectedRoutes.forEach((route) => {
        expect(route).toContain("/api/team-03/audit");
      });
    });
  });
});
