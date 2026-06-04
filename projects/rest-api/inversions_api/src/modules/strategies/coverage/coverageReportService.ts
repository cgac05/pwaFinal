// FIC: Coverage report service — generates JSON and Markdown reports, supports precomputed skip. (EN)
// FIC: Servicio de reportes de cobertura — genera reportes JSON y Markdown, soporta skip con precomputado. (ES)

import fs from "node:fs/promises";
import type { CoverageStrategyContract, CoverageStrategyResult } from "./coverageStrategyContract";
import { CoverageSimulationEngine, type CoverageSimulationResult } from "./coverageSimulationEngine";
import { CoverageRiskService, type RiskEvaluationResult } from "./coverageRiskService";

export interface ReportRecipient {
  channel: "log" | "email" | "webhook";
  address?: string;
}

export interface CoverageReport {
  strategyId: string;
  ticker: string;
  kind: string;
  simulation: CoverageSimulationResult;
  risk: RiskEvaluationResult;
  jsonPath?: string;
  mdPath?: string;
  generatedAt: string;
}

// FIC: Generate a complete coverage strategy report — uses precomputed if provided to avoid re-simulation. (EN)
// FIC: Genera un reporte completo de estrategia de cobertura — usa precomputado si se provee para evitar re-simulación. (ES)
export class CoverageReportService {
  private readonly simulationEngine = new CoverageSimulationEngine();
  private readonly riskService = new CoverageRiskService();

  async generateReport(
    strategyContract: CoverageStrategyContract,
    recipients?: ReportRecipient[],
    precomputed?: { simulation: CoverageSimulationResult; risk: RiskEvaluationResult }
  ): Promise<CoverageReport> {
    // FIC: Skip expensive compute when precomputed results are already available. (EN)
    // FIC: Omite el cómputo costoso cuando los resultados precomputados ya están disponibles. (ES)
    let simulation: CoverageSimulationResult;
    let risk: RiskEvaluationResult;

    if (precomputed) {
      simulation = precomputed.simulation;
      risk = precomputed.risk;
    } else {
      simulation = await this.simulationEngine.analyze(strategyContract);
      risk = await this.riskService.evaluate(simulation.strategyResult);
    }

    const report: CoverageReport = {
      strategyId: strategyContract.strategyId,
      ticker: strategyContract.ticker,
      kind: strategyContract.kind,
      simulation,
      risk,
      generatedAt: new Date().toISOString(),
    };

    // FIC: Write JSON and Markdown files in parallel; paths stored in report. (EN)
    // FIC: Escribe archivos JSON y Markdown en paralelo; rutas almacenadas en el reporte. (ES)
    try {
      const base = `/tmp/inversions-report-${strategyContract.strategyId.replace(/[^a-z0-9-]/gi, "_")}`;
      const jsonPath = `${base}.json`;
      const mdPath = `${base}.md`;

      await Promise.all([
        fs.writeFile(jsonPath, JSON.stringify(report, null, 2)),
        fs.writeFile(mdPath, buildMarkdownReport(report)),
      ]);

      report.jsonPath = jsonPath;
      report.mdPath = mdPath;
    } catch {
      // File I/O is best-effort — don't fail the report on disk errors
    }

    // Notify recipients if provided
    if (recipients?.length) {
      await this.riskService.notify(risk.alerts, recipients);
    }

    return report;
  }
}

// FIC: Build a Markdown summary report from a CoverageReport. (EN)
// FIC: Construye un resumen Markdown a partir de un CoverageReport. (ES)
function buildMarkdownReport(report: CoverageReport): string {
  const { ticker, kind, simulation, risk } = report;
  const sr = simulation.strategyResult;
  const rm = sr.riskMetrics;
  const mc = simulation.monteCarlo;

  const lines: string[] = [
    `# Coverage Strategy Report — ${ticker} / ${kind}`,
    `**Generated**: ${report.generatedAt}`,
    `**Strategy ID**: ${report.strategyId}`,
    "",
    "## Risk Summary",
    `- **Risk Level**: ${risk.riskLevel.toUpperCase()}`,
    `- **Risk Profile**: ${rm.riskProfile}`,
    `- **Max Loss**: $${sr.maxLoss.toFixed(2)}`,
    `- **Max Profit**: ${sr.maxProfit === Infinity ? "∞" : "$" + sr.maxProfit.toFixed(2)}`,
    `- **Break-even**: $${rm.breakEvenPrice.toFixed(2)}`,
    `- **Net Premium**: $${rm.netPremium.toFixed(2)}`,
    "",
    "## Monte Carlo",
    mc.skipped
      ? "_Skipped (monteCarloIterations=0)_"
      : [
          `- **Iterations**: ${mc.iterations}`,
          `- **Mean P&L**: $${mc.meanPnl.toFixed(2)}`,
          `- **Median P&L**: $${mc.medianPnl.toFixed(2)}`,
          `- **P5 / P95**: $${mc.p5Pnl.toFixed(2)} / $${mc.p95Pnl.toFixed(2)}`,
          `- **Prob. of Profit**: ${(mc.probabilityOfProfit * 100).toFixed(1)}%`,
        ].join("\n"),
    "",
    "## Alerts",
    risk.alerts.length === 0
      ? "_No alerts_"
      : risk.alerts.map((a) => `- [${a.severity.toUpperCase()}] **${a.code}**: ${a.message}`).join("\n"),
  ];

  return lines.join("\n");
}
