// FIC: Coverage comparator — runs 4 strategies, ranks them, and returns comparison matrix. (EN)
// FIC: Comparador de cobertura — ejecuta 4 estrategias, las rankea y retorna matriz de comparación. (ES)

import type { CoverageStrategyContract, CoverageStrategyResult } from "./coverageStrategyContract";
import { CoverageSimulationEngine, type CoverageSimulationResult } from "./coverageSimulationEngine";
import { CoverageRiskService, type RiskEvaluationResult } from "./coverageRiskService";
import { CoverageReportService, type CoverageReport } from "./coverageReportService";
import { adaptContractToEngine, adaptResultToResponse, type AdaptedStrategyResponse } from "./coverageStrategyAdapter";

export interface ComparisonEntry {
  kind: CoverageStrategyContract["kind"];
  adapted: AdaptedStrategyResponse;
  score: number;
  rank: number;
  report?: CoverageReport;
}

export interface CoverageComparisonResult {
  ticker: string;
  underlyingPrice: number;
  entries: ComparisonEntry[];
  winner: ComparisonEntry;
  generatedAt: string;
}

export interface CompareRequest {
  ticker: string;
  currentPrice: number;
  shares?: number;
  capital?: number;
  riskTolerancePct?: number;
  putStrikePrice?: number;
  callStrikePrice?: number;
  iv?: number;
  dte?: number;
}

// FIC: Compute a comparison score: 50% expected P&L (MC mean) + 50% risk/cost distribution. (EN)
// FIC: Calcula un score de comparación: 50% P&L esperado (media MC) + 50% distribución riesgo/costo. (ES)
function computeComparisonScore(
  simulation: CoverageSimulationResult,
  risk: RiskEvaluationResult
): number {
  const sr = simulation.strategyResult;
  const mc = simulation.monteCarlo;

  // Normalize expected PnL against position value
  const positionValue = sr.underlyingPrice * sr.shares;
  const pnlScore = positionValue > 0
    ? Math.max(0, Math.min(1, (mc.skipped ? 0 : mc.meanPnl) / positionValue + 0.5))
    : 0.5;

  // Risk score: lower riskLevel = higher score
  const riskLevelScore: Record<string, number> = { low: 1, medium: 0.7, high: 0.4, critical: 0.1 };
  const riskScore = riskLevelScore[risk.riskLevel] ?? 0.5;

  return parseFloat((0.5 * pnlScore + 0.5 * riskScore).toFixed(3));
}

// FIC: Run all 4 coverage strategies and return a ranked comparison matrix. (EN)
// FIC: Ejecuta las 4 estrategias de cobertura y retorna una matriz de comparación rankeada. (ES)
export class CoverageComparator {
  private readonly simulationEngine = new CoverageSimulationEngine();
  private readonly riskService = new CoverageRiskService();
  private readonly reportService = new CoverageReportService();

  async compare(request: CompareRequest): Promise<CoverageComparisonResult> {
    const KINDS: CoverageStrategyContract["kind"][] = [
      "protective_put",
      "married_put",
      "collar_put",
      "covered_straddle",
    ];

    // Build all 4 contracts upfront
    const contracts = KINDS.map((kind) =>
      adaptContractToEngine({
        kind,
        ticker: request.ticker,
        underlyingPrice: request.currentPrice,
        shares: request.shares ?? 100,
        capital: request.capital,
        riskTolerancePct: request.riskTolerancePct,
        putStrikePrice: request.putStrikePrice,
        callStrikePrice: request.callStrikePrice,
        iv: request.iv,
        dte: request.dte,
      })
    );

    // FIC: Run all 4 simulations in parallel — precomputed results are passed to generateReport. (EN)
    // FIC: Ejecuta las 4 simulaciones en paralelo — los resultados precomputados se pasan a generateReport. (ES)
    const settled = await Promise.allSettled(
      contracts.map((contract) => this.simulationEngine.analyze(contract))
    );

    const entries: ComparisonEntry[] = [];

    await Promise.allSettled(
      contracts.map(async (contract, i) => {
        const simResult = settled[i];
        if (simResult.status !== "fulfilled") return;

        const simulation = simResult.value;
        const risk = await this.riskService.evaluate(simulation.strategyResult);

        // FIC: Pass precomputed simulation + risk to report to avoid duplicate analysis. (EN)
        // FIC: Pasa simulación y riesgo precomputados al reporte para evitar análisis duplicado. (ES)
        const report = await this.reportService.generateReport(contract, undefined, {
          simulation,
          risk,
        });

        const score = computeComparisonScore(simulation, risk);
        const adapted = adaptResultToResponse(simulation.strategyResult);

        entries.push({ kind: contract.kind, adapted, score, rank: 0, report });
      })
    );

    // Rank by score descending
    entries.sort((a, b) => b.score - a.score);
    entries.forEach((e, i) => { e.rank = i + 1; });

    return {
      ticker: request.ticker,
      underlyingPrice: request.currentPrice,
      entries,
      winner: entries[0],
      generatedAt: new Date().toISOString(),
    };
  }
}
