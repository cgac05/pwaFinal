// FIC: OHLC source adapter for indicators module. Uses deterministic mock candles
// FIC: mirroring routes/market-data/ohlc.ts until TEAM-01 publishes the real source.
//
// FIC: Adaptador de fuente OHLC para el modulo de indicadores. Usa velas mock
// FIC: deterministas alineadas con routes/market-data/ohlc.ts hasta que TEAM-01
// FIC: publique la fuente real.

import type { OhlcBar, Timeframe } from "./types";

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

export function getCandles({ symbol, timeframe, count = 300, endTimeMs }: GetCandlesOptions): OhlcBar[] {
  const upper = symbol.toUpperCase();
  if (!upper) {
    return [];
  }
  const step = intervalMs(timeframe);
  const end = endTimeMs ?? Date.now();
  const symbolSeed = upper.charCodeAt(0) % 7;

  return Array.from({ length: count }).map((_, index) => {
    const t = end - (count - index) * step;
    const base = 100 + Math.sin(index / 12) * 8 + symbolSeed;
    const open = Number((base + Math.sin(index / 3)).toFixed(2));
    const close = Number((base + Math.cos(index / 4)).toFixed(2));
    const high = Number((Math.max(open, close) + 0.8).toFixed(2));
    const low = Number((Math.min(open, close) - 0.8).toFixed(2));
    return {
      time: Math.floor(t / 1000),
      open,
      high,
      low,
      close,
      volume: Math.round(1000 + Math.abs(Math.sin(index)) * 3000)
    };
  });
}

import { createHash } from "node:crypto";

export function inputHash(candles: OhlcBar[]): string {
  const slim = candles.map((c) => `${c.time}|${c.close}`).join(",");
  return createHash("sha256").update(slim).digest("hex").slice(0, 16);
}
