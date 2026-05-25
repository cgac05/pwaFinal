import type { OptionStrategyContract, OptionStrategyResult } from "./optionsStrategyContract";
import { calculateLongCallResult } from "./options/longCall";
import { calculateLongPutResult } from "./options/longPut";
import { calculateShortCallResult } from "./options/shortCall";
import { calculateShortPutResult } from "./options/shortPut";

export function buildOptionStrategyResult(
  params: OptionStrategyContract
): OptionStrategyResult {
  if (params.direction === "long") {
    return params.optionType === "call"
      ? calculateLongCallResult(params)
      : calculateLongPutResult(params);
  }

  return params.optionType === "call"
    ? calculateShortCallResult(params)
    : calculateShortPutResult(params);
}

export function buildOptionStrategyCandidates(
  baseParams: OptionStrategyContract
): OptionStrategyResult[] {
  const longCall = calculateLongCallResult({ ...baseParams, optionType: "call", direction: "long" });
  const longPut = calculateLongPutResult({ ...baseParams, optionType: "put", direction: "long" });
  const shortCall = calculateShortCallResult({ ...baseParams, optionType: "call", direction: "short" });
  const shortPut = calculateShortPutResult({ ...baseParams, optionType: "put", direction: "short" });

  return [longCall, longPut, shortCall, shortPut];
}
