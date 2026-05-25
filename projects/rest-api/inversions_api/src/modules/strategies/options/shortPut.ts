import type { OptionStrategyInput, OptionStrategyOutput, PriceScenario, OptionStrategyContract } from "../optionsStrategyContract";

/**
 * T086: Short Put Strategy Core
 * 
 * Descripción: El vendedor recibe una prima a cambio de la obligación de comprar
 * el activo a un precio fijo (strike) si el comprador lo ejerce.
 * 
 * P&L = Premium - max(K - S, 0)
 * Ganancia máxima = Prima recibida (si precio stays >= strike)
 * Pérdida máxima = Strike - Premium (si precio cae a 0)
 * Break-even = Strike - Premium
 */

export function calculateShortPutPnL(
  currentPrice: number,
  strikePrice: number,
  premium: number,
  numberOfContracts: number,
  atPrice?: number
): number {
  const priceToUse = atPrice ?? currentPrice;
  const assignmentObligationValue = Math.max(strikePrice - priceToUse, 0);
  const totalObligation = assignmentObligationValue * numberOfContracts * 100;
  const totalPremiumReceived = premium * numberOfContracts * 100;
  return totalPremiumReceived - totalObligation;
}

/**
 * Short Put benefits from theta decay (premium decays in seller's favor)
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
  const pnl = calculateShortPutPnL(0, strikePrice, premium, numberOfContracts, priceAtScenario);
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
 * Evaluate Short Put strategy with all metrics
 */
export function evaluateShortPut(params: OptionStrategyInput): OptionStrategyOutput {
  // Validation
  if (params.optionType !== "PUT" || params.direction !== "SHORT") {
    throw new Error("evaluateShortPut requires PUT type and SHORT direction");
  }
  
  const strikePrice = params.strikePrice;
  const premium = params.premiumPerContract;
  const currentPrice = params.currentPrice;
  const numberOfContracts = params.numberOfContracts;
  const daysToExp = params.daysToExpiration;
  
  // Calculate break-even (strike - premium, exact to 0.01)
  const breakEven = parseFloat((strikePrice - premium).toFixed(2));
  
  // Calculate max profit (premium received if price stays >= strike)
  const maxProfit = premium * numberOfContracts * 100;
  
  // Calculate max loss (strike - premium if price falls to 0)
  // More realistic: assume price falls to 50% of current
  const maxLoss = (strikePrice - premium) * numberOfContracts * 100;
  
  // Required margin (approximately 20% of strike value)
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
  
  // Risk-adjusted return (profit / max loss)
  const riskAdjustedReturn = maxLoss > 0 ? maxProfit / maxLoss : Infinity;
  
  // Probability ITM at expiration (probability of assignment)
  // For puts, ITM means price < strike
  const volatility = params.assumptions.impliedVolatility ?? 25; // default 25%
  const expectedMove = (volatility / 100) * currentPrice * Math.sqrt(daysToExp / 365);
  const strikeDiff = strikePrice - currentPrice;
  const zScore = strikeDiff / (expectedMove || 1);
  const probItm = Math.max(0, Math.min(1, 0.5 + zScore / Math.sqrt(2 * Math.PI)));
  
  // Warnings for Short Put
  const warnings: string[] = [];
  if (probItm > 0.7) {
    warnings.push("⚠️ IMPORTANTE: Probabilidad alta de asignación (> 70%). Estar preparado para comprar acciones.");
  }
  if (currentPrice < strikePrice) {
    warnings.push("⚠️ Short Put está ITM (In-The-Money). Mayor riesgo de asignación.");
  }
  warnings.push("⚠️ Máxima pérdida = " + maxLoss + " USD. Requiere capital de margen suficiente.");
  
  return {
    ticker: params.ticker,
    optionType: "PUT",
    direction: "SHORT",
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
 * Check if margin alert should trigger
 */
export function checkMarginAlert(
  currentPrice: number,
  strikePrice: number,
  premium: number,
  marginLevel: number = 0.75
): boolean {
  // If price falls significantly, margin requirement increases
  const marketToMarketLoss = Math.max(0, strikePrice - currentPrice);
  const premiumBenefit = premium;
  return marketToMarketLoss > premiumBenefit * (1 - marginLevel);
}

/**
 * Calculate Short Put result - simplified output for tests
 */
export function calculateShortPutResult(params: OptionStrategyInput | OptionStrategyContract): {
  ticker: string;
  optionType: "put";
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
  
  const breakEven = strikePrice - premium;
  const maxLoss = (strikePrice - premium) * numberOfContracts * 100;
  const maxProfit = premium * numberOfContracts * 100;
  const requiredMargin = parseFloat((strikePrice * numberOfContracts * 100 * 0.2).toFixed(2));
  
  return {
    ticker: params.ticker,
    optionType: "put",
    direction: "short",
    breakEven,
    maxLoss,
    maxProfit,
    requiredMargin
  };
}
