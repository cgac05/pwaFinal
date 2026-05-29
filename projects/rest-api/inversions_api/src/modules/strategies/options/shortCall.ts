import type { OptionStrategyInput, OptionStrategyOutput, PriceScenario, OptionStrategyContract } from "../optionsStrategyContract";
import {
  assignmentValue,
  calculateShortOptionMargin,
  normalizeOptionStrategyInput,
  probabilityInTheMoney,
  roundMoney,
  totalPremium,
  validateOptionInput
} from "./optionMath";

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
  const totalObligation = assignmentValue(assignmentObligationValue, numberOfContracts);
  const totalPremiumReceived = totalPremium(premium, numberOfContracts);
  return roundMoney(totalPremiumReceived - totalObligation);
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
  validateOptionInput(params, "CALL", "SHORT");
  
  const strikePrice = params.strikePrice;
  const premium = params.premiumPerContract;
  const currentPrice = params.currentPrice;
  const numberOfContracts = params.numberOfContracts;
  const daysToExp = params.daysToExpiration;
  
  const breakEven = roundMoney(strikePrice + premium);
  
  const maxProfit = totalPremium(premium, numberOfContracts);
  
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
  const requiredMargin = calculateShortOptionMargin(currentPrice, strikePrice, premium, numberOfContracts, "CALL");
  
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
  
  const riskAdjustedReturn = 0; // Unlimited max loss, so this is intentionally capped.
  
  const volatility = params.assumptions.impliedVolatility ?? 25;
  const probItm = probabilityInTheMoney("CALL", currentPrice, strikePrice, volatility, daysToExp);
  
  // CRITICAL WARNINGS for Short Call
  const warnings: string[] = [];
  warnings.push("⚠️ RIESGO CRÍTICO: Pérdida de capital ILIMITADA si el precio sube por encima del break-even.");
  warnings.push("⚠️ Requiere capital de margen significativo (mínimo " + requiredMargin + " USD).");
  if (currentPrice > strikePrice) {
    warnings.push("⚠️ IMPORTANTE: Short Call está ITM (In-The-Money) actualmente. Riesgo de asignación temprana.");
  }
  if (params.availableCapital < requiredMargin) {
    warnings.push(`⚠️ Capital disponible insuficiente para margen estimado: ${requiredMargin} USD.`);
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
    riskAdjustedReturn,
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
  const normalized = normalizeOptionStrategyInput(params, "CALL", "SHORT");
  validateOptionInput(normalized, "CALL", "SHORT");
  const strikePrice = normalized.strikePrice;
  const premium = normalized.premiumPerContract;
  const numberOfContracts = normalized.numberOfContracts;
  
  const breakEven = roundMoney(strikePrice + premium);
  const maxLoss = Number.POSITIVE_INFINITY;
  const maxProfit = totalPremium(premium, numberOfContracts);
  const requiredMargin = calculateShortOptionMargin(normalized.currentPrice, strikePrice, premium, numberOfContracts, "CALL");
  
  return {
    ticker: normalized.ticker,
    optionType: "call",
    direction: "short",
    breakEven,
    maxLoss,
    maxProfit,
    requiredMargin
  };
}
