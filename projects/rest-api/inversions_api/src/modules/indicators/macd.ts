// FIC: MACD computation (line, signal, histogram, last-bar cross detection) for TEAM-02.
// FIC: Calculo de MACD (linea, señal, histograma, deteccion de cruce en ultima vela) para TEAM-02.

import { ALGORITHM_VERSION, type IndicatorResult, type OhlcBar, type Timeframe } from "./types";
import { inputHash } from "./ohlcSource";

export interface MacdParams {
  fast: number;
  slow: number;
  signal: number;
}

export interface MacdPoint {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export type MacdCross = "bullish" | "bearish" | "none";

export interface MacdCurrent extends MacdPoint {
  cross: MacdCross;
}

export type MacdResult = IndicatorResult<MacdCurrent, MacdPoint>;

export function computeEmaSeries(values: number[], period: number): Array<number | null> {
  if (period <= 0 || !Number.isFinite(period)) {
    throw new Error("period must be a positive integer");
  }
  const n = values.length;
  const out: Array<number | null> = new Array(n).fill(null);
  if (n < period) return out;

  const k = 2 / (period + 1);
  let sma = 0;
  for (let i = 0; i < period; i++) sma += values[i];
  sma /= period;
  out[period - 1] = sma;

  for (let i = period; i < n; i++) {
    const prev = out[i - 1] as number;
    out[i] = (values[i] - prev) * k + prev;
  }
  return out;
}

export function computeMacd(
  candles: OhlcBar[],
  params: MacdParams,
  meta: { symbol: string; timeframe: Timeframe }
): MacdResult {
  const { fast, slow, signal } = params;
  if (fast >= slow) {
    throw new Error("fast period must be smaller than slow period");
  }

  const closes = candles.map((c) => c.close);
  const emaFast = computeEmaSeries(closes, fast);
  const emaSlow = computeEmaSeries(closes, slow);

  const macdLine: Array<number | null> = closes.map((_, i) => {
    const a = emaFast[i];
    const b = emaSlow[i];
    return a !== null && b !== null ? a - b : null;
  });

  const firstDefined = macdLine.findIndex((v) => v !== null);
  const macdCompact = firstDefined >= 0 ? (macdLine.slice(firstDefined) as Array<number>) : [];
  const signalCompact = computeEmaSeries(macdCompact.map((v) => v ?? 0), signal);

  const signalLine: Array<number | null> = new Array(closes.length).fill(null);
  if (firstDefined >= 0) {
    for (let i = 0; i < signalCompact.length; i++) {
      signalLine[firstDefined + i] = signalCompact[i];
    }
  }

  const series: Array<{ time: number } & MacdPoint> = candles.map((c, i) => {
    const macdVal = macdLine[i];
    const sigVal = signalLine[i];
    const hist = macdVal !== null && sigVal !== null ? macdVal - sigVal : null;
    return { time: c.time, macd: macdVal, signal: sigVal, histogram: hist };
  });

  const lastIdx = series.length - 1;
  const last = series[lastIdx];
  const prev = lastIdx > 0 ? series[lastIdx - 1] : null;
  const cross = detectCross(prev, last);

  return {
    symbol: meta.symbol,
    timeframe: meta.timeframe,
    indicator: "macd",
    params: { fast, slow, signal },
    algorithm_version: ALGORITHM_VERSION,
    computed_at: new Date().toISOString(),
    source_input_hash: inputHash(candles),
    bars_used: candles.length,
    current_value: { ...last, cross },
    series
  };
}

function detectCross(
  prev: ({ time: number } & MacdPoint) | null,
  curr: ({ time: number } & MacdPoint) | null
): MacdCross {
  if (!prev || !curr) return "none";
  if (prev.macd === null || prev.signal === null || curr.macd === null || curr.signal === null) {
    return "none";
  }
  const prevDiff = prev.macd - prev.signal;
  const currDiff = curr.macd - curr.signal;
  if (prevDiff <= 0 && currDiff > 0) return "bullish";
  if (prevDiff >= 0 && currDiff < 0) return "bearish";
  return "none";
}
