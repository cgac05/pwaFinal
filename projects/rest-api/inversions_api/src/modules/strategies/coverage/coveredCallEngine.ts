// FIC: Covered Call engine — short call against owned shares, premium income + upside cap. (EN)
// FIC: Motor Covered Call — call corta contra acciones propias, ingreso por prima + techo al alza. (ES)

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

// FIC: Covered Call payoff at expiry: stock gain/loss plus premium, capped at call strike. (EN)
// FIC: Payoff Covered Call al vencimiento: ganancia/pérdida de acciones más prima, con techo en el strike. (ES)
// Above the strike the short call neutralises further upside (shares get called away).
function buildPayoff(
  currentPrice: number,
  callStrike: number,
  premiumPerShare: number,
  shares: number
): CoveragePayoffPoint[] {
  const points: CoveragePayoffPoint[] = [];
  for (let i = 0; i <= 20; i++) {
    const p = currentPrice * (0.5 + i * 0.05);
    const stockPnl = (p - currentPrice) * shares;
    // Short call: receive premium but lose upside above strike
    const callPnl = (premiumPerShare - Math.max(p - callStrike, 0)) * shares;
    points.push({ underlyingPrice: parseFloat(p.toFixed(2)), pnl: stockPnl + callPnl });
  }
  return points;
}

// FIC: Covered Call strategy engine. (EN)
// FIC: Motor de estrategia Covered Call. (ES)
//
// The trader already owns the shares and sells an OTM call to collect premium.
// MaxProfit  = (callStrike - currentPrice + premium) * shares
// MaxLoss    = (currentPrice - premium) * shares   (if stock falls to zero)
// BreakEven  = currentPrice - premium              (lower effective cost basis)
// UpsideCap  = callStrike                          (shares get called away above this)
export function analyzeCoveredCall(contract: CoverageStrategyContract): CoverageStrategyResult {
  const { strategyId, kind, ticker, shares, underlyingPrice, legs, riskTolerancePct } = contract;

  const callLeg = legs.find((l) => l.type === "call" && l.position === "short");
  const callStrike = callLeg?.strike ?? underlyingPrice * 1.05;
  const callPremium = callLeg?.premium ?? 0; // premium received per share

  // FIC: Break-even is the lower effective cost basis after premium received. (EN)
  // FIC: Break-even es el costo base efectivo reducido tras recibir la prima. (ES)
  const breakEvenPrice = underlyingPrice - callPremium;

  const maxProfit = Math.max(0, callStrike - underlyingPrice + callPremium) * shares;
  // FIC: Downside is the same as owning shares, partially offset by premium received. (EN)
  // FIC: El riesgo a la baja es igual a tener acciones, parcialmente compensado por la prima recibida. (ES)
  const maxLoss = Math.max(0, underlyingPrice - callPremium) * shares;

  const netPremium = callPremium * shares; // positive = cash received
  const netPremiumPerShare = callPremium;
  const marginRequirement = 0; // No margin needed — shares provide full collateral

  // FIC: Stop-loss: price at which the unrealized stock loss exhausts the premium buffer. (EN)
  // FIC: Stop-loss: precio al que la pérdida no realizada de acciones consume el buffer de prima. (ES)
  const stopLossBuffer = riskTolerancePct === 0
    ? 0.03
    : clamp(riskTolerancePct * 0.5, 0.01, 0.10);
  const stopLossPrice = breakEvenPrice * (1 - stopLossBuffer);

  const downsideRisk = maxLoss;
  const upsideCap = maxProfit;
  const costBenefitRatio = maxProfit > 0 ? maxLoss / maxProfit : 0;

  // FIC: Exercise risk: ITM call means shares will likely be called away. (EN)
  // FIC: Riesgo de ejercicio: una call ITM implica que las acciones probablemente serán ejecutadas. (ES)
  const exerciseRiskScore = clamp(
    underlyingPrice >= callStrike
      ? 0.9                            // already ITM — very high
      : 1 - (callStrike - underlyingPrice) / underlyingPrice,
    0, 1
  );

  const riskMetrics: CoverageRiskMetrics = {
    riskProfile: "limited",
    maxProtection: callPremium * shares,    // premium reduces downside
    protectionFloorPrice: breakEvenPrice,
    protectionCeilingPrice: callStrike,
    netPremium: -netPremium,               // negative = cash RECEIVED
    netPremiumPerShare: -netPremiumPerShare,
    costBenefitRatio,
    downsideRisk,
    upsideCap,
    breakEvenPrice,
    marginRequirement,
    exerciseRiskScore,
    volatilityStressLoss: maxLoss * 1.2,
    stopLossPrice,
  };

  const alerts: CoverageStrategyAlert[] = [];

  if (underlyingPrice >= callStrike) {
    alerts.push({
      code: "CALL_IN_THE_MONEY",
      severity: "critical",
      message: `La call está ITM (precio ${underlyingPrice.toFixed(2)} >= strike ${callStrike.toFixed(2)}). Las acciones serán ejecutadas en el vencimiento.`,
    });
  }

  if (underlyingPrice <= stopLossPrice) {
    alerts.push({
      code: "STOP_LOSS_TRIGGERED",
      severity: "critical",
      message: `Precio ${underlyingPrice.toFixed(2)} <= stop-loss ${stopLossPrice.toFixed(2)}. La prima recibida ya no cubre la caída.`,
    });
  }

  const premiumYield = callPremium > 0 ? callPremium / underlyingPrice : 0;
  if (premiumYield < 0.005) {
    alerts.push({
      code: "LOW_PREMIUM_YIELD",
      severity: "info",
      message: `Prima recibida (${(premiumYield * 100).toFixed(2)}%) menor al 0.5% del precio. Considera un strike más cercano al dinero.`,
    });
  }

  const upsideSacrificePct = callStrike > 0
    ? (callStrike - underlyingPrice) / underlyingPrice
    : 0;
  if (upsideSacrificePct < 0.02) {
    alerts.push({
      code: "TIGHT_STRIKE",
      severity: "warning",
      message: `Strike muy cerca del precio actual (${(upsideSacrificePct * 100).toFixed(1)}%). Riesgo elevado de que las acciones sean ejecutadas antes del vencimiento.`,
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
    payoffPoints: buildPayoff(underlyingPrice, callStrike, callPremium, shares),
    maxProfit,
    maxLoss,
    alerts,
    confidenceScore: 0,   // FIC: Populated by coverageStrategyAdapter.adaptResultToResponse. (EN)
    generatedAt: new Date().toISOString(),
  };
}
