import type { OptionStrategyContract, OptionStrategyResult } from "../optionsStrategyContract";

export function calculateShortCallResult(
  params: OptionStrategyContract
): OptionStrategyResult {
  const breakEven = params.strikePrice + params.premium;
  const maxProfit = params.premium * params.quantity * 100;
  const maxLoss = Number.POSITIVE_INFINITY;
  const requiredMargin = params.strikePrice * params.quantity * 100 * 0.2;

  return {
    ticker: params.ticker,
    optionType: "call",
    direction: "short",
    premium: params.premium,
    quantity: params.quantity,
    breakEven,
    maxProfit,
    maxLoss,
    requiredMargin,
    payoffProfile: [
      { price: params.strikePrice, profitLoss: maxProfit },
      { price: breakEven, profitLoss: 0 },
      { price: breakEven + 10, profitLoss: -Number.POSITIVE_INFINITY }
    ]
  };
}
