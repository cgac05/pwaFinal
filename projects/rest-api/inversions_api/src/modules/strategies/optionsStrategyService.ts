import type { OptionStrategyContract, OptionStrategyResult, OptionStrategyInput } from "./optionsStrategyContract";
import { calculateLongCallResult } from "./options/longCall";
import { calculateLongPutResult } from "./options/longPut";
import { calculateShortCallResult } from "./options/shortCall";
import { calculateShortPutResult } from "./options/shortPut";
import { evaluateLongCall } from "./options/longCall";
import { evaluateLongPut } from "./options/longPut";
import { evaluateShortCall } from "./options/shortCall";
import { evaluateShortPut } from "./options/shortPut";

export function buildOptionStrategyResult(
  params: OptionStrategyContract
): OptionStrategyResult {
  if (params.direction === "long") {
    return (params.optionType === "call"
      ? calculateLongCallResult(params)
      : calculateLongPutResult(params)) as unknown as OptionStrategyResult;
  }

  return (params.optionType === "call"
    ? calculateShortCallResult(params)
    : calculateShortPutResult(params)) as unknown as OptionStrategyResult;
}

/**
 * Build full candidates with complete scenario information for ranking
 */
export function buildOptionStrategyCandidates(
  baseParams: OptionStrategyContract
): OptionStrategyResult[] {
  const rawParams = baseParams as OptionStrategyContract & Partial<OptionStrategyInput>;

  // Normalize parameters to OptionStrategyInput format for evaluation functions
  const normalizedParams: OptionStrategyInput = {
    ticker: baseParams.ticker,
    optionType: (baseParams.optionType?.toUpperCase() as any) || "CALL",
    direction: (baseParams.direction?.toUpperCase() as any) || "LONG",
    strikePrice: baseParams.strikePrice,
    currentPrice: baseParams.currentPrice ?? baseParams.strikePrice,
    expirationDate: baseParams.expirationDate,
    daysToExpiration: (baseParams as any).daysToExpiration || 30,
    premiumPerContract:
      typeof rawParams.premiumPerContract === "number"
        ? rawParams.premiumPerContract
        : baseParams.premium || 0,
    numberOfContracts:
      typeof rawParams.numberOfContracts === "number"
        ? rawParams.numberOfContracts
        : baseParams.quantity || 1,
    availableCapital: baseParams.capitalAvailable || 10000,
    riskTolerance: ((baseParams.riskTolerance?.toUpperCase() as any) || "MEDIUM") as any,
    assumptions: baseParams.assumptions || { impliedVolatility: 25 }
  };

  const longCall = evaluateLongCall({ ...normalizedParams, optionType: "CALL", direction: "LONG" });
  const longPut = evaluateLongPut({ ...normalizedParams, optionType: "PUT", direction: "LONG" });
  const shortCall = evaluateShortCall({ ...normalizedParams, optionType: "CALL", direction: "SHORT" });
  const shortPut = evaluateShortPut({ ...normalizedParams, optionType: "PUT", direction: "SHORT" });

  // Add ticker and direction to each result (evaluateLongCall returns OptionStrategyOutput)
  return [
    { ...longCall, ticker: baseParams.ticker, direction: "LONG" as any, optionType: "CALL" as any } as OptionStrategyResult,
    { ...longPut, ticker: baseParams.ticker, direction: "LONG" as any, optionType: "PUT" as any } as OptionStrategyResult,
    { ...shortCall, ticker: baseParams.ticker, direction: "SHORT" as any, optionType: "CALL" as any } as OptionStrategyResult,
    { ...shortPut, ticker: baseParams.ticker, direction: "SHORT" as any, optionType: "PUT" as any } as OptionStrategyResult
  ];
}
