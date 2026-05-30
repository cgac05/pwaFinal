// FIC: Cash Secured Put engine — short put backed by full cash collateral, premium income strategy. (EN)
// FIC: Motor Cash Secured Put — put corta respaldada por colateral en efectivo, estrategia de ingreso por prima. (ES)

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

// FIC: CSP payoff at expiry: premium received minus intrinsic value of assigned put. (EN)
// FIC: Payoff CSP al vencimiento: prima recibida menos valor intrínseco de la put asignada. (ES)
// At any price >= strike the trader keeps the full premium (max profit).
// Below strike the position incurs a loss offset by the premium collected.
function buildPayoff(
  currentPrice: number,
  putStrike: number,
  premiumPerShare: number,
  shares: number
): CoveragePayoffPoint[] {
  const points: CoveragePayoffPoint[] = [];
  for (let i = 0; i <= 20; i++) {
    const p = currentPrice * (0.5 + i * 0.05);
    // Short put P&L: premium received - intrinsic value at expiry
    const putPnl = (premiumPerShare - Math.max(putStrike - p, 0)) * shares;
    points.push({ underlyingPrice: parseFloat(p.toFixed(2)), pnl: putPnl });
  }
  return points;
}

// FIC: Cash Secured Put strategy engine. (EN)
// FIC: Motor de estrategia Cash Secured Put. (ES)
//
// The trader sells an OTM put and holds the cash needed to buy shares if assigned.
// MaxProfit  = premium collected (if price stays above strike at expiry)
// MaxLoss    = strike - premium  (if underlying goes to zero)
// BreakEven  = strike - premium
// Collateral = strike * shares   (cash reserved)
export function analyzeCashSecuredPut(contract: CoverageStrategyContract): CoverageStrategyResult {
  const { strategyId, kind, ticker, shares, underlyingPrice, legs, riskTolerancePct } = contract;

  const putLeg = legs.find((l) => l.type === "put" && l.position === "short");
  const putStrike = putLeg?.strike ?? underlyingPrice * 0.95;
  const putPremium = putLeg?.premium ?? 0; // premium received per share

  // FIC: Break-even is the effective purchase price if assigned: strike minus premium received. (EN)
  // FIC: Break-even es el precio efectivo de compra si se asigna: strike menos prima recibida. (ES)
  const breakEvenPrice = putStrike - putPremium;

  const maxProfit = putPremium * shares;
  // FIC: Theoretical max loss if underlying falls to zero, offset by premium collected. (EN)
  // FIC: Pérdida máxima teórica si el subyacente cae a cero, compensada por la prima recibida. (ES)
  const maxLoss = Math.max(0, putStrike - putPremium) * shares;

  // FIC: Cash collateral required = full strike value of the put obligation. (EN)
  // FIC: Colateral en efectivo requerido = valor completo del strike de la obligación put. (ES)
  const marginRequirement = putStrike * shares;
  const netPremium = putPremium * shares; // positive = cash received
  const netPremiumPerShare = putPremium;

  // FIC: Stop-loss: price at which unrealized loss equals riskTolerancePct of collateral. (EN)
  // FIC: Stop-loss: precio al que la pérdida no realizada iguala riskTolerancePct del colateral. (ES)
  const stopLossBuffer = riskTolerancePct === 0
    ? 0.03
    : clamp(riskTolerancePct * 0.6, 0.02, 0.12);
  const stopLossPrice = putStrike * (1 - stopLossBuffer);

  const downsideRisk = maxLoss;
  const costBenefitRatio = maxProfit > 0 ? maxLoss / maxProfit : 0;
  const exerciseRiskScore = clamp(
    (putStrike - underlyingPrice) <= 0
      ? 0.8                          // ITM at open — high assignment risk
      : (putStrike / underlyingPrice) * 0.5,
    0, 1
  );

  const riskMetrics: CoverageRiskMetrics = {
    riskProfile: "limited",
    maxProtection: 0,               // CSP does not protect existing stock
    protectionFloorPrice: breakEvenPrice,
    netPremium: -netPremium,        // negative = cash RECEIVED (convention: cost is positive)
    netPremiumPerShare: -netPremiumPerShare,
    costBenefitRatio,
    downsideRisk,
    upsideCap: maxProfit,
    breakEvenPrice,
    marginRequirement,
    exerciseRiskScore,
    volatilityStressLoss: maxLoss * 1.25,
    stopLossPrice,
  };

  const alerts: CoverageStrategyAlert[] = [];

  if (underlyingPrice <= putStrike) {
    alerts.push({
      code: "PUT_IN_THE_MONEY",
      severity: "critical",
      message: `La put está ITM (precio ${underlyingPrice.toFixed(2)} <= strike ${putStrike.toFixed(2)}). Asignación inmediata probable.`,
    });
  }

  if (riskTolerancePct > 0 && maxLoss > marginRequirement * riskTolerancePct) {
    alerts.push({
      code: "MAX_LOSS_EXCEEDS_TOLERANCE",
      severity: "warning",
      message: `La pérdida máxima ($${maxLoss.toFixed(2)}) supera la tolerancia al riesgo (${(riskTolerancePct * 100).toFixed(0)}% del colateral).`,
    });
  }

  if (underlyingPrice <= stopLossPrice) {
    alerts.push({
      code: "STOP_LOSS_TRIGGERED",
      severity: "critical",
      message: `Precio ${underlyingPrice.toFixed(2)} <= stop-loss ${stopLossPrice.toFixed(2)}. Considerar cerrar la posición.`,
    });
  }

  const premium = putPremium > 0
    ? putPremium / underlyingPrice
    : 0;
  if (premium < 0.005) {
    alerts.push({
      code: "LOW_PREMIUM_YIELD",
      severity: "info",
      message: `Prima recibida (${(premium * 100).toFixed(2)}%) menor al 0.5% del precio. Rendimiento bajo para el riesgo asumido.`,
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
    payoffPoints: buildPayoff(underlyingPrice, putStrike, putPremium, shares),
    maxProfit,
    maxLoss,
    alerts,
    confidenceScore: 0,   // FIC: Populated by coverageStrategyAdapter.adaptResultToResponse. (EN)
    generatedAt: new Date().toISOString(),
  };
}
