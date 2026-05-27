// FIC: Unit tests T144 — IndicatorCache in-memory hit/miss, TTL, invalidacion por last_bar_ts.

import { describe, expect, it, beforeEach } from "vitest";
import {
  InMemoryIndicatorCache,
  buildCacheKey,
  TIMEFRAME_TTL_SECONDS,
  memoizeIndicator,
  setIndicatorCache
} from "../../../src/modules/indicators/cache";

describe("InMemoryIndicatorCache", () => {
  let clock = 1_000_000;
  const cache = new InMemoryIndicatorCache(() => clock);

  beforeEach(() => {
    cache.clear();
    clock = 1_000_000;
  });

  it("returns undefined on miss", () => {
    expect(cache.get("missing")).toBeUndefined();
  });

  it("returns value on hit before TTL expires", () => {
    cache.set("k", 42, 60);
    clock += 30_000;
    expect(cache.get<number>("k")).toBe(42);
  });

  it("expires value after TTL elapses", () => {
    cache.set("k", 42, 60);
    clock += 61_000;
    expect(cache.get("k")).toBeUndefined();
  });

  it("evicts on get when expired", () => {
    cache.set("k", 42, 1);
    clock += 2000;
    cache.get("k");
    expect(cache.size()).toBe(0);
  });
});

describe("buildCacheKey", () => {
  it("changes when last_bar_ts changes", () => {
    const a = buildCacheKey({
      indicator: "rsi",
      symbol: "AAPL",
      timeframe: "1h",
      params: { period: 14 },
      lastBarTs: 1000
    });
    const b = buildCacheKey({
      indicator: "rsi",
      symbol: "AAPL",
      timeframe: "1h",
      params: { period: 14 },
      lastBarTs: 2000
    });
    expect(a).not.toBe(b);
  });

  it("is stable across param key order", () => {
    const a = buildCacheKey({
      indicator: "macd",
      symbol: "AAPL",
      timeframe: "1h",
      params: { fast: 12, slow: 26 },
      lastBarTs: 1000
    });
    const b = buildCacheKey({
      indicator: "macd",
      symbol: "AAPL",
      timeframe: "1h",
      params: { slow: 26, fast: 12 },
      lastBarTs: 1000
    });
    expect(a).toBe(b);
  });
});

describe("memoizeIndicator", () => {
  it("hits on second call with same last_bar_ts", () => {
    let clock = 0;
    const cache = new InMemoryIndicatorCache(() => clock);
    setIndicatorCache(cache);
    const candles = [{ time: 100, open: 1, high: 2, low: 0.5, close: 1.5, volume: 1 }];
    let calls = 0;
    const compute = () => {
      calls += 1;
      return { value: calls };
    };
    memoizeIndicator({
      indicator: "rsi",
      symbol: "AAPL",
      timeframe: "1h",
      params: { period: 14 },
      candles,
      compute
    });
    memoizeIndicator({
      indicator: "rsi",
      symbol: "AAPL",
      timeframe: "1h",
      params: { period: 14 },
      candles,
      compute
    });
    expect(calls).toBe(1);
  });
});

describe("TIMEFRAME_TTL_SECONDS", () => {
  it("matches one-candle durations", () => {
    expect(TIMEFRAME_TTL_SECONDS["1m"]).toBe(60);
    expect(TIMEFRAME_TTL_SECONDS["1h"]).toBe(3600);
    expect(TIMEFRAME_TTL_SECONDS["1d"]).toBe(86400);
  });
});
