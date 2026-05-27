// FIC: ADX computation with Wilder smoothing (+DI / -DI / strength) for TEAM-02 (Edgar).
// FIC: Calculo de ADX con suavizado de Wilder (+DI / -DI / fuerza) para TEAM-02 (Edgar).

import { ALGORITHM_VERSION, type IndicatorResult, type OhlcBar, type Timeframe } from "./types";
import { inputHash } from "./ohlcSource";
import { ADX_THRESHOLDS } from "./thresholds";

export { ADX_THRESHOLDS };

export interface AdxParams {
  period: number;
}

export type AdxStrength = "sin_tendencia" | "debil" | "fuerte" | "muy_fuerte";

export interface AdxPoint {
  adx: number | null;
  plus_di: number | null;
  minus_di: number | null;
}

export interface AdxCurrent extends AdxPoint {
  strength: AdxStrength;
}

export type AdxResult = IndicatorResult<AdxCurrent, AdxPoint>;

// FIC: Strength thresholds — <20 none, 20-25 weak, 25-50 strong, >=50 very strong.
// FIC: Umbrales de fuerza — <20 nula, 20-25 debil, 25-50 fuerte, >=50 muy fuerte.
export function adxStrength(adx: number | null): AdxStrength {
  if (adx === null || Number.isNaN(adx)) return "sin_tendencia";
  if (adx < ADX_THRESHOLDS.sin_tendencia) return "sin_tendencia";
  if (adx < ADX_THRESHOLDS.debil) return "debil";
  if (adx < ADX_THRESHOLDS.fuerte) return "fuerte";
  return "muy_fuerte";
}

export interface AdxSeries {
  adx: Array<number | null>;
  plusDi: Array<number | null>;
  minusDi: Array<number | null>;
}

// FIC: Pure ADX/DMI series. Needs at least 2*period bars to yield a first ADX value.
// FIC: Serie pura ADX/DMI. Requiere al menos 2*period velas para un primer valor de ADX.
export function computeAdxSeries(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number
): AdxSeries {
  if (period <= 0 || !Number.isFinite(period)) {
    throw new Error("period must be a positive integer");
  }
  const n = highs.length;
  const adx: Array<number | null> = new Array(n).fill(null);
  const plusDi: Array<number | null> = new Array(n).fill(null);
  const minusDi: Array<number | null> = new Array(n).fill(null);
  if (n < 2 * period) {
    return { adx, plusDi, minusDi };
  }

  const tr: number[] = new Array(n).fill(0);
  const plusDm: number[] = new Array(n).fill(0);
  const minusDm: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDm[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDm[i] = downMove > upMove && downMove > 0 ? downMove : 0;
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    tr[i] = Math.max(hl, hc, lc);
  }

  let smTr = 0;
  let smPlus = 0;
  let smMinus = 0;
  for (let i = 1; i <= period; i++) {
    smTr += tr[i];
    smPlus += plusDm[i];
    smMinus += minusDm[i];
  }

  const dx: Array<number | null> = new Array(n).fill(null);
  const recordDi = (i: number): void => {
    const pdi = smTr === 0 ? 0 : (100 * smPlus) / smTr;
    const mdi = smTr === 0 ? 0 : (100 * smMinus) / smTr;
    plusDi[i] = pdi;
    minusDi[i] = mdi;
    const denom = pdi + mdi;
    dx[i] = denom === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / denom;
  };

  recordDi(period);
  for (let i = period + 1; i < n; i++) {
    smTr = smTr - smTr / period + tr[i];
    smPlus = smPlus - smPlus / period + plusDm[i];
    smMinus = smMinus - smMinus / period + minusDm[i];
    recordDi(i);
  }

  const firstAdxIdx = 2 * period - 1;
  let sum = 0;
  for (let i = period; i <= firstAdxIdx; i++) {
    sum += dx[i] as number;
  }
  let prevAdx = sum / period;
  adx[firstAdxIdx] = prevAdx;
  for (let i = firstAdxIdx + 1; i < n; i++) {
    prevAdx = (prevAdx * (period - 1) + (dx[i] as number)) / period;
    adx[i] = prevAdx;
  }

  return { adx, plusDi, minusDi };
}

export function computeAdx(
  candles: OhlcBar[],
  params: AdxParams,
  meta: { symbol: string; timeframe: Timeframe }
): AdxResult {
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const closes = candles.map((c) => c.close);
  const { adx, plusDi, minusDi } = computeAdxSeries(highs, lows, closes, params.period);

  const series = candles.map((c, i) => ({
    time: c.time,
    adx: adx[i],
    plus_di: plusDi[i],
    minus_di: minusDi[i]
  }));
  const lastIdx = candles.length - 1;
  const cAdx = lastIdx >= 0 ? adx[lastIdx] : null;
  const cPlus = lastIdx >= 0 ? plusDi[lastIdx] : null;
  const cMinus = lastIdx >= 0 ? minusDi[lastIdx] : null;

  return {
    symbol: meta.symbol,
    timeframe: meta.timeframe,
    indicator: "adx",
    params: { period: params.period },
    algorithm_version: ALGORITHM_VERSION,
    computed_at: new Date().toISOString(),
    source_input_hash: inputHash(candles),
    bars_used: candles.length,
    current_value: { adx: cAdx, plus_di: cPlus, minus_di: cMinus, strength: adxStrength(cAdx) },
    series,
    zone: adxStrength(cAdx)
  };
}
