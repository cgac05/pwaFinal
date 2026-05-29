import type { OptionStrategyInput, OptionStrategyOutput, PriceScenario, OptionStrategyContract } from "../optionsStrategyContract";
import {
  assignmentValue,
  normalizeOptionStrategyInput,
  probabilityInTheMoney,
  roundMoney,
  totalPremium,
  validateOptionInput
} from "./optionMath";

/**
 * T084: Long Put Strategy Core
 * 
 * Descripción: El comprador paga una prima para adquirir el derecho de vender
 * el activo a un precio fijo (strike) antes de la expiración.
 * 
 * P&L = max(K - S, 0) - Premium
 * Ganancia máxima = Strike - Premium (si precio cae a 0)
 * Pérdida máxima = Prima pagada
 * Break-even = Strike - Premium
 */

export function calculateLongPutPnL(
  currentPrice: number,
  strikePrice: number,
  premium: number,
  numberOfContracts: number,
  atPrice?: number
): number {
  const priceToUse = atPrice ?? currentPrice;
  const intrinsicValue = Math.max(strikePrice - priceToUse, 0);
  const totalIntrinsicValue = assignmentValue(intrinsicValue, numberOfContracts);
  const totalPremiumPaid = totalPremium(premium, numberOfContracts);
  return roundMoney(totalIntrinsicValue - totalPremiumPaid);
}

/**
 * Calculate theta decay for Long Put (similar to Long Call)
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
 * Generate price scenario with P&L calculation (inverted logic for puts)
 */
function generateScenario(
  scenarioName: string,
  priceAtScenario: number,
  strikePrice: number,
  premium: number,
  numberOfContracts: number
): PriceScenario {
  const pnl = calculateLongPutPnL(0, strikePrice, premium, numberOfContracts, priceAtScenario);
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
 * Evaluate Long Put strategy with all metrics
 */
export function evaluateLongPut(params: OptionStrategyInput): OptionStrategyOutput {
  validateOptionInput(params, "PUT", "LONG");
  
  const strikePrice = params.strikePrice;
  const premium = params.premiumPerContract;
  const currentPrice = params.currentPrice;
  const numberOfContracts = params.numberOfContracts;
  const daysToExp = params.daysToExpiration;
  
  const breakEven = roundMoney(strikePrice - premium);
  
  // Calculate max profit (strike - premium if price falls to 0)
  const maxProfit = assignmentValue(Math.max(strikePrice - premium, 0), numberOfContracts);
  
  // Calculate max loss (premium paid)
  const maxLoss = totalPremium(premium, numberOfContracts);
  
  // Required margin (for long options, margin = premium paid)
  const requiredMargin = maxLoss;
  
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
  
  // Probability ITM at expiration (simplified)
  // For puts, ITM means price < strike
  const volatility = params.assumptions.impliedVolatility ?? 25;
  const probItm = probabilityInTheMoney("PUT", currentPrice, strikePrice, volatility, daysToExp);
  
  // Warnings
  const warnings: string[] = [];
  if (premium > currentPrice * 0.10) {
    warnings.push("Premium es >10% del precio actual. Requiere movimiento bajista significativo para ser rentable.");
  }
  if (params.daysToExpiration < 7) {
    warnings.push("Menos de 7 días para expiración. Riesgo de decay acelerado.");
  }
  if (params.availableCapital < requiredMargin) {
    warnings.push(`Capital disponible insuficiente. Requiere al menos ${requiredMargin} USD para cubrir la prima.`);
  }
  if (breakEven < 0) {
    warnings.push("Break-even por debajo de 0. Estrategia requiere caída muy significativa para ser rentable.");
  }
  
  return {
    ticker: params.ticker,
    optionType: "PUT",
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
 * Check if stop-loss should be triggered for Long Put
 */
export function checkStopLoss(
  currentPrice: number,
  strikePrice: number,
  premium: number,
  stopLossPercentage: number = 50 // 50% of premium lost
): boolean {
  const maxLossAllowed = premium * (stopLossPercentage / 100);
  const currentLoss = Math.max(0, premium - (strikePrice - currentPrice));
  return currentLoss >= maxLossAllowed;
}

/**
 * Calculate Long Put result - simplified output for tests
 */
export function calculateLongPutResult(params: OptionStrategyInput | OptionStrategyContract): {
  ticker: string;
  optionType: "put";
  direction: "long";
  breakEven: number;
  maxLoss: number;
  maxProfit: number;
  requiredMargin: number;
} {
  const normalized = normalizeOptionStrategyInput(params, "PUT", "LONG");
  validateOptionInput(normalized, "PUT", "LONG");
  const strikePrice = normalized.strikePrice;
  const premium = normalized.premiumPerContract;
  const numberOfContracts = normalized.numberOfContracts;
  
  const breakEven = roundMoney(strikePrice - premium);
  const maxLoss = totalPremium(premium, numberOfContracts);
  const maxProfit = assignmentValue(Math.max(strikePrice - premium, 0), numberOfContracts);
  const requiredMargin = maxLoss;
  
  return {
    ticker: normalized.ticker,
    optionType: "put",
    direction: "long",
    breakEven,
    maxLoss,
    maxProfit,
    requiredMargin
  };
}
