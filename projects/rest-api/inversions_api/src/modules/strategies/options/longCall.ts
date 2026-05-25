import type { OptionStrategyContract, OptionStrategyResult } from "../optionsStrategyContract";

export function calculateLongCallResult(
  params: OptionStrategyContract
): OptionStrategyResult {
  const breakEven = params.strikePrice + params.premium;
  const maxProfit = Number.POSITIVE_INFINITY;
  const maxLoss = params.premium * params.quantity * 100;
  const requiredMargin = params.premium * params.quantity * 100;

  return {
    ticker: params.ticker,
    optionType: "call",
    direction: "long",
    premium: params.premium,
    quantity: params.quantity,
    breakEven,
    maxProfit,
    maxLoss,
    requiredMargin,
    payoffProfile: [
      { price: params.strikePrice, profitLoss: -maxLoss },
      { price: breakEven, profitLoss: 0 },
      { price: breakEven + 10, profitLoss: 10 * params.quantity * 100 }
    ]
  };
}
