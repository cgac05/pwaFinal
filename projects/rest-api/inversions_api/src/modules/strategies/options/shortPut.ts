import type { OptionStrategyContract, OptionStrategyResult } from "../optionsStrategyContract";

export function calculateShortPutResult(
  params: OptionStrategyContract
): OptionStrategyResult {
  const breakEven = params.strikePrice - params.premium;
  const maxProfit = params.premium * params.quantity * 100;
  const maxLoss = (params.strikePrice - params.premium) * params.quantity * 100;
  const requiredMargin = params.strikePrice * params.quantity * 100 * 0.2;

  return {
    ticker: params.ticker,
    optionType: "put",
    direction: "short",
    premium: params.premium,
    quantity: params.quantity,
    breakEven,
    maxProfit,
    maxLoss,
    requiredMargin,
    payoffProfile: [
      { price: 0, profitLoss: -maxLoss },
      { price: breakEven, profitLoss: 0 },
      { price: params.strikePrice, profitLoss: maxProfit }
    ]
  };
}
