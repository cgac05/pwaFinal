// FIC: Collar engine — long put + short call with dual stop-loss bands and exercise risk score. (EN)
// FIC: Motor Collar — put long + call corto con bandas duales de stop-loss y score de riesgo de ejercicio. (ES)

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

// FIC: Collar payoff at expiry — floored at putStrike, capped at callStrike. (EN)
// FIC: Payoff del collar al vencimiento — suelo en putStrike, techo en callStrike. (ES)
function buildPayoff(
  currentPrice: number,
  putStrike: number,
  callStrike: number,
  netPremiumPerShare: number,
  shares: number
): CoveragePayoffPoint[] {
  const points: CoveragePayoffPoint[] = [];
  for (let i = 0; i <= 20; i++) {
    const p = currentPrice * (0.5 + i * 0.05);
    // Long stock + long put + short call at expiry
    const stockPnl = (p - currentPrice) * shares;
    const putPnl = (Math.max(putStrike - p, 0)) * shares;           // long put
    const callPnl = -(Math.max(p - callStrike, 0)) * shares;        // short call
    const premiumCost = -netPremiumPerShare * shares;
    points.push({ underlyingPrice: parseFloat(p.toFixed(2)), pnl: stockPnl + putPnl + callPnl + premiumCost });
  }
  return points;
}

// FIC: Collar strategy engine — T1101 bugfix integrated: exposes stopLossLowPrice + stopLossHighPrice. (EN)
// FIC: Motor de estrategia Collar — bugfix T1101 integrado: expone stopLossLowPrice + stopLossHighPrice. (ES)
export function analyzeCollar(contract: CoverageStrategyContract): CoverageStrategyResult {
  const { strategyId, kind, ticker, shares, underlyingPrice, legs, riskTolerancePct } = contract;

  const putLeg = legs.find((l) => l.type === "put" && l.position === "long");
  const callLeg = legs.find((l) => l.type === "call" && l.position === "short");

  const putStrike = putLeg?.strike ?? underlyingPrice * 0.95;
  const callStrike = callLeg?.strike ?? underlyingPrice * 1.05;
  const putPremium = putLeg?.premium ?? 0;
  const callPremium = callLeg?.premium ?? 0;

  // FIC: Net premium: positive = net debit (pay to open), negative = net credit (receive premium). (EN)
  // FIC: Prima neta: positivo = débito neto (se paga al abrir), negativo = crédito neto (se recibe prima). (ES)
  const netPremiumPerShare = putPremium - callPremium;

  const maxProfit = Math.max(0, callStrike - underlyingPrice - netPremiumPerShare) * shares;
  const maxLoss = Math.max(0, underlyingPrice - putStrike + netPremiumPerShare) * shares;
  const protectionCeilingPrice = callStrike - netPremiumPerShare;
  const protectionFloorPrice = putStrike - netPremiumPerShare;
  const breakEvenPrice = underlyingPrice + netPremiumPerShare;
  const netPremium = netPremiumPerShare * shares;

  // FIC: Exercise risk score: clamp01(downside*0.5 + upside*0.5) — weights 0.5+0.5 (NOT 0.6+0.6). (EN)
  // FIC: Score de riesgo de ejercicio: clamp01(bajada*0.5 + subida*0.5) — pesos 0.5+0.5 (NO 0.6+0.6). (ES)
  const positionValue = underlyingPrice * shares;
  const downsideRisk = clamp(maxLoss / positionValue, 0, 1);
  const upsideCap = clamp(1 - (callStrike - underlyingPrice) / underlyingPrice, 0, 1);
  const exerciseRiskScore = clamp(downsideRisk * 0.5 + upsideCap * 0.5, 0, 1);

  // FIC: Dual stop-loss bands — T1101: stopLossLow + stopLossHigh + backward-compat stopLossPrice. (EN)
  // FIC: Bandas duales de stop-loss — T1101: stopLossLow + stopLossHigh + stopLossPrice retrocompat. (ES)
  const stopLossBufferPct = riskTolerancePct > 0 ? clamp(riskTolerancePct * 0.4, 0.02, 0.08) : 0.04;
  const stopLossLow = putStrike * (1 - stopLossBufferPct);
  const stopLossHigh = callStrike * (1 + stopLossBufferPct);

  const riskMetrics: CoverageRiskMetrics = {
    riskProfile: "limited",
    maxProtection: putStrike * shares,
    protectionFloorPrice,
    protectionCeilingPrice,
    netPremium,
    netPremiumPerShare,
    costBenefitRatio: netPremium !== 0 ? Math.abs(maxLoss / netPremium) : 0,
    downsideRisk: maxLoss,
    upsideCap: maxProfit,
    breakEvenPrice,
    marginRequirement: 0,
    exerciseRiskScore,
    volatilityStressLoss: maxLoss * 1.15,
    stopLossPrice: stopLossLow,         // retrocompatibility
    stopLossLowPrice: stopLossLow,
    stopLossHighPrice: stopLossHigh,
  };

  // ─── Alerts ───────────────────────────────────────────────────────────────

  const alerts: CoverageStrategyAlert[] = [];

  // FIC: COLLAR_CALL_BELOW_MARKET: call strike ≤ current price is immediately exercised. (EN)
  // FIC: COLLAR_CALL_BELOW_MARKET: strike del call ≤ precio actual se ejerce de inmediato. (ES)
  if (callStrike <= underlyingPrice) {
    alerts.push({
      code: "COLLAR_CALL_BELOW_MARKET",
      severity: "critical",
      message: `Call strike $${callStrike.toFixed(2)} ≤ current price $${underlyingPrice.toFixed(2)}. Position will be called immediately.`,
    });
  }

  // FIC: COLLAR_LOWER_BAND_BROKEN: price fell through the lower stop-loss band. (EN)
  // FIC: COLLAR_LOWER_BAND_BROKEN: el precio rompió la banda inferior de stop-loss. (ES)
  if (underlyingPrice <= stopLossLow) {
    alerts.push({
      code: "COLLAR_LOWER_BAND_BROKEN",
      severity: "critical",
      message: `Price $${underlyingPrice.toFixed(2)} broke below lower band $${stopLossLow.toFixed(2)}. Consider exercising put.`,
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
    payoffPoints: buildPayoff(underlyingPrice, putStrike, callStrike, netPremiumPerShare, shares),
    maxProfit,
    maxLoss,
    alerts,
    confidenceScore: 0.72,
    generatedAt: new Date().toISOString(),
  };
}
