// FIC: Protective Put / Married Put engine — computes risk metrics, payoff, and stop-loss alerts. (EN)
// FIC: Motor Protective Put / Married Put — calcula métricas de riesgo, payoff y alertas de stop-loss. (ES)

import type {
  CoverageStrategyContract,
  CoverageStrategyResult,
  CoverageStrategyAlert,
  CoveragePayoffPoint,
  CoverageRiskMetrics,
} from "./coverageStrategyContract";

// FIC: Clamp a value to [min, max]. (EN) / Clampea un valor en [min, max]. (ES)
function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

// FIC: Generate payoff curve points from 50% to 150% of currentPrice in 21 steps. (EN)
// FIC: Genera puntos de la curva de payoff desde 50% hasta 150% del precio actual en 21 pasos. (ES)
function buildPayoff(
  currentPrice: number,
  putStrike: number,
  netPremiumPerShare: number,
  shares: number
): CoveragePayoffPoint[] {
  const points: CoveragePayoffPoint[] = [];
  for (let i = 0; i <= 20; i++) {
    const p = currentPrice * (0.5 + i * 0.05);
    const stockPnl = (p - currentPrice) * shares;
    const putPnl = (Math.max(putStrike - p, 0) - netPremiumPerShare) * shares;
    points.push({ underlyingPrice: parseFloat(p.toFixed(2)), pnl: stockPnl + putPnl });
  }
  return points;
}

// FIC: Protective Put / Married Put strategy engine. (EN)
// FIC: Motor de estrategia Protective Put / Married Put. (ES)
export function analyzeProtectivePut(contract: CoverageStrategyContract): CoverageStrategyResult {
  const { kind, ticker, shares, underlyingPrice, legs, riskTolerancePct, strategyId } = contract;

  const putLeg = legs.find((l) => l.type === "put" && l.position === "long");
  const putStrike = putLeg?.strike ?? underlyingPrice * 0.95;
  const putPremium = putLeg?.premium ?? 0;
  const netPremiumPerShare = putPremium; // only cost: the put premium

  // FIC: Stop-loss buffer: clamp(riskTolerancePct*0.5, 0.01, 0.10); fallback 0.03 when riskTolerancePct===0. (EN)
  // FIC: Buffer stop-loss: clamp(riskTolerancePct*0.5, 0.01, 0.10); fallback 0.03 cuando riskTolerancePct===0. (ES)
  const stopLossBuffer = riskTolerancePct === 0
    ? 0.03
    : clamp(riskTolerancePct * 0.5, 0.01, 0.10);
  const stopLossPrice = putStrike * (1 - stopLossBuffer);

  const breakEvenPrice = underlyingPrice + netPremiumPerShare;
  const maxProfit = Infinity; // unlimited upside / alza ilimitada
  const maxLoss = Math.max(0, underlyingPrice - putStrike + netPremiumPerShare) * shares;
  const downsideRisk = maxLoss;
  const netPremium = netPremiumPerShare * shares;
  const costBenefitRatio = netPremium > 0 ? maxLoss / netPremium : 0;

  const riskMetrics: CoverageRiskMetrics = {
    riskProfile: "limited",
    maxProtection: putStrike * shares,
    protectionFloorPrice: putStrike,
    netPremium,
    netPremiumPerShare,
    costBenefitRatio,
    downsideRisk,
    upsideCap: Infinity,
    breakEvenPrice,
    marginRequirement: 0,
    exerciseRiskScore: clamp(downsideRisk / (underlyingPrice * shares), 0, 1),
    volatilityStressLoss: maxLoss * 1.2,
    stopLossPrice,
  };

  // ─── Alerts ───────────────────────────────────────────────────────────────

  const alerts: CoverageStrategyAlert[] = [];

  // FIC: STOP_LOSS_TRIGGERED: current price at or below stop-loss level. (EN)
  // FIC: STOP_LOSS_TRIGGERED: precio actual en o por debajo del nivel de stop-loss. (ES)
  if (underlyingPrice <= stopLossPrice) {
    alerts.push({
      code: "STOP_LOSS_TRIGGERED",
      severity: "critical",
      message: `Current price $${underlyingPrice.toFixed(2)} ≤ stop-loss $${stopLossPrice.toFixed(2)}. Consider exercising put.`,
    });
  }

  // FIC: STOP_LOSS_NEAR_STRIKE: price within ±3% of put strike. (EN)
  // FIC: STOP_LOSS_NEAR_STRIKE: precio dentro de ±3% del strike del put. (ES)
  if (Math.abs(underlyingPrice - putStrike) / putStrike <= 0.03) {
    alerts.push({
      code: "STOP_LOSS_NEAR_STRIKE",
      severity: "warning",
      message: `Price $${underlyingPrice.toFixed(2)} is within 3% of put strike $${putStrike.toFixed(2)}.`,
    });
  }

  // FIC: MARRIED_PUT_BASIS_CHECK: for married put, flag cost basis difference. (EN)
  // FIC: MARRIED_PUT_BASIS_CHECK: para married put, alerta diferencia en base de costo. (ES)
  if (kind === "married_put") {
    alerts.push({
      code: "MARRIED_PUT_BASIS_CHECK",
      severity: "info",
      message: `Married put cost basis: $${breakEvenPrice.toFixed(2)} per share (includes $${netPremiumPerShare.toFixed(2)} premium).`,
    });
  }

  return {
    strategyId,
    kind,
    ticker,
    shares,
    underlyingPrice,
    legs,
    riskMetrics,
    payoffPoints: buildPayoff(underlyingPrice, putStrike, netPremiumPerShare, shares),
    maxProfit,
    maxLoss,
    alerts,
    confidenceScore: 0.75,
    generatedAt: new Date().toISOString(),
  };
}
