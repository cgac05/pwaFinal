export interface OHLCVData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// RSI — Wilder's smoothed moving average variant
export function calcRSI(candles: OHLCVData[], period = 14): { time: string; value: number }[] {
  if (candles.length <= period) return [];

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = candles[i].close - candles[i - 1].close;
    if (d > 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;

  const result: { time: string; value: number }[] = [];
  for (let i = period; i < candles.length; i++) {
    if (i > period) {
      const d = candles[i].close - candles[i - 1].close;
      avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    }
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    result.push({ time: candles[i].time, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + rs) });
  }
  return result;
}

function ema(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(prev);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export interface MACDPoint {
  time: string;
  macd: number;
  signal: number;
  histogram: number;
}

// MACD — standard (12, 26, 9)
export function calcMACD(
  candles: OHLCVData[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MACDPoint[] {
  const closes = candles.map(c => c.close);
  const fastEMA = ema(closes, fastPeriod);  // fastEMA[i] ↔ closes[fastPeriod-1+i]
  const slowEMA = ema(closes, slowPeriod);  // slowEMA[i] ↔ closes[slowPeriod-1+i]
  if (!fastEMA.length || !slowEMA.length) return [];

  const macdValues: number[] = [];
  const macdTimes: string[] = [];
  for (let i = 0; i < slowEMA.length; i++) {
    const ci = slowPeriod - 1 + i;
    const fi = ci - (fastPeriod - 1);
    macdValues.push(fastEMA[fi] - slowEMA[i]);
    macdTimes.push(candles[ci].time);
  }

  const signalValues = ema(macdValues, signalPeriod);
  if (!signalValues.length) return [];

  return signalValues.map((sig, j) => {
    const mi = signalPeriod - 1 + j;
    return {
      time: macdTimes[mi],
      macd: macdValues[mi],
      signal: sig,
      histogram: macdValues[mi] - sig,
    };
  });
}

export interface BBPoint {
  time: string;
  upper: number;
  middle: number;
  lower: number;
}

// Bollinger Bands — SMA(period) ± mult * stdDev
export function calcBollingerBands(candles: OHLCVData[], period = 20, mult = 2): BBPoint[] {
  const result: BBPoint[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1).map(c => c.close);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const stdDev = Math.sqrt(slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period);
    result.push({
      time: candles[i].time,
      upper: mean + mult * stdDev,
      middle: mean,
      lower: mean - mult * stdDev,
    });
  }
  return result;
}

// FIC: EMA overlay line — exponential moving average of close, aligned to candle times. (EN)
// FIC: Línea EMA superpuesta — media móvil exponencial del cierre, alineada a los tiempos de vela. (ES)
export function calcEMA(candles: OHLCVData[], period = 20): { time: string; value: number }[] {
  const closes = candles.map(c => c.close);
  const values = ema(closes, period); // values[i] ↔ closes[period-1+i]
  return values.map((value, i) => ({ time: candles[period - 1 + i].time, value }));
}

export interface DMIPoint {
  time: string;
  adx: number;
  plusDI: number;
  minusDI: number;
}

// FIC: DMI/ADX — Wilder's +DI, -DI and ADX (trend strength + direction). (EN)
// FIC: DMI/ADX — +DI, -DI y ADX de Wilder (fuerza y dirección de tendencia). (ES)
export function calcDMI(candles: OHLCVData[], period = 14): DMIPoint[] {
  if (candles.length <= period * 2) return [];

  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    const highLow = candles[i].high - candles[i].low;
    const highClose = Math.abs(candles[i].high - candles[i - 1].close);
    const lowClose = Math.abs(candles[i].low - candles[i - 1].close);
    tr.push(Math.max(highLow, highClose, lowClose));
  }

  let smPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let smMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let smTR = tr.slice(0, period).reduce((a, b) => a + b, 0);

  const di: { time: string; plusDI: number; minusDI: number; dx: number }[] = [];
  for (let i = period; i < tr.length; i++) {
    smPlusDM = smPlusDM - smPlusDM / period + plusDM[i];
    smMinusDM = smMinusDM - smMinusDM / period + minusDM[i];
    smTR = smTR - smTR / period + tr[i];
    const plusDI = smTR === 0 ? 0 : (smPlusDM / smTR) * 100;
    const minusDI = smTR === 0 ? 0 : (smMinusDM / smTR) * 100;
    const diSum = plusDI + minusDI;
    const dx = diSum === 0 ? 0 : (Math.abs(plusDI - minusDI) / diSum) * 100;
    di.push({ time: candles[i + 1].time, plusDI, minusDI, dx });
  }

  if (di.length < period) return [];

  const result: DMIPoint[] = [];
  let adx = di.slice(0, period).reduce((a, b) => a + b.dx, 0) / period;
  result.push({ time: di[period - 1].time, adx, plusDI: di[period - 1].plusDI, minusDI: di[period - 1].minusDI });
  for (let i = period; i < di.length; i++) {
    adx = (adx * (period - 1) + di[i].dx) / period;
    result.push({ time: di[i].time, adx, plusDI: di[i].plusDI, minusDI: di[i].minusDI });
  }
  return result;
}

export function calcADX(candles: OHLCVData[], period = 14): { time: string; value: number }[] {
  return calcDMI(candles, period).map(d => ({ time: d.time, value: d.adx }));
}
