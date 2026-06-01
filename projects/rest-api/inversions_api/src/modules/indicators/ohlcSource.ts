// FIC: OHLC source adapter — fetches real candles from Yahoo Finance v8, falls back to mock on failure. (EN)
// FIC: Adaptador de fuente OHLC — obtiene velas reales de Yahoo Finance v8, cae a mock si falla. (ES)

import type { OhlcBar, Timeframe } from "./types";
import { fetchYahooOhlc } from "../institutional/yahooChartParser";
import { createHash } from "node:crypto";

// FIC: 5-minute cache prevents Yahoo Finance rate-limiting when multiple strategies run concurrently. (EN)
// FIC: Caché de 5 minutos previene rate-limiting de Yahoo cuando varias estrategias corren en paralelo. (ES)
const candleCache = new Map<string, { data: OhlcBar[]; expiresAt: number }>();

const TIMEFRAME_MS: Record<Timeframe, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000
};

export function isSupportedTimeframe(value: string): value is Timeframe {
  return Object.prototype.hasOwnProperty.call(TIMEFRAME_MS, value);
}

export function intervalMs(timeframe: Timeframe): number {
  return TIMEFRAME_MS[timeframe];
}

export interface GetCandlesOptions {
  symbol: string;
  timeframe: Timeframe;
  count?: number;
  endTimeMs?: number;
}

// FIC: Emergency mock — used ONLY when all real sources fail. Logs a warning every call. (EN)
// FIC: Mock de emergencia — solo cuando todas las fuentes reales fallan. Emite advertencia en cada llamada. (ES)
function getMockCandles({ symbol, timeframe, count = 300, endTimeMs }: GetCandlesOptions): OhlcBar[] {
  const upper = symbol.toUpperCase();
  const step = intervalMs(timeframe);
  const end = endTimeMs ?? Date.now();
  const symbolSeed = upper.charCodeAt(0) % 7;

  return Array.from({ length: count }).map((_, index) => {
    const t = end - (count - index) * step;
    const base = 100 + Math.sin(index / 12) * 8 + symbolSeed;
    const open  = Number((base + Math.sin(index / 3)).toFixed(2));
    const close = Number((base + Math.cos(index / 4)).toFixed(2));
    const high  = Number((Math.max(open, close) + 0.8).toFixed(2));
    const low   = Number((Math.min(open, close) - 0.8).toFixed(2));
    return {
      time: Math.floor(t / 1000),
      open, high, low, close,
      volume: Math.round(1000 + Math.abs(Math.sin(index)) * 3000)
    };
  });
}

// FIC: Fetch real OHLC candles from Yahoo Finance — async, returns mock on failure with warning. (EN)
// FIC: Obtiene velas OHLC reales de Yahoo Finance — async, retorna mock con advertencia si falla. (ES)
export async function getCandles(opts: GetCandlesOptions): Promise<OhlcBar[]> {
  const { symbol, timeframe, count = 300, endTimeMs } = opts;

  const cacheKey = `${symbol}:${timeframe}:${count}:${endTimeMs ?? "latest"}`;
  const cached = candleCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    // FIC: US8 — si se pide una fecha historica, ampliar el rango de Yahoo y cortar velas hasta ese dia.
    const startDateIso = endTimeMs
      ? new Date(endTimeMs - count * intervalMs(timeframe) * 1.6).toISOString()
      : undefined;
    const yahooCandles = await fetchYahooOhlc(symbol, timeframe, globalThis.fetch, startDateIso);
    if (yahooCandles && yahooCandles.length > 0) {
      const cutoffSec = endTimeMs ? Math.floor(endTimeMs / 1000) : undefined;
      const upToDate = cutoffSec ? yahooCandles.filter((c) => c.time <= cutoffSec) : yahooCandles;
      if (upToDate.length >= Math.min(count, 20)) {
        const sliced = upToDate.slice(-count);
        const result = sliced.map((c) => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        }));
        candleCache.set(cacheKey, { data: result, expiresAt: Date.now() + 300_000 });
        return result;
      }
    }
  } catch {
    // fall through to mock
  }

  console.warn(`[ohlcSource] Real OHLC unavailable for ${symbol}/${timeframe} — indicators will use mock candles`);
  return getMockCandles(opts);
}

export function inputHash(candles: OhlcBar[]): string {
  const slim = candles.map((c) => `${c.time}|${c.close}`).join(",");
  return createHash("sha256").update(slim).digest("hex").slice(0, 16);
}
