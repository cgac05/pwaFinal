// FIC: Cache in-process Phase 6 (Q5, T142-T144) — clave por last_bar_ts, TTL = duracion de 1 vela.
// FIC: Phase 6 in-process cache (Q5) — key includes last_bar_ts, TTL = duration of 1 candle.

import { createHash } from "node:crypto";
import type { OhlcBar, Timeframe } from "./types";

export interface IndicatorCache {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlSeconds: number): void;
  size(): number;
  clear(): void;
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

export class InMemoryIndicatorCache implements IndicatorCache {
  private store = new Map<string, CacheEntry>();
  private now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.now = now;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    this.store.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
  }

  size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}

export const TIMEFRAME_TTL_SECONDS: Record<Timeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400
};

export function buildCacheKey(input: {
  indicator: string;
  symbol: string;
  timeframe: Timeframe;
  params: Record<string, number | string>;
  lastBarTs: number;
}): string {
  const parts = [
    input.indicator,
    input.symbol.toUpperCase(),
    input.timeframe,
    JSON.stringify(input.params, Object.keys(input.params).sort()),
    String(input.lastBarTs)
  ].join("|");
  return createHash("sha256").update(parts).digest("hex").slice(0, 32);
}

export function lastBarTs(candles: OhlcBar[]): number {
  return candles.length === 0 ? 0 : candles[candles.length - 1].time;
}

let defaultCache: IndicatorCache = new InMemoryIndicatorCache();

export function getIndicatorCache(): IndicatorCache {
  return defaultCache;
}

export function setIndicatorCache(cache: IndicatorCache): void {
  defaultCache = cache;
}

export function memoizeIndicator<T>(opts: {
  indicator: string;
  symbol: string;
  timeframe: Timeframe;
  params: Record<string, number | string>;
  candles: OhlcBar[];
  compute: () => T;
}): T {
  const key = buildCacheKey({
    indicator: opts.indicator,
    symbol: opts.symbol,
    timeframe: opts.timeframe,
    params: opts.params,
    lastBarTs: lastBarTs(opts.candles)
  });
  const cache = getIndicatorCache();
  const cached = cache.get<T>(key);
  if (cached !== undefined) return cached;
  const value = opts.compute();
  cache.set(key, value, TIMEFRAME_TTL_SECONDS[opts.timeframe]);
  return value;
}
