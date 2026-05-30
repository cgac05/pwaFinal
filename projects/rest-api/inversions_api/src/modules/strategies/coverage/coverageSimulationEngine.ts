// FIC: Coverage simulation engine — Monte Carlo 256 iterations for strategy P&L distribution. (EN)
// FIC: Motor de simulación de cobertura — Monte Carlo 256 iteraciones para distribución de P&L de estrategia. (ES)

import type { CoverageStrategyContract, CoverageStrategyResult } from "./coverageStrategyContract";
import { analyzeProtectivePut } from "./protectivePutEngine";
import { analyzeCollar } from "./collarEngine";
import { analyzeCoveredStraddle } from "./coveredStraddleEngine";
import { analyzeCashSecuredPut } from "./cashSecuredPutEngine";
import { analyzeCoveredCall } from "./coveredCallEngine";

export interface CoverageSimulationResult {
  strategyResult: CoverageStrategyResult;
  monteCarlo: {
    iterations: number;
    meanPnl: number;
    medianPnl: number;
    p5Pnl: number;   // 5th percentile
    p95Pnl: number;  // 95th percentile
    probabilityOfProfit: number; // fraction of simulations with PnL > 0
    skipped: boolean;
  };
  scenarios: Array<{ label: string; underlyingPrice: number; pnl: number }>;
}

// FIC: Box-Muller transform — produces standard normal samples from uniform inputs. (EN)
// FIC: Transformada Box-Muller — produce muestras normales estándar desde entradas uniformes. (ES)
function boxMuller(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
}

// FIC: Compute P&L for a contract at a given simulated final price. (EN)
// FIC: Calcula P&L para un contrato dado un precio final simulado. (ES)
function computePnlAtPrice(contract: CoverageStrategyContract, finalPrice: number): number {
  const { underlyingPrice, shares, legs } = contract;
  let pnl = (finalPrice - underlyingPrice) * shares; // stock component

  for (const leg of legs) {
    const intrinsic =
      leg.type === "call"
        ? Math.max(finalPrice - leg.strike, 0)
        : Math.max(leg.strike - finalPrice, 0);
    const optionPnl =
      leg.position === "long"
        ? (intrinsic - leg.premium) * (leg.quantity ?? 1) * 100
        : (leg.premium - intrinsic) * (leg.quantity ?? 1) * 100;
    pnl += optionPnl;
  }
  return pnl;
}

// FIC: Main simulation method — dispatches to specific engine, then runs Monte Carlo. (EN)
// FIC: Método de simulación principal — despacha al engine específico, luego ejecuta Monte Carlo. (ES)
export class CoverageSimulationEngine {
  readonly monteCarloIterations: number;

  constructor(monteCarloIterations = 256) {
    this.monteCarloIterations = monteCarloIterations;
  }

