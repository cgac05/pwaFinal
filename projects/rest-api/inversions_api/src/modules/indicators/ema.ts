// FIC: EMA computation (pure function) for TEAM-02 trend/volatility slice (Edgar).
// FIC: Calculo de EMA (funcion pura) para el slice de tendencia/volatilidad de TEAM-02 (Edgar).

import { ALGORITHM_VERSION, type IndicatorResult, type OhlcBar, type Timeframe } from "./types";
import { inputHash } from "./ohlcSource";
import { computeEmaSeries } from "./macd";

export interface EmaPoint {
  value: number | null;
}

export interface EmaParams {
  period: number;
}

export type EmaTrend = "alcista" | "bajista" | "neutral" | "unknown";

export type EmaResult = IndicatorResult<number | null, EmaPoint>;

// FIC: Classify trend by comparing the last close against the EMA value.
// FIC: Clasifica la tendencia comparando el ultimo cierre contra el valor de la EMA.
export function emaTrend(lastClose: number | null, ema: number | null): EmaTrend {
  if (lastClose === null || ema === null || Number.isNaN(ema)) return "unknown";
  const threshold = Math.abs(ema) * 0.0005;
  const diff = lastClose - ema;
  if (diff > threshold) return "alcista";
  if (diff < -threshold) return "bajista";
  return "neutral";
}

export function computeEma(
  candles: OhlcBar[],
  params: EmaParams,
  meta: { symbol: string; timeframe: Timeframe }
): EmaResult {
  const closes = candles.map((c) => c.close);
  const values = computeEmaSeries(closes, params.period);
  const series = candles.map((c, i) => ({ time: c.time, value: values[i] }));
  const current = values[values.length - 1] ?? null;
  const lastClose = closes.length > 0 ? closes[closes.length - 1] : null;

  return {
    symbol: meta.symbol,
    timeframe: meta.timeframe,
    indicator: "ema",
    params: { period: params.period },
    algorithm_version: ALGORITHM_VERSION,
    computed_at: new Date().toISOString(),
    source_input_hash: inputHash(candles),
    bars_used: candles.length,
    current_value: current,
    series,
    zone: emaTrend(lastClose, current)
  };
}
