import type { OptionStrategyContract, OptionStrategyResult, OptionStrategyInput, OptionStrategyOutput } from "./optionsStrategyContract";
import { calculateLongCallResult } from "./options/longCall";
import { calculateLongPutResult } from "./options/longPut";
import { calculateShortCallResult } from "./options/shortCall";
import { calculateShortPutResult } from "./options/shortPut";
import { evaluateLongCall } from "./options/longCall";
import { evaluateLongPut } from "./options/longPut";
import { evaluateShortCall } from "./options/shortCall";
import { evaluateShortPut } from "./options/shortPut";
import { normalizeOptionStrategyInput } from "./options/optionMath";

export function buildOptionStrategyResult(
  params: OptionStrategyContract
): OptionStrategyResult {
  const normalizedParams = normalizeOptionStrategyInput(params);
  const direction = normalizedParams.direction;
  const optionType = normalizedParams.optionType;

  if (direction === "LONG") {
    return optionType === "CALL"
      ? evaluateLongCall(normalizedParams)
      : evaluateLongPut(normalizedParams);
  }

  return optionType === "CALL"
    ? evaluateShortCall(normalizedParams)
    : evaluateShortPut(normalizedParams);
}

/**
 * Build full candidates with complete scenario information for ranking
 */
export function buildOptionStrategyCandidates(
  baseParams: OptionStrategyContract
): OptionStrategyOutput[] {
  const normalizedParams: OptionStrategyInput = normalizeOptionStrategyInput(baseParams);

  const longCall = evaluateLongCall({ ...normalizedParams, optionType: "CALL", direction: "LONG" });
  const longPut = evaluateLongPut({ ...normalizedParams, optionType: "PUT", direction: "LONG" });
  const shortCall = evaluateShortCall({ ...normalizedParams, optionType: "CALL", direction: "SHORT" });
  const shortPut = evaluateShortPut({ ...normalizedParams, optionType: "PUT", direction: "SHORT" });

  return [
    { ...longCall, ticker: baseParams.ticker, direction: "LONG", optionType: "CALL" },
    { ...longPut, ticker: baseParams.ticker, direction: "LONG", optionType: "PUT" },
    { ...shortCall, ticker: baseParams.ticker, direction: "SHORT", optionType: "CALL" },
    { ...shortPut, ticker: baseParams.ticker, direction: "SHORT", optionType: "PUT" }
  ];
}
