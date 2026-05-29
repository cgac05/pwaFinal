/**
 * T087: Motor de simulación temporal de estrategias de opciones.
 * 
 * Simula el P&L a lo largo del tiempo considerando:
 * - Movimiento del subyacente (precio del activo)
 * - Theta decay (decaimiento temporal)
 * - Cambios en volatilidad implícita
 * - Reconversión a opciones a medida que el tiempo pasa
 */

import type { OptionStrategyInput, OptionStrategyOutput, OptionStrategyContract } from "./optionsStrategyContract";
import { evaluateLongCall } from "./options/longCall";
import { evaluateLongPut } from "./options/longPut";
import { evaluateShortCall } from "./options/shortCall";
import { evaluateShortPut } from "./options/shortPut";
import { normalizeOptionStrategyInput } from "./options/optionMath";

export interface DailySimulationPoint {
  day: number;
  date: string;
  underlayingPrice: number;
  profitLoss: number;
  theta: number; // Time decay impact
  gamma: number; // Sensitivity to price changes
  vega: number; // Sensitivity to volatility
  impliedVolatility: number;
}

export interface SimulationResult {
  ticker: string;
  strategyType: string;
  initialPrice: number;
  finalPrice: number;
  
  // P&L timeline
  pnlPath: number[]; // Daily P&L values
  maxDrawdown: number; // Maximum loss encountered
  maxRunup: number; // Maximum gain encountered
  cumulativePnL: number; // Final P&L
  
  // Risk metrics
  sharpeRatio: number; // Risk-adjusted return
  sortinoRatio: number; // Only penalizes downside volatility
  
  // Breakeven analysis
  breakevenDate?: string; // When P&L turns positive
  daysAboveBreakeven: number;
  
  // Metadata
  dailyPoints: DailySimulationPoint[];
  simulationVersion: string;
}

/**
 * Simulate option strategy over time
 * Can be called with just params and pricePathDaily for simple simulations
 */
export function simulateStrategy(
  params: OptionStrategyInput | OptionStrategyContract,
  pricePathDaily: number[],
  volatilityPathDaily?: number[],
  daysToSimulate?: number
): SimulationResult {
  const normalizedParams: OptionStrategyInput = normalizeOptionStrategyInput(params);
  
  // Use defaults if not provided
  const assumptions = normalizedParams.assumptions || { impliedVolatility: 25 };
  const volPath = volatilityPathDaily ?? Array(pricePathDaily.length).fill(assumptions.impliedVolatility ?? 25);
  const simDays = daysToSimulate ?? pricePathDaily.length;
  
  // Create lowercase strategyType for consistent output format
  const strategyTypeUpper = `${normalizedParams.direction}_${normalizedParams.optionType}`;
  const strategyType = strategyTypeUpper.toLowerCase();
  const dailyPoints: DailySimulationPoint[] = [];
  const pnlPath: number[] = [];
  
  let cumulativePnL = 0;
  let maxDrawdown = 0;
  let maxRunup = 0;
  let breakevenDay: number | undefined;
  
  // Simulate each day
  for (let day = 0; day < simDays && day < pricePathDaily.length; day++) {
    const currentPrice = pricePathDaily[day];
    const currentVol = volPath[day] ?? assumptions.impliedVolatility ?? 25;
    const daysRemaining = normalizedParams.daysToExpiration - day;
    
    if (daysRemaining <= 0) break; // Option expired
    
    // Recalculate strategy parameters for this day
    const updatedParams: OptionStrategyInput = {
      ...normalizedParams,
      currentPrice,
      daysToExpiration: daysRemaining,
      assumptions: {
        ...assumptions,
        impliedVolatility: currentVol
      }
    };
    
    // Evaluate strategy at this point in time
    let strategyOutput: OptionStrategyOutput;
    switch (strategyTypeUpper) {
      case "LONG_CALL":
        strategyOutput = evaluateLongCall(updatedParams);
        break;
      case "LONG_PUT":
        strategyOutput = evaluateLongPut(updatedParams);
        break;
      case "SHORT_CALL":
        strategyOutput = evaluateShortCall(updatedParams);
        break;
      case "SHORT_PUT":
        strategyOutput = evaluateShortPut(updatedParams);
        break;
      default:
        throw new Error(`Unknown strategy type: ${strategyTypeUpper}`);
    }
    
    // Extract P&L from current scenario
    const dailyPnL = strategyOutput.scenarioAtm.profitLoss;
    pnlPath.push(dailyPnL);
    cumulativePnL = dailyPnL;
    
    // Track maximum drawdown and runup
    if (dailyPnL < maxDrawdown) {
      maxDrawdown = dailyPnL;
    }
    if (dailyPnL > maxRunup) {
      maxRunup = dailyPnL;
      if (!breakevenDay && dailyPnL > 0) {
        breakevenDay = day;
      }
    }
    
    // Calculate Greeks (simplified)
    const theta = calculateTheta(daysRemaining, normalizedParams.daysToExpiration, dailyPnL);
    const gamma = calculateGamma(currentPrice, params.strikePrice, currentVol, daysRemaining);
    const vega = calculateVega(currentVol, params.strikePrice, daysRemaining);
    
    dailyPoints.push({
      day,
      date: new Date(new Date().getTime() + day * 24 * 60 * 60 * 1000).toISOString(),
      underlayingPrice: currentPrice,
      profitLoss: dailyPnL,
      theta,
      gamma,
      vega,
      impliedVolatility: currentVol
    });
  }
  
  // Calculate risk metrics
  const avgReturn = pnlPath.length > 0 ? pnlPath.reduce((a, b) => a + b, 0) / pnlPath.length : 0;
  const stdDev = calculateStdDev(pnlPath, avgReturn);
  const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
  
  const downside = pnlPath.filter(x => x < 0);
  const downstdDev = calculateStdDev(downside, 0);
  const sortinoRatio = downstdDev > 0 ? avgReturn / downstdDev : 0;
  
  const daysAboveBreakeven = pnlPath.filter(x => x > 0).length;
  
  return {
    ticker: params.ticker,
    strategyType,
    initialPrice: pricePathDaily[0] ?? 0,
    finalPrice: pricePathDaily[pricePathDaily.length - 1] ?? 0,
    pnlPath,
    maxDrawdown,
    maxRunup,
    cumulativePnL,
    sharpeRatio,
    sortinoRatio,
    breakevenDate: breakevenDay ? new Date(new Date().getTime() + breakevenDay * 24 * 60 * 60 * 1000).toISOString() : undefined,
    daysAboveBreakeven,
    dailyPoints,
    simulationVersion: "1.0"
  };
}

/**
 * Calculate simplified Theta (time decay)
 */
function calculateTheta(daysRemaining: number, initialDays: number, currentPnL: number): number {
  const daysPassed = initialDays - daysRemaining;
  return daysPassed > 0 ? currentPnL / daysPassed : 0;
}

/**
 * Calculate simplified Gamma (convexity)
 */
function calculateGamma(
  spotPrice: number,
  strikePrice: number,
  volatility: number,
  daysToExp: number
): number {
  const moneyness = spotPrice / strikePrice;
  const sqrtDaysToExp = Math.sqrt(daysToExp / 365);
  return 1 / (spotPrice * volatility * sqrtDaysToExp);
}

/**
 * Calculate simplified Vega (volatility sensitivity)
 */
function calculateVega(
  volatility: number,
  strikePrice: number,
  daysToExp: number
): number {
  const sqrtDaysToExp = Math.sqrt(daysToExp / 365);
  return strikePrice * sqrtDaysToExp * 0.01;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}
