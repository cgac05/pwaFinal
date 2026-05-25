import type { OptionStrategyContract, OptionStrategyResult } from "../optionsStrategyContract";

export function calculateLongPutResult(
  params: OptionStrategyContract
): OptionStrategyResult {
  const breakEven = params.strikePrice - params.premium;
  const maxProfit = (params.strikePrice - params.premium) * params.quantity * 100;
  const maxLoss = params.premium * params.quantity * 100;
  const requiredMargin = params.premium * params.quantity * 100;

  return {
    ticker: params.ticker,
    optionType: "put",
    direction: "long",
    premium: params.premium,
    quantity: params.quantity,
    breakEven,
    maxProfit,
    maxLoss,
    requiredMargin,
    payoffProfile: [
      { price: 0, profitLoss: maxProfit },
      { price: breakEven, profitLoss: 0 },
      { price: params.strikePrice + 10, profitLoss: -maxLoss }
    ]
  };
}
