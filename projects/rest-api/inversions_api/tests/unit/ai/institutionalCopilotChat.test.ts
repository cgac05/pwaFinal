import { afterEach, describe, expect, it } from "vitest";
import { InstitutionalCopilotChat } from "../../../src/modules/ai/institutionalCopilotChat.js";

function buildDemoContext() {
  const timestamp = new Date().toISOString();

  return {
    contextId: "ctx-demo-1",
    ticker: "SPY",
    currentPrice: 450,
    zones: {
      analysis: {
        ticker: "SPY",
        period: "daily",
        horizon: "medium",
        volume: 1_250_000,
        liquidity: "high",
        fundsOwnershipPct: 39,
        flows: {
          inflows: 840_000,
          outflows: 620_000,
          asOf: timestamp
        },
        openPositions: {
          count: 12,
          notional: 18_000_000
        }
      },
      zones: [
        {
          type: "support",
          price: 445,
          strength: 0.82,
          accumulatedVolume: 180_000,
          confidence: 0.9,
          confirmingSources: 2,
          touches: 3,
          liquidity: "high",
          asOf: timestamp,
          notes: ["demo"]
        },
        {
          type: "resistance",
          price: 460,
          strength: 0.7,
          accumulatedVolume: 150_000,
          confidence: 0.84,
          confirmingSources: 2,
          touches: 2,
          liquidity: "high",
          asOf: timestamp,
          notes: ["demo"]
        }
      ],
      candlesAnalyzed: 42,
      sourceReports: [],
      generatedAt: timestamp
    },
    coverageStrategies: [
      {
        engineId: "cov-demo-1",
        strategyKind: "protective_put",
        ticker: "SPY",
        shares: 100,
        currentPrice: 450,
        payoff: {
          baselinePrice: 450,
          breakevenPrice: 444,
          maxProfit: null,
          maxLoss: 600,
          description: "Demo protective put",
          points: [
            {
              label: "Base",
              movePct: 0,
              underlyingPrice: 450,
              pnl: -600,
              pnlPct: -1.33,
              notes: ["demo"]
            }
          ]
        },
        riskMetrics: {
          riskProfile: "limited",
          maxProtection: 1000,
          protectionFloorPrice: 430,
          protectionCeilingPrice: undefined,
          netPremium: 6,
          netPremiumPerShare: 0.06,
          costBenefitRatio: 1.5,
          downsideRisk: 120,
          upsideCap: null,
          breakEvenPrice: 444,
          stopLossPrice: 430,
          marginRequirement: 1000,
          exerciseRiskScore: 0.2
        },
        alerts: [],
        generatedAt: timestamp
      }
    ],
    question: "How should I hedge SPY?",
    userRole: "analyst" as const,
    requestedAt: timestamp,
    demoMode: true
  };
}

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
});

describe("InstitutionalCopilotChat demo mode", () => {
  it("returns a deterministic demo response through the polling contract", async () => {
    const service = new InstitutionalCopilotChat();
    const submission = await service.submit(buildDemoContext() as any);

    expect(submission.status).toBe("pending");
    expect(submission.ai_unavailable).toBe(false);

    if (submission.status !== "pending") {
      throw new Error("Expected pending submission response.");
    }

    const completed = await service.poll(submission.responseId);

    expect("narrative" in completed).toBe(true);
    if ("narrative" in completed) {
      expect(completed.ai_unavailable).toBe(false);
      expect(completed.modelVersion).toContain("demo");
      expect(completed.scenarioAnalysis.length).toBeGreaterThan(0);
      expect(completed.recommendation.length).toBeGreaterThan(0);
    }
  });
});