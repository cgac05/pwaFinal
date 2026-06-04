// FIC: Covered Strangle engine — kind=covered_straddle (contract compat), long stock + short put + short call. (EN)
// FIC: Motor Covered Strangle — kind=covered_straddle (compatibilidad de contrato), acciones long + put short + call short. (ES)

import type {
  CoverageStrategyContract,
  CoverageStrategyResult,
  CoverageStrategyAlert,
  CoveragePayoffPoint,
  CoverageRiskMetrics,
} from "./coverageStrategyContract";

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

// FIC: Covered strangle payoff: stock + short put income + short call income, capped at callStrike. (EN)
// FIC: Payoff del covered strangle: acciones + ingreso put short + ingreso call short, techo en callStrike. (ES)
function buildPayoff(
  currentPrice: number,
  putStrike: number,
  callStrike: number,
  netCreditPerShare: number, // credit received from selling both options
  shares: number
): CoveragePayoffPoint[] {
  const points: CoveragePayoffPoint[] = [];
  for (let i = 0; i <= 20; i++) {
    const p = currentPrice * (0.5 + i * 0.05);
    const stockPnl = (p - currentPrice) * shares;
    const shortPutPnl = -Math.max(putStrike - p, 0) * shares; // assigned below putStrike
    const shortCallPnl = -Math.max(p - callStrike, 0) * shares; // stock covers call above callStrike
    const premiumIncome = netCreditPerShare * shares;
    points.push({
      underlyingPrice: parseFloat(p.toFixed(2)),
      pnl: stockPnl + shortPutPnl + shortCallPnl + premiumIncome,
    });
  }
  return points;
}

// FIC: Covered strangle engine — riskProfile=unlimited because short put is uncovered on downside. (EN)
// FIC: Motor covered strangle — riskProfile=unlimited porque el put short queda descubierto a la baja. (ES)
export function analyzeCoveredStraddle(contract: CoverageStrategyContract): CoverageStrategyResult {
  const { strategyId, kind, ticker, shares, underlyingPrice, legs } = contract;

  const putLeg = legs.find((l) => l.type === "put" && l.position === "short");
  const callLeg = legs.find((l) => l.type === "call" && l.position === "short");

  const putStrike = putLeg?.strike ?? underlyingPrice * 0.92;
  const callStrike = callLeg?.strike ?? underlyingPrice * 1.08;
  const putPremium = putLeg?.premium ?? 0;
  const callPremium = callLeg?.premium ?? 0;

  // FIC: Net credit: received from selling both puts and calls. (EN)
  // FIC: Crédito neto: recibido por vender los puts y calls. (ES)
  const netCreditPerShare = putPremium + callPremium;
  const netPremium = netCreditPerShare * shares;

  // Max profit: all premiums collected when stock stays between strikes
  const maxProfit = netPremium;
  // Max loss: if stock falls to 0 — stock loss + put assignment (both legs lose)
  // Short put: forced to buy at putStrike when stock is near 0
  const maxStockLoss = underlyingPrice * shares;
  const maxPutLoss = putStrike * shares; // assigned at putStrike, buy at putStrike when P≈0
  const maxLoss = maxStockLoss + maxPutLoss - netPremium;

  const breakEvenPrice = underlyingPrice - netCreditPerShare;
  const protectionFloorPrice = putStrike + netCreditPerShare;
  const protectionCeilingPrice = callStrike + netCreditPerShare;

  const riskMetrics: CoverageRiskMetrics = {
    riskProfile: "unlimited", // short put has theoretically unlimited downside
    maxProtection: putStrike * shares,
    protectionFloorPrice,
    protectionCeilingPrice,
    netPremium,
    netPremiumPerShare: netCreditPerShare,
    costBenefitRatio: maxLoss > 0 ? netPremium / maxLoss : 0,
    downsideRisk: maxLoss,
    upsideCap: maxProfit,
    breakEvenPrice,
    marginRequirement: putStrike * shares * 0.2, // typical 20% margin
    exerciseRiskScore: clamp(maxLoss / (underlyingPrice * shares * 2), 0, 1),
    volatilityStressLoss: maxLoss * 1.3,
    stopLossPrice: putStrike * 0.95,
  };

  // ─── Alerts ───────────────────────────────────────────────────────────────

  const alerts: CoverageStrategyAlert[] = [];

  // FIC: HIGH_VOLATILITY_PROFILE: warn that covered strangle has asymmetric unlimited downside. (EN)
  // FIC: HIGH_VOLATILITY_PROFILE: avisa que el covered strangle tiene riesgo asimétrico ilimitado a la baja. (ES)
  alerts.push({
    code: "HIGH_VOLATILITY_PROFILE",
    severity: "warning",
    message:
      "This covered strangle (short put + short call) has unlimited downside from the short put. " +
      "The long stock position covers the short call upside, but the short put remains uncovered below " +
      `$${putStrike.toFixed(2)}.`,
  });

  return {
    strategyId,
    kind,
    ticker,
    shares,
    underlyingPrice,
    legs,
    riskMetrics,
    payoffPoints: buildPayoff(underlyingPrice, putStrike, callStrike, netCreditPerShare, shares),
    maxProfit,
    maxLoss,
    alerts,
    confidenceScore: 0.60,
    generatedAt: new Date().toISOString(),
  };
}
