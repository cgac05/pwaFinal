// FIC: Integration tests for coverage and institutional analysis routes (T1030). (EN)
// FIC: Tests de integración para rutas de cobertura y análisis institucional (T1030). (ES)

import express from "express";
import request from "supertest";
import { describe, expect, it, vi, beforeAll } from "vitest";

// ─── Mock institutional bootstrap (avoids real network calls) ─────────────────
// vi.mock is hoisted before imports, so route modules pick up the mock.

vi.mock("../../src/routes/institutional/bootstrap", () => {
  const mockContract = {
    analysisId: "mock-analysis-id",
    ticker: "AAPL",
    period: "daily",
    horizon: "medium",
    volume: 1_500_000,
    liquidity: "medium" as const,
    fundsOwnershipPct: 42,
    flows: { inflows: 510_000, outflows: 270_000, asOf: new Date().toISOString() },
    openPositions: { count: 120, notional: 18_000_000 },
    sourceIds: ["sec_edgar_13f", "finra_short_interest", "yahoo_options_flow", "yahoo_institutional"],
    requestedAt: new Date().toISOString(),
  };

  const mockResolveResult = {
    ticker: "AAPL",
    period: "daily",
    observations: [
      { sourceId: "sec_edgar_13f", status: "ok", confidence: 0.88, asOf: new Date().toISOString() },
      { sourceId: "finra_short_interest", status: "failed", confidence: 0, asOf: new Date().toISOString() },
      { sourceId: "yahoo_options_flow", status: "partial", confidence: 0.55, asOf: new Date().toISOString() },
      { sourceId: "yahoo_institutional", status: "ok", confidence: 0.75, asOf: new Date().toISOString() },
    ],
    merged: {
      confidence: 0.80,
      fundsOwnershipPct: 42,
      volume: 1_500_000,
      liquidity: "medium",
      sourceIds: ["sec_edgar_13f", "yahoo_institutional"],
    },
    overallStatus: "partial" as const,
    usedSourceIds: ["sec_edgar_13f", "yahoo_institutional"],
    cacheHit: false,
    resolvedAt: new Date().toISOString(),
  };

  const mockZonesResult = {
    ticker: "AAPL",
    zones: [
      { price: 175.0, type: "support", strength: 0.82, confidence: 0.77, volumeCluster: 1200000, touches: 3, liquidity: "high" },
      { price: 185.0, type: "resistance", strength: 0.70, confidence: 0.65, volumeCluster: 900000, touches: 2, liquidity: "medium" },
    ],
    supportZones: [
      { price: 175.0, type: "support", strength: 0.82, confidence: 0.77, volumeCluster: 1200000, touches: 3, liquidity: "high" },
    ],
    resistanceZones: [
      { price: 185.0, type: "resistance", strength: 0.70, confidence: 0.65, volumeCluster: 900000, touches: 2, liquidity: "medium" },
    ],
    candlesAnalyzed: 200,
    sourceCount: 2,
    atr: 2.5,
    institutionalScore: 0.73,
    analyzedAt: new Date().toISOString(),
  };

  const mockTrendResult = {
    ticker: "AAPL",
    direction: "bullish",
    sma50: 178.5,
    sma200: 170.2,
    crossover: { type: "golden", daysAgo: 15 },
    trendStrength: 0.71,
    continuityProbability: 0.68,
    institutionalScore: 0.73,
    volumeCorrelation: 0.42,
    candlesAnalyzed: 200,
    analyzedAt: new Date().toISOString(),
  };

  const mockExpirationResult = {
    ticker: "AAPL",
    events: [{ date: "2025-06-20", type: "monthly_opex", label: "Monthly OpEx", significance: 0.65 }],
    currentRegime: "far",
    theta: 0.08,
    gamma: 0.05,
    expiryBias: "bullish",
    callPutSkew: "call_skew",
    quarterlyReportImpact: 0.025,
    daysToNextOpex: 22,
    analyzedAt: new Date().toISOString(),
  };

  return {
    getInstitutionalRouteContext: () => ({
      dataService: { resolve: vi.fn().mockResolvedValue(mockResolveResult) },
      zonesEngine: { analyze: vi.fn().mockResolvedValue(mockZonesResult) },
      trendEngine: { analyze: vi.fn().mockResolvedValue(mockTrendResult) },
      expirationEngine: { analyze: vi.fn().mockResolvedValue(mockExpirationResult) },
    }),
    buildInstitutionalAnalysisContractFromRequest: vi.fn().mockReturnValue(mockContract),
    buildInstitutionalMetricsSummary: vi.fn().mockReturnValue({
      ticker: "AAPL",
      volume: 1_500_000,
      openPositionsCount: 120,
      openPositionsNotional: 18_000_000,
      inflows: 510_000,
      outflows: 270_000,
      netFlow: 240_000,
      fundsOwnershipPct: 42,
      liquidity: "medium",
    }),
    buildInstitutionalPositionsSummary: vi.fn().mockReturnValue({
      ticker: "AAPL",
      positions13F: [
        { sourceId: "sec_edgar_13f", asOf: new Date().toISOString(), count: 120, notional: 18_000_000, ownership: 42, confidence: 0.88 },
      ],
      flows: { inflows: 510_000, outflows: 270_000, netFlow: 240_000 },
    }),
  };
});