  async analyze(contract: CoverageStrategyContract): Promise<CoverageSimulationResult> {
    // Dispatch to the correct engine
    let strategyResult: CoverageStrategyResult;
    switch (contract.kind) {
      case "collar_put":
        strategyResult = analyzeCollar(contract);
        break;
      case "covered_straddle":
        strategyResult = analyzeCoveredStraddle(contract);
        break;
      case "secured_put":
        // FIC: Cash Secured Put — premium income, obligated to buy shares if assigned. (EN)
        // FIC: Cash Secured Put — ingreso por prima, obligado a comprar acciones si se asigna. (ES)
        strategyResult = analyzeCashSecuredPut(contract);
        break;
      case "covered_call":
        // FIC: Covered Call — premium income, upside capped at strike. (EN)
        // FIC: Covered Call — ingreso por prima, alza limitada al strike. (ES)
        strategyResult = analyzeCoveredCall(contract);
        break;
      case "protective_put":
      case "married_put":
      default:
        strategyResult = analyzeProtectivePut(contract);
        break;
    }

    // FIC: monteCarloIterations=0 → skip MC, return instant payoff only. (EN)
    // FIC: monteCarloIterations=0 → omite MC, retorna solo el payoff instantáneo. (ES)
    if (this.monteCarloIterations === 0) {
      return {
        strategyResult,
        monteCarlo: {
          iterations: 0,
          meanPnl: 0,
          medianPnl: 0,
          p5Pnl: 0,
          p95Pnl: 0,
          probabilityOfProfit: 0,
          skipped: true,
        },
        scenarios: this.buildDeterministicScenarios(contract, strategyResult),
      };
    }

    // FIC: GBM params — use real IV and DTE from the contract; fall back to market-average defaults only if absent. (EN)
    // FIC: Parámetros GBM — usa IV y DTE reales del contrato; solo usa defaults si no están disponibles. (ES)
    const S0 = contract.underlyingPrice;

    // Prefer contract.dte (resolved from real chain). If absent, compute from first leg's expiry.
    let realDte = contract.dte ?? 0;
    if (realDte <= 0 && contract.legs.length > 0) {
      const expiryMs = new Date(contract.legs[0].expiry).getTime();
      realDte = Math.max(1, Math.round((expiryMs - Date.now()) / 86_400_000));
    }
    if (realDte <= 0) realDte = 45;

    // Prefer contract.iv (real implied volatility). Fallback 0.25 is last resort — always logged.
    const sigma = (contract.iv && contract.iv > 0) ? contract.iv : 0.25;
    if (!contract.iv || contract.iv <= 0) {
      console.warn(`[CoverageSimulationEngine] No real IV for ${contract.ticker} — using σ=0.25 fallback`);
    }

    const T = realDte / 365;
    const mu = 0.05; // risk-neutral drift (risk-free rate approximation)
    const drift = (mu - 0.5 * sigma * sigma) * T;
    const vol = sigma * Math.sqrt(T);

    const pnls: number[] = [];
    for (let i = 0; i < this.monteCarloIterations; i++) {
      const z = boxMuller();
      const finalPrice = S0 * Math.exp(drift + vol * z);
      pnls.push(computePnlAtPrice(contract, finalPrice));
    }

    pnls.sort((a, b) => a - b);
    const meanPnl = pnls.reduce((s, v) => s + v, 0) / pnls.length;
    const medianPnl = pnls[Math.floor(pnls.length / 2)];
    const p5Pnl = pnls[Math.floor(pnls.length * 0.05)];
    const p95Pnl = pnls[Math.floor(pnls.length * 0.95)];
    const probabilityOfProfit = pnls.filter((p) => p > 0).length / pnls.length;

    return {
      strategyResult,
      monteCarlo: { iterations: this.monteCarloIterations, meanPnl, medianPnl, p5Pnl, p95Pnl, probabilityOfProfit, skipped: false },
      scenarios: this.buildDeterministicScenarios(contract, strategyResult),
    };
  }

  // FIC: Deterministic scenarios at +/-5%, +/-10%, +/-20% from current price. (EN)
  // FIC: Escenarios deterministas a +/-5%, +/-10%, +/-20% del precio actual. (ES)

  // FIC: Deterministic scenarios at +/-5%, +/-10%, +/-20% from current price. (EN)
  // FIC: Escenarios deterministas a +/-5%, +/-10%, +/-20% del precio actual. (ES)
  private buildDeterministicScenarios(
    contract: CoverageStrategyContract,
    result: CoverageStrategyResult
  ): CoverageSimulationResult["scenarios"] {
    const shifts = [-0.2, -0.1, -0.05, 0, 0.05, 0.1, 0.2];
    return shifts.map((pct) => {
      const price = contract.underlyingPrice * (1 + pct);
      const point = result.payoffPoints.find(
        (p) => Math.abs(p.underlyingPrice - price) < contract.underlyingPrice * 0.03
      );
      return {
        label: `${pct >= 0 ? "+" : ""}${(pct * 100).toFixed(0)}%`,
        underlyingPrice: parseFloat(price.toFixed(2)),
        pnl: point?.pnl ?? computePnlAtPrice(contract, price),
      };
    });
  }
}
