// FIC: Wilder's RSI computation (pure function) for TEAM-02 indicators core.
// FIC: Calculo de RSI de Wilder (funcion pura) para el core de indicadores de TEAM-02.

import { ALGORITHM_VERSION, type IndicatorResult, type OhlcBar, type Timeframe } from "./types";
import { inputHash } from "./ohlcSource";

export interface RsiPoint {
  value: number | null;
}

export interface RsiParams {
  period: number;
}

export type RsiResult = IndicatorResult<number | null, RsiPoint>;

export function computeRsiSeries(closes: number[], period: number): Array<number | null> {
  if (period <= 0 || !Number.isFinite(period)) {
    throw new Error("period must be a positive integer");
  }
  const n = closes.length;
  const out: Array<number | null> = new Array(n).fill(null);
  if (n <= period) {
    return out;
  }

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum -= diff;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = computeRsiValue(avgGain, avgLoss);

  for (let i = period + 1; i < n; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = computeRsiValue(avgGain, avgLoss);
  }

  return out;
}

function computeRsiValue(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function rsiZone(value: number | null): "oversold" | "neutral" | "overbought" | "unknown" {
  if (value === null || Number.isNaN(value)) return "unknown";
  if (value <= 30) return "oversold";
  if (value >= 70) return "overbought";
  return "neutral";
}

export function computeRsi(
  candles: OhlcBar[],
  params: RsiParams,
  meta: { symbol: string; timeframe: Timeframe }
): RsiResult {
  const closes = candles.map((c) => c.close);
  const values = computeRsiSeries(closes, params.period);
  const series = candles.map((c, i) => ({ time: c.time, value: values[i] }));
  const current = values[values.length - 1] ?? null;

  return {
    symbol: meta.symbol,
    timeframe: meta.timeframe,
    indicator: "rsi",
    params: { period: params.period },
    algorithm_version: ALGORITHM_VERSION,
    computed_at: new Date().toISOString(),
    source_input_hash: inputHash(candles),
    bars_used: candles.length,
    current_value: current,
    series,
    zone: rsiZone(current)
  };
}
