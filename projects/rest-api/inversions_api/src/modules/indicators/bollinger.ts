// FIC: Bollinger Bands computation (pure function) for TEAM-02 volatility slice (Edgar).
// FIC: Calculo de Bandas de Bollinger (funcion pura) para el slice de volatilidad de TEAM-02 (Edgar).

import { ALGORITHM_VERSION, type IndicatorResult, type OhlcBar, type Timeframe } from "./types";
import { inputHash } from "./ohlcSource";

export interface BollingerParams {
  period: number;
  stdDev: number;
}

export interface BollingerPoint {
  upper: number | null;
  middle: number | null;
  lower: number | null;
  bandwidth: number | null;
}

export interface BollingerCurrent extends BollingerPoint {
  percent_b: number | null;
}

export type BollingerZone = "above_upper" | "below_lower" | "within" | "unknown";

export type BollingerResult = IndicatorResult<BollingerCurrent, BollingerPoint>;

// FIC: Pure Bollinger series — SMA middle band with population stddev envelope.
// FIC: Serie pura de Bollinger — banda media SMA con envolvente de desviacion poblacional.
export function computeBollingerSeries(
  closes: number[],
  period: number,
  stdDev: number
): BollingerPoint[] {
  if (period <= 0 || !Number.isFinite(period)) {
    throw new Error("period must be a positive integer");
  }
  if (stdDev <= 0 || !Number.isFinite(stdDev)) {
    throw new Error("stdDev must be a positive number");
  }
  const n = closes.length;
  const out: BollingerPoint[] = closes.map(() => ({
    upper: null,
    middle: null,
    lower: null,
    bandwidth: null
  }));

  for (let i = period - 1; i < n; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    const mean = sum / period;
    let sq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = closes[j] - mean;
      sq += d * d;
    }
    const std = Math.sqrt(sq / period);
    const upper = mean + stdDev * std;
    const lower = mean - stdDev * std;
    const bandwidth = mean === 0 ? null : (upper - lower) / mean;
    out[i] = { upper, middle: mean, lower, bandwidth };
  }
  return out;
}

// FIC: Locate the close relative to the bands for a quick volatility reading.
// FIC: Ubica el cierre respecto a las bandas para una lectura rapida de volatilidad.
export function bollingerZone(lastClose: number | null, point: BollingerPoint): BollingerZone {
  if (lastClose === null || point.upper === null || point.lower === null) return "unknown";
  if (lastClose > point.upper) return "above_upper";
  if (lastClose < point.lower) return "below_lower";
  return "within";
}

function percentB(lastClose: number | null, point: BollingerPoint): number | null {
  if (lastClose === null || point.upper === null || point.lower === null) return null;
  const range = point.upper - point.lower;
  if (range === 0) return 0.5;
  return (lastClose - point.lower) / range;
}

export function computeBollinger(
  candles: OhlcBar[],
  params: BollingerParams,
  meta: { symbol: string; timeframe: Timeframe }
): BollingerResult {
  const closes = candles.map((c) => c.close);
  const points = computeBollingerSeries(closes, params.period, params.stdDev);
  const series = candles.map((c, i) => ({ time: c.time, ...points[i] }));
  const lastIdx = candles.length - 1;
  const lastPoint: BollingerPoint =
    lastIdx >= 0 ? points[lastIdx] : { upper: null, middle: null, lower: null, bandwidth: null };
  const lastClose = closes.length > 0 ? closes[closes.length - 1] : null;

  return {
    symbol: meta.symbol,
    timeframe: meta.timeframe,
    indicator: "bollinger",
    params: { period: params.period, stdDev: params.stdDev },
    algorithm_version: ALGORITHM_VERSION,
    computed_at: new Date().toISOString(),
    source_input_hash: inputHash(candles),
    bars_used: candles.length,
    current_value: { ...lastPoint, percent_b: percentB(lastClose, lastPoint) },
    series,
    zone: bollingerZone(lastClose, lastPoint)
  };
}
