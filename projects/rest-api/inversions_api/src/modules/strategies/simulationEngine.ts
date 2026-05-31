import type { OptionStrategyContract } from "./optionsStrategyContract";
import { normalizeOptionStrategyInput, roundMoney, totalPremium } from "./options/optionMath";

export interface StrategySimulationPoint {
  price: number;
  profitLoss: number;
  roi: number;
}

export interface StrategySimulationResult {
  ticker: string;
  optionType: "CALL" | "PUT";
  direction: "LONG" | "SHORT";
  breakEvenPrice: number;
  points: StrategySimulationPoint[];
}

function payoffAtPrice(
  optionType: "CALL" | "PUT",
  direction: "LONG" | "SHORT",
  price: number,
  strike: number,
  premium: number,
  contracts: number
): number {
  const intrinsic = optionType === "CALL"
    ? Math.max(price - strike, 0)
    : Math.max(strike - price, 0);
  const intrinsicTotal = intrinsic * contracts * 100;
  const premiumTotal = totalPremium(premium, contracts);
  return roundMoney(direction === "LONG" ? intrinsicTotal - premiumTotal : premiumTotal - intrinsicTotal);
}

export function simulateStrategy(contract: OptionStrategyContract, pricePath: number[]): StrategySimulationResult {
  const normalized = normalizeOptionStrategyInput(contract);
  const capitalAtRisk = Math.max(totalPremium(normalized.premiumPerContract, normalized.numberOfContracts), 1);
  const breakEvenPrice = normalized.optionType === "CALL"
    ? normalized.strikePrice + normalized.premiumPerContract
    : normalized.strikePrice - normalized.premiumPerContract;

  return {
    ticker: normalized.ticker,
    optionType: normalized.optionType,
    direction: normalized.direction,
    breakEvenPrice: roundMoney(breakEvenPrice),
    points: pricePath.map((price) => {
      const profitLoss = payoffAtPrice(
        normalized.optionType,
        normalized.direction,
        price,
        normalized.strikePrice,
        normalized.premiumPerContract,
        normalized.numberOfContracts
      );
      return {
        price,
        profitLoss,
        roi: roundMoney((profitLoss / capitalAtRisk) * 100)
      };
    })
  };
}
