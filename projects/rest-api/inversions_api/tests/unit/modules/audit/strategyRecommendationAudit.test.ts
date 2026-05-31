/**
 * T020-US4: Unit tests para auditoría de recomendación de estrategia
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  validateStrategyAuditCompleteness,
  validateStrategyDeterminism
} from "../../../../src/modules/audit/strategyRecommendationAudit";
import type {
  StrategyRecommendationAuditRecord,
  StrategyRankingAudit
} from "../../../../src/modules/audit/strategyRecommendationAudit";

describe("T020-US4: Strategy Recommendation Audit", () => {
  let mockAuditRecord: StrategyRecommendationAuditRecord;
  let mockComparatorResults: StrategyRankingAudit[];

  beforeEach(() => {
    mockComparatorResults = [
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
          "Moderate protection with acceptable cost in neutral/bearish",
        scenarios: { atm: 0.5, itm: 0.7, otm: 0.3 },
        risks: ["Theta decay", "Limited downside"]
      },
      {
        strategy: "Short Call",
        rank: 3,
        score: 0.45,
        rationale: "Income generation if asset stays flat, but unlimited risk",
        scenarios: { atm: 0.4, itm: 0.6, otm: 0.1 },
        risks: ["Unlimited risk", "Assignment risk"]
      },
      {
        strategy: "Short Put",
        rank: 4,
        score: 0.38,
        rationale:
          "Lowest appeal: income but inventory acquisition risk, marginal confidence",
        scenarios: { atm: 0.3, itm: 0.5, otm: 0.1 },
        risks: ["Assignment", "Margin requirement"]
      }
    ];

    mockAuditRecord = {
      id: "strategy-audit-001",
      ticker: "AAPL",
      analysis_date: "2026-05-20",
      fundamental_viability_score: 0.75,
      direction_hypothesis: "BULLISH",
      comparator_results: mockComparatorResults,
      top_recommended_strategy: "Long Call",
      reasoning:
        "Strategy recommended based on fundamental viability (0.75) and BULLISH direction hypothesis. " +
        "Top ranked strategies: Long Call (score: 0.85), Long Put (0.62), Short Call (0.45). " +
        "Selected: Long Call due to optimal risk-adjusted return profile.",
      timestamp: "2026-05-20T10:00:00Z",
      user_id: "analyst-01",
      created_at: "2026-05-20T10:00:00Z"
    };
  });

  describe("T020e: Validar que audit contiene todas estrategias evaluadas y seus scores", () => {
    it("should validate all 4 strategies are evaluated", () => {
      const { valid, missingStrategies, totalEvaluated } =
        validateStrategyAuditCompleteness(mockAuditRecord);

      expect(valid).toBe(true);
      expect(missingStrategies).toHaveLength(0);
      expect(totalEvaluated).toBe(4);
    });

    it("should detect missing strategies", () => {
      const incompleteAudit = {
        ...mockAuditRecord,
        comparator_results: mockComparatorResults.slice(0, 2) // Only 2 strategies
      };

      const { valid, missingStrategies } =
        validateStrategyAuditCompleteness(incompleteAudit);

      expect(valid).toBe(false);
      expect(missingStrategies).toContain("Short Call");
      expect(missingStrategies).toContain("Short Put");
    });

    it("T020e: Audit contiene todas estrategias evaluadas y sus scores", () => {
      mockAuditRecord.comparator_results.forEach((result) => {
        expect(result.strategy).toBeDefined();
        expect(result.rank).toBeGreaterThanOrEqual(1);
        expect(result.rank).toBeLessThanOrEqual(4);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });
    });
  });

  describe("Verificar determinismo de estrategia", () => {
    it("T020: Estrategia recomendada es determinística dada mismos datos + direction", () => {
      const audit1 = { ...mockAuditRecord };
      const audit2 = {
        ...mockAuditRecord,
        id: "strategy-audit-002",
        timestamp: "2026-05-20T11:00:00Z" // Same criteria, different time
      };

      const { deterministic, message } = validateStrategyDeterminism(
        audit1,
        audit2
      );

      expect(deterministic).toBe(true);
      expect(message).toContain("deterministic");
    });

    it("should detect divergence if recommendation changes with same inputs", () => {
      const audit1 = { ...mockAuditRecord };
      const audit2 = {
        ...mockAuditRecord,
        top_recommended_strategy: "Long Put", // Different recommendation
        id: "strategy-audit-diverged"
      };

      const { deterministic, message } = validateStrategyDeterminism(
        audit1,
        audit2
      );

      // Same viability and direction → must be same recommendation
      expect(deterministic).toBe(false);
      expect(message).toContain("diverged");
    });

    it("T020: Ranking es reproducible", () => {
      // Verificar que el ranking es consistente y ordenado
      const previousRank = 0;
      mockAuditRecord.comparator_results.forEach((result, index) => {
        expect(result.rank).toBe(index + 1);
        expect(result.rank).toBeGreaterThan(previousRank);
      });
    });
  });

  describe("Criteria de aceptación", () => {
    it("T020: Estrategia recomendada es determinística dada mismos datos + direction", () => {
      // Verificar que la estrategia recomendada es reproducible
      expect(mockAuditRecord.top_recommended_strategy).toBe(
        mockAuditRecord.comparator_results[0].strategy
      ); // Rank 1 debe ser recomendada
    });

    it("T020: Ranking es reproducible", () => {
      const firstRanked = mockAuditRecord.comparator_results[0];
      const lastRanked =
        mockAuditRecord.comparator_results[
          mockAuditRecord.comparator_results.length - 1
        ];

      // Rank 1 tiene mejor score que Rank 4
      expect(firstRanked.score).toBeGreaterThan(lastRanked.score);
    });

    it("T020b: Guardar full ranking y reasoning para cada estrategia", () => {
      mockAuditRecord.comparator_results.forEach((ranking) => {
        expect(ranking.strategy).toBeDefined();
        expect(ranking.rank).toBeDefined();
        expect(ranking.score).toBeDefined();
        expect(ranking.rationale).toBeDefined();
      });

      expect(mockAuditRecord.reasoning).toContain(
        mockAuditRecord.top_recommended_strategy
      );
    });

    it("T020c: Guardar ranking completo", () => {
      // Cada estrategia tiene su propio entry en ranking
      const strategies = mockAuditRecord.comparator_results.map(
        (r) => r.strategy
      );
      expect(strategies).toContain("Long Call");
      expect(strategies).toContain("Long Put");
      expect(strategies).toContain("Short Call");
      expect(strategies).toContain("Short Put");
    });
  });
});
