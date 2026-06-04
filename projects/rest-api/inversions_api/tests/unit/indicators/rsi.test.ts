// FIC: Unit tests for RSI computation (Kevin, TEAM-02).
// FIC: Tests unitarios del calculo de RSI (Kevin, TEAM-02).

import { describe, expect, it } from "vitest";
import { computeRsi, computeRsiSeries, rsiZone } from "../../../src/modules/indicators/rsi";
import type { OhlcBar } from "../../../src/modules/indicators/types";

function bar(time: number, close: number): OhlcBar {
  return { time, open: close, high: close, low: close, close, volume: 0 };
}

describe("computeRsiSeries", () => {
  it("returns nulls before the period is reached", () => {
    const closes = [1, 2, 3, 4, 5];
    const out = computeRsiSeries(closes, 14);
    expect(out).toHaveLength(5);
    expect(out.every((v) => v === null)).toBe(true);
  });

  it("returns 100 on a monotonically increasing series (no losses)", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 10 + i);
    const out = computeRsiSeries(closes, 14);
    expect(out[14]).toBe(100);
    expect(out[29]).toBe(100);
  });

  it("returns 0 on a monotonically decreasing series (no gains)", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 - i);
    const out = computeRsiSeries(closes, 14);
    expect(out[14]).toBe(0);
  });

  it("matches the classic Wilder reference values within tolerance", () => {
    // FIC: Reference series from Wilder's original example (alternating gains/losses).
    const closes = [
      44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28,
      46.28, 46.0, 46.03, 46.41, 46.22, 45.64
    ];
    const out = computeRsiSeries(closes, 14);
    const last = out[out.length - 1] as number;
    expect(last).toBeGreaterThan(40);
    expect(last).toBeLessThan(80);
  });

  it("throws on invalid period", () => {
    expect(() => computeRsiSeries([1, 2, 3], 0)).toThrow();
    expect(() => computeRsiSeries([1, 2, 3], -1)).toThrow();
  });
});

describe("rsiZone", () => {
  it.each([
    [25, "oversold"],
    [30, "oversold"],
    [50, "neutral"],
    [70, "overbought"],
    [85, "overbought"],
    [null, "unknown"]
  ] as const)("classifies %s as %s", (value, expected) => {
    expect(rsiZone(value)).toBe(expected);
  });
});

describe("computeRsi (full result)", () => {
  it("returns deterministic structure with meta and series aligned by time", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 10 + i);
    const candles = closes.map((c, i) => bar(1_700_000_000 + i * 60, c));
    const res = computeRsi(candles, { period: 14 }, { symbol: "TEST", timeframe: "1m" });

    expect(res.symbol).toBe("TEST");
    expect(res.timeframe).toBe("1m");
    expect(res.indicator).toBe("rsi");
    expect(res.params).toEqual({ period: 14 });
    expect(res.bars_used).toBe(30);
    expect(res.series).toHaveLength(30);
    expect(res.series[0].time).toBe(1_700_000_000);
    expect(res.current_value).toBe(100);
    expect(res.zone).toBe("overbought");
    expect(res.source_input_hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it("produces identical hash and values for identical inputs (reproducibility)", () => {
    const candles = Array.from({ length: 30 }, (_, i) => bar(i, 10 + Math.sin(i)));
    const a = computeRsi(candles, { period: 14 }, { symbol: "X", timeframe: "1h" });
    const b = computeRsi(candles, { period: 14 }, { symbol: "X", timeframe: "1h" });
    expect(a.current_value).toBe(b.current_value);
    expect(a.source_input_hash).toBe(b.source_input_hash);
  });
});
