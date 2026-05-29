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
  const totalIntrinsicValue = assignmentValue(intrinsicValue, numberOfContracts);
  const totalPremiumPaid = totalPremium(premium, numberOfContracts);
  return roundMoney(totalIntrinsicValue - totalPremiumPaid);
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
  validateOptionInput(params, "CALL", "LONG");
  
  const strikePrice = params.strikePrice;
  const premium = params.premiumPerContract;
  const currentPrice = params.currentPrice;
  const numberOfContracts = params.numberOfContracts;
  const daysToExp = params.daysToExpiration;
  
  const breakEven = roundMoney(strikePrice + premium);
  
  const maxProfit = Number.POSITIVE_INFINITY;
  
  const maxLoss = totalPremium(premium, numberOfContracts);
  
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
  
  const upsideScenarioPnl = calculateLongCallPnL(0, strikePrice, premium, numberOfContracts, roundMoney(currentPrice * 1.2));
  const riskAdjustedReturn = maxLoss > 0 ? upsideScenarioPnl / maxLoss : 0;
  
  const volatility = params.assumptions.impliedVolatility ?? 25;
  const probItm = probabilityInTheMoney("CALL", currentPrice, strikePrice, volatility, daysToExp);
  
  // Warnings
  const warnings: string[] = [];
  if (premium > currentPrice * 0.10) {
    warnings.push("Premium es >10% del precio actual. Requiere movimiento significativo para ser rentable.");
  }
  if (params.availableCapital < requiredMargin) {
    warnings.push(`Capital disponible insuficiente. Requiere al menos ${requiredMargin} USD para cubrir la prima.`);
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

/**
 * Calculate Long Call result - simplified output for tests
 */
export function calculateLongCallResult(params: OptionStrategyInput | OptionStrategyContract): {
  ticker: string;
  optionType: "call";
  direction: "long";
  breakEven: number;
  maxLoss: number;
  maxProfit: number;
  requiredMargin: number;
} {
  const normalized = normalizeOptionStrategyInput(params, "CALL", "LONG");
  validateOptionInput(normalized, "CALL", "LONG");
  const strikePrice = normalized.strikePrice;
  const premium = normalized.premiumPerContract;
  const numberOfContracts = normalized.numberOfContracts;
  
  const breakEven = roundMoney(strikePrice + premium);
  const maxLoss = totalPremium(premium, numberOfContracts);
  const maxProfit = Number.POSITIVE_INFINITY;
  const requiredMargin = maxLoss;
  
  return {
    ticker: normalized.ticker,
    optionType: "call",
    direction: "long",
    breakEven,
    maxLoss,
    maxProfit,
    requiredMargin
  };
}
