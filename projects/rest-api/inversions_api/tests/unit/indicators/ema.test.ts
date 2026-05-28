// FIC: Unit tests for EMA computation (Edgar, TEAM-02).
// FIC: Tests unitarios del calculo de EMA (Edgar, TEAM-02).

import { describe, expect, it } from "vitest";
import { computeEma, emaTrend } from "../../../src/modules/indicators/ema";
import type { OhlcBar } from "../../../src/modules/indicators/types";

function bar(time: number, close: number): OhlcBar {
  return { time, open: close, high: close, low: close, close, volume: 0 };
}

describe("emaTrend", () => {
  it.each([
    [110, 100, "alcista"],
    [90, 100, "bajista"],
    [100, 100, "neutral"],
    [null, 100, "unknown"],
    [100, null, "unknown"]
  ] as const)("classifies close=%s ema=%s as %s", (close, ema, expected) => {
    expect(emaTrend(close, ema)).toBe(expected);
  });
});

describe("computeEma", () => {
  it("returns nulls before the period is reached", () => {
    const candles = Array.from({ length: 5 }, (_, i) => bar(i, 10 + i));
    const res = computeEma(candles, { period: 20 }, { symbol: "X", timeframe: "1h" });
    expect(res.series).toHaveLength(5);
    expect(res.current_value).toBeNull();
    expect(res.zone).toBe("unknown");
  });

  it("first value equals SMA of the first period", () => {
    const candles = Array.from({ length: 10 }, (_, i) => bar(i, i + 1));
    const res = computeEma(candles, { period: 3 }, { symbol: "X", timeframe: "1h" });
    expect(res.series[2].value).toBeCloseTo(2, 10); // (1+2+3)/3
  });

  it("converges to the input value when input is constant", () => {
    const candles = Array.from({ length: 60 }, (_, i) => bar(i, 42));
    const res = computeEma(candles, { period: 20 }, { symbol: "X", timeframe: "1h" });
    expect(res.current_value).toBeCloseTo(42, 9);
    expect(res.zone).toBe("neutral");
  });

  it("flags an uptrend when last close is above the EMA", () => {
    const closes = [...Array.from({ length: 40 }, (_, i) => 100), 130];
    const candles = closes.map((c, i) => bar(i, c));
    const res = computeEma(candles, { period: 20 }, { symbol: "X", timeframe: "1h" });
    expect(res.zone).toBe("alcista");
  });

  it("returns deterministic meta and identical hash for identical input", () => {
    const candles = Array.from({ length: 40 }, (_, i) => bar(1_700_000_000 + i * 60, 50 + Math.sin(i / 4)));
    const a = computeEma(candles, { period: 20 }, { symbol: "AAPL", timeframe: "1m" });
    const b = computeEma(candles, { period: 20 }, { symbol: "AAPL", timeframe: "1m" });
    expect(a.indicator).toBe("ema");
    expect(a.params).toEqual({ period: 20 });
    expect(a.bars_used).toBe(40);
    expect(a.source_input_hash).toMatch(/^[a-f0-9]{16}$/);
    expect(a.current_value).toBe(b.current_value);
    expect(a.source_input_hash).toBe(b.source_input_hash);
  });
});
