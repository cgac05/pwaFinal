import type { OptionStrategyContract } from "./optionsStrategyContract";

export interface AlertTrigger {
  ticker: string;
  type: "STOP_LOSS" | "TAKE_PROFIT";
  triggeredAt: Date;
  price: number;
  message: string;
}

export class AlertService {
  evaluateAlert(price: number, params: OptionStrategyContract): AlertTrigger | null {
    const stopLossLevel = params.strikePrice - params.premium * 2;
    const takeProfitLevel = params.strikePrice + params.premium * 2;

    if (price <= stopLossLevel) {
      return {
        ticker: params.ticker,
        type: "STOP_LOSS",
        triggeredAt: new Date(),
        price,
        message: "Stop-loss triggered for options position"
      };
    }

    if (price >= takeProfitLevel) {
      return {
        ticker: params.ticker,
        type: "TAKE_PROFIT",
        triggeredAt: new Date(),
        price,
        message: "Take-profit triggered for options position"
      };
    }

    return null;
  }
}
