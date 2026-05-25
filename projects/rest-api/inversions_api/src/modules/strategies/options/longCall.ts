import type { OptionStrategyInput, OptionStrategyOutput, PriceScenario } from "../optionsStrategyContract";

/**
 * T083: Long Call Strategy Core
 * 
 * Descripción: El comprador paga una prima para adquirir el derecho de comprar
 * el activo a un precio fijo (strike) antes de la expiración.
 * 
 * P&L = max(S - K, 0) - Premium
 * Ganancia máxima = Ilimitada (si precio sube mucho)
 * Pérdida máxima = Prima pagada
 * Break-even = Strike + Premium
 */

export function calculateLongCallPnL(
  currentPrice: number,
  strikePrice: number,
  premium: number,
  numberOfContracts: number,
  atPrice?: number
): number {
  const priceToUse = atPrice ?? currentPrice;
  const intrinsicValue = Math.max(priceToUse - strikePrice, 0);
  const totalIntrinsicValue = intrinsicValue * numberOfContracts * 100;
  const totalPremiumPaid = premium * numberOfContracts * 100;
  return totalIntrinsicValue - totalPremiumPaid;
}

/**
 * Calculate theta decay (time decay) for Long Call.
 * Simplified linear model: decay = (daysToExp / totalDays) * premium
 * More advanced: exponential decay would accelerate as expiration approaches
 */
export function calculateThetaDecay(
  daysToExpiration: number,
  initialDaysToExp: number,
  premium: number,
  model: "LINEAR" | "EXPONENTIAL" = "LINEAR"
): number {
  if (daysToExpiration <= 0) return premium;
  
  const decayRatio = daysToExpiration / initialDaysToExp;
  
  if (model === "LINEAR") {
    return premium * (1 - decayRatio);
  } else {
    // EXPONENTIAL: decay accelerates near expiration
    return premium * (1 - Math.exp(-2 * (1 - decayRatio)));
  }
}

/**
 * Generate price scenario with P&L calculation
 */
function generateScenario(
  scenarioName: string,
  priceAtScenario: number,
  strikePrice: number,
  premium: number,
  numberOfContracts: number
): PriceScenario {
  const pnl = calculateLongCallPnL(0, strikePrice, premium, numberOfContracts, priceAtScenario);
  const totalCost = premium * numberOfContracts * 100;
  const roi = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
  
  return {
    priceMovement: scenarioName,
    priceAtScenario,
    profitLoss: pnl,
    roi
  };
}

/**
 * Evaluate Long Call strategy with all metrics
 */
export function evaluateLongCall(params: OptionStrategyInput): OptionStrategyOutput {
  // Validation
  if (params.optionType !== "CALL" || params.direction !== "LONG") {
    throw new Error("evaluateLongCall requires CALL type and LONG direction");
  }
  
  const strikePrice = params.strikePrice;
  const premium = params.premiumPerContract;
  const currentPrice = params.currentPrice;
  const numberOfContracts = params.numberOfContracts;
  const daysToExp = params.daysToExpiration;
  
  // Calculate break-even (strike + premium, exact to 0.01)
  const breakEven = parseFloat((strikePrice + premium).toFixed(2));
  
  // Calculate max profit (unlimited if price goes very high)
  // For reporting, assume price reaches strike + 20% (reasonable upside scenario)
  const maxProfit = calculateLongCallPnL(strikePrice * 1.2, strikePrice, premium, numberOfContracts);
  
  // Calculate max loss (premium paid)
  const maxLoss = premium * numberOfContracts * 100;
  
  // Required margin (for long options, margin = premium paid)
  const requiredMargin = premium * numberOfContracts * 100;
  
  // Generate scenarios
  const scenarioAtm = generateScenario(
    "ATM",
    currentPrice,
    strikePrice,
    premium,
    numberOfContracts
  );
  
  const scenarioPlus5 = generateScenario(
    "+5%",
    parseFloat((currentPrice * 1.05).toFixed(2)),
    strikePrice,
    premium,
    numberOfContracts
  );
  
  const scenarioMinus5 = generateScenario(
    "-5%",
    parseFloat((currentPrice * 0.95).toFixed(2)),
    strikePrice,
    premium,
    numberOfContracts
  );
  
  // Risk-adjusted return (profit / max loss)
  const riskAdjustedReturn = maxProfit / maxLoss;
  
  // Probability ITM at expiration (simplified using Black-Scholes approximation)
  // For MVP: assume normal distribution of returns
  const volatility = params.assumptions.impliedVolatility ?? 25; // default 25%
  const expectedMove = (volatility / 100) * currentPrice * Math.sqrt(daysToExp / 365);
  const strikeDiff = strikePrice - currentPrice;
  const zScore = strikeDiff / (expectedMove || 1);
  const probItm = Math.max(0, Math.min(1, 0.5 + zScore / Math.sqrt(2 * Math.PI)));
  
  // Warnings
  const warnings: string[] = [];
  if (premium > currentPrice * 0.10) {
    warnings.push("Premium es >10% del precio actual. Requiere movimiento significativo para ser rentable.");
  }
  if (params.daysToExpiration < 7) {
    warnings.push("Menos de 7 días para expiración. Riesgo de decay acelerado.");
  }
  
  return {
    ticker: params.ticker,
    optionType: "CALL",
    direction: "LONG",
    premium,
    quantity: numberOfContracts,
    breakEvenPrice: breakEven,
    maxProfit,
    maxLoss,
    requiredMargin,
    scenarioAtm,
    scenarioPlus5,
    scenarioMinus5,
    riskAdjustedReturn,
    probabilityItm: probItm,
    warnings,
    calculatedAt: new Date().toISOString(),
    calculationVersion: "1.0",
    assumptions: params.assumptions
  };
}

/**
 * Check if stop-loss should be triggered
 */
export function checkStopLoss(
  currentPrice: number,
  strikePrice: number,
  premium: number,
  stopLossPercentage: number = 50 // 50% of premium lost
): boolean {
  const maxLossAllowed = premium * (stopLossPercentage / 100);
  const currentLoss = Math.max(0, premium - (currentPrice - strikePrice));
  return currentLoss >= maxLossAllowed;
}
