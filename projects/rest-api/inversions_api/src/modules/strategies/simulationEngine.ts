/**
 * T087: Motor de simulación temporal de estrategias.
 */
import type { OptionStrategyContract } from "./optionsStrategyContract";

export interface SimulationResult {
  ticker: string;
  strategyType: string;
  startPrice: number;
  endPrice: number;
  pnlPath: number[];
  maxDrawdown: number;
  sharpeRatio: number;
}

export function simulateStrategy(
  params: OptionStrategyContract,
  pricePath: number[]
): SimulationResult {
  const pnlPath = pricePath.map((price) => price - params.strikePrice - params.premium);
  const maxDrawdown = Math.min(...pnlPath);
  const average = pnlPath.reduce((sum, value) => sum + value, 0) / pnlPath.length;
  const volatility = Math.sqrt(
    pnlPath.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / pnlPath.length
  );
  const sharpeRatio = volatility === 0 ? 0 : average / volatility;

  return {
    ticker: params.ticker,
    strategyType: `${params.direction}_${params.optionType}`,
    startPrice: pricePath[0] ?? 0,
    endPrice: pricePath[pricePath.length - 1] ?? 0,
    pnlPath,
    maxDrawdown,
    sharpeRatio
  };
}