import { coverageAnalyzeRouter } from "../../src/routes/coverage/analyze";
import { coverageCompareRouter } from "../../src/routes/coverage/compare";
import { coverageSimulateRouter } from "../../src/routes/coverage/simulate";
import { institutionalAnalysisRouter } from "../../src/routes/institutional/institutionalAnalysis";
import { regulatoryPositionsRouter } from "../../src/routes/institutional/regulatoryPositions";

// ─── App builders ──────────────────────────────────────────────────────────────

function buildCoverageApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/coverage", coverageAnalyzeRouter);
  app.use("/api/coverage", coverageCompareRouter);
  app.use("/api/coverage", coverageSimulateRouter);
  return app;
}

function buildInstitutionalApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/institutional", institutionalAnalysisRouter);
  app.use("/api/institutional", regulatoryPositionsRouter);
  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeAll(() => {
  process.env.AUTH_BYPASS = "true";
  process.env.AUTH_BYPASS_ROLE = "trader";
});

describe("POST /api/coverage/analyze", () => {
  it("returns 200 with 4 strategy results for valid input", async () => {
    const res = await request(buildCoverageApp())
      .post("/api/coverage/analyze")
      .send({ ticker: "SPY", currentPrice: 450, shares: 100 });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results).toHaveLength(4);
    expect(res.body.generatedAt).toBeDefined();
  });

  it("returns all 4 strategy kinds", async () => {
    const res = await request(buildCoverageApp())
      .post("/api/coverage/analyze")
      .send({ ticker: "SPY", currentPrice: 450, shares: 100 });

    const kinds = res.body.results.map((r: { kind: string }) => r.kind);
    expect(kinds).toContain("protective_put");
    expect(kinds).toContain("married_put");
    expect(kinds).toContain("collar_put");
    expect(kinds).toContain("covered_straddle");
  });

  it("each result has confidenceLevel ALTA/MEDIA/BAJA", async () => {
    const res = await request(buildCoverageApp())
      .post("/api/coverage/analyze")
      .send({ ticker: "SPY", currentPrice: 450, shares: 100 });

    for (const result of res.body.results) {
      expect(["ALTA", "MEDIA", "BAJA"]).toContain(result.confidenceLevel);
    }
  });

  it("each result has summary with required fields", async () => {
    const res = await request(buildCoverageApp())
      .post("/api/coverage/analyze")
      .send({ ticker: "SPY", currentPrice: 450, shares: 100 });

    for (const result of res.body.results) {
      expect(result.summary).toBeDefined();
      expect(result.summary.breakEvenPrice).toBeDefined();
      expect(result.summary.netPremium).toBeDefined();
      expect(result.summary.riskProfile).toBeDefined();
    }
  });

  it("returns 403 when role is viewer", async () => {
    process.env.AUTH_BYPASS_ROLE = "viewer";
    const res = await request(buildCoverageApp())
      .post("/api/coverage/analyze")
      .send({ ticker: "SPY", currentPrice: 450 });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN_ROLE");
    process.env.AUTH_BYPASS_ROLE = "trader";
  });
});

describe("GET /api/institutional/analysis — partial degradation", () => {
  it("returns 200 even when some sources fail (partial status)", async () => {
    const res = await request(buildInstitutionalApp())
      .get("/api/institutional/analysis?ticker=AAPL");

    expect(res.status).toBe(200);
    expect(res.body.analysis.overallStatus).toBe("partial");
  });

  it("response includes zones, trends, expiration, metrics, and sourceReports", async () => {
    const res = await request(buildInstitutionalApp())
      .get("/api/institutional/analysis?ticker=AAPL");

    expect(res.body.zones).toBeDefined();
    expect(res.body.trends).toBeDefined();
    expect(res.body.expiration).toBeDefined();
    expect(res.body.metrics).toBeDefined();
    expect(Array.isArray(res.body.sourceReports)).toBe(true);
  });

  it("sourceReports lists all 4 sources with their status", async () => {
    const res = await request(buildInstitutionalApp())
      .get("/api/institutional/analysis?ticker=AAPL");

    expect(res.body.sourceReports).toHaveLength(4);
    const sourceIds = res.body.sourceReports.map((s: { sourceId: string }) => s.sourceId);
    expect(sourceIds).toContain("sec_edgar_13f");
    expect(sourceIds).toContain("finra_short_interest");
  });

  it("zones includes support and resistance arrays", async () => {
    const res = await request(buildInstitutionalApp())
      .get("/api/institutional/analysis?ticker=AAPL");

    expect(Array.isArray(res.body.zones.support)).toBe(true);
    expect(Array.isArray(res.body.zones.resistance)).toBe(true);
    expect(res.body.zones.support[0].type).toBe("support");
    expect(res.body.zones.resistance[0].type).toBe("resistance");
  });

  it("trends includes direction and SMA values", async () => {
    const res = await request(buildInstitutionalApp())
      .get("/api/institutional/analysis?ticker=AAPL");

    expect(res.body.trends.direction).toBe("bullish");
    expect(typeof res.body.trends.sma50).toBe("number");
    expect(typeof res.body.trends.sma200).toBe("number");
  });
});
