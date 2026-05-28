import type { OptionStrategyInput, OptionStrategyOutput, PriceScenario, OptionStrategyContract } from "../optionsStrategyContract";

/**
 * T085: Short Call Strategy Core
 * 
 * Descripción: El vendedor recibe una prima a cambio de la obligación de vender
 * el activo a un precio fijo (strike) si el comprador lo ejerce.
 * 
 * P&L = Premium - max(S - K, 0)
 * Ganancia máxima = Prima recibida (si precio stays <= strike)
 * Pérdida máxima = ILIMITADA (si precio sube mucho)
 * Break-even = Strike + Premium
 * 
 * RIESGO CRÍTICO: Pérdida ilimitada. Requiere capital de margen significativo.
 */

export function calculateShortCallPnL(
  currentPrice: number,
  strikePrice: number,
  premium: number,
  numberOfContracts: number,
  atPrice?: number
): number {
  const priceToUse = atPrice ?? currentPrice;
  const assignmentObligationValue = Math.max(priceToUse - strikePrice, 0);
  const totalObligation = assignmentObligationValue * numberOfContracts * 100;
  const totalPremiumReceived = premium * numberOfContracts * 100;
  return totalPremiumReceived - totalObligation;
}

/**
 * Short Call benefits from theta decay (premium decays in seller's favor)
 */
export function calculateThetaDecay(
  daysToExpiration: number,
  initialDaysToExp: number,
  premium: number,
  model: "LINEAR" | "EXPONENTIAL" = "LINEAR"
): number {
  if (daysToExpiration <= 0) return 0; // Premium fully decayed to seller's benefit
  
  const decayRatio = daysToExpiration / initialDaysToExp;
  
  if (model === "LINEAR") {
    // Seller benefits from decay: premium * (1 - decayRatio)
    return premium * (1 - decayRatio);
  } else {
    // EXPONENTIAL: decay accelerates near expiration (in seller's favor)
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
  const pnl = calculateShortCallPnL(0, strikePrice, premium, numberOfContracts, priceAtScenario);
  const maxProfit = premium * numberOfContracts * 100;
  const roi = maxProfit > 0 ? (pnl / maxProfit) * 100 : 0;
  
  return {
    priceMovement: scenarioName,
    priceAtScenario,
    profitLoss: pnl,
    roi
  };
}

/**
 * Evaluate Short Call strategy with all metrics
 */
export function evaluateShortCall(params: OptionStrategyInput): OptionStrategyOutput {
  // Validation
  if (params.optionType !== "CALL" || params.direction !== "SHORT") {
    throw new Error("evaluateShortCall requires CALL type and SHORT direction");
  }
  
  const strikePrice = params.strikePrice;
  const premium = params.premiumPerContract;
  const currentPrice = params.currentPrice;
  const numberOfContracts = params.numberOfContracts;
  const daysToExp = params.daysToExpiration;
  
  // Calculate break-even (strike + premium, exact to 0.01)
  const breakEven = parseFloat((strikePrice + premium).toFixed(2));
  
  // Calculate max profit (premium received if price stays <= strike)
  const maxProfit = premium * numberOfContracts * 100;
  
  // Calculate max loss (UNLIMITED - critical warning)
  // For reporting purposes, assume worst case: price reaches strike * 2
  const maxLossReportingPrice = strikePrice * 2;
  const maxLossReporting = calculateShortCallPnL(
    0,
    strikePrice,
    premium,
    numberOfContracts,
    maxLossReportingPrice
  );
  
  // Required margin (approximately 20% of strike value, simplified)
  // Real brokers use more complex models (SPAN, etc.)
  const requiredMargin = parseFloat((strikePrice * numberOfContracts * 100 * 0.2).toFixed(2));
  
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
  
  // Risk-adjusted return (profit / max loss) - infinite for short calls
  const riskAdjustedReturn = Infinity; // Undefined due to unlimited loss
  
  // Probability ITM at expiration (probability of assignment)
  const volatility = params.assumptions.impliedVolatility ?? 25; // default 25%
  const expectedMove = (volatility / 100) * currentPrice * Math.sqrt(daysToExp / 365);
  const strikeDiff = strikePrice - currentPrice;
  const zScore = strikeDiff / (expectedMove || 1);
  const probItm = Math.max(0, Math.min(1, 0.5 + zScore / Math.sqrt(2 * Math.PI)));
  
  // CRITICAL WARNINGS for Short Call
  const warnings: string[] = [];
  warnings.push("⚠️ RIESGO CRÍTICO: Pérdida de capital ILIMITADA si el precio sube por encima del break-even.");
  warnings.push("⚠️ Requiere capital de margen significativo (mínimo " + requiredMargin + " USD).");
  if (currentPrice > strikePrice) {
    warnings.push("⚠️ IMPORTANTE: Short Call está OTM (Out-of-The-Money) actualmente. Riesgo de asignación temprana.");
  }
  warnings.push("⚠️ Recomendado SOLO con convicción alta en rango de precios acotado o con cobertura (hedge).");
  
  return {
    ticker: params.ticker,
    optionType: "CALL",
    direction: "SHORT",
    premium,
    quantity: numberOfContracts,
    breakEvenPrice: breakEven,
    maxProfit,
    maxLoss: Number.POSITIVE_INFINITY, // Unlimited loss
    requiredMargin,
    scenarioAtm,
    scenarioPlus5,
    scenarioMinus5,
    riskAdjustedReturn: Infinity,
    probabilityItm: probItm,
    warnings,
    calculatedAt: new Date().toISOString(),
    calculationVersion: "1.0",
    assumptions: params.assumptions
  };
}

/**
 * Check if margin alert should trigger (losing too much premium benefit)
 */
export function checkMarginAlert(
  currentPrice: number,
  strikePrice: number,
  premium: number,
  marginLevel: number = 0.75 // 75% margin level alert
): boolean {
  // If price rises significantly, margin requirement increases
  const marketToMarketLoss = Math.max(0, currentPrice - strikePrice);
  const premiumBenefit = premium;
  return marketToMarketLoss > premiumBenefit * (1 - marginLevel);
}

/**
 * Calculate Short Call result - simplified output for tests
 */
export function calculateShortCallResult(params: OptionStrategyInput | OptionStrategyContract): {
  ticker: string;
  optionType: "call";
  direction: "short";
  breakEven: number;
  maxLoss: number;
  maxProfit: number;
  requiredMargin: number;
} {
  const strikePrice = params.strikePrice;
  // Handle both property name variants
  const premium = "premiumPerContract" in params ? params.premiumPerContract : (params as any).premium;
  const numberOfContracts = "numberOfContracts" in params ? params.numberOfContracts : (params as any).quantity;
  
  const breakEven = strikePrice + premium;
  const maxLoss = Number.POSITIVE_INFINITY;
  const maxProfit = premium * numberOfContracts * 100;
  const requiredMargin = parseFloat((strikePrice * numberOfContracts * 100 * 0.2).toFixed(2));
  
  return {
    ticker: params.ticker,
    optionType: "call",
    direction: "short",
    breakEven,
    maxLoss,
    maxProfit,
    requiredMargin
  };
}
