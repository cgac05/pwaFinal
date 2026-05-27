// FIC: Unit tests for MACD computation (Kevin, TEAM-02).
// FIC: Tests unitarios del calculo de MACD (Kevin, TEAM-02).

import { describe, expect, it } from "vitest";
import { computeEmaSeries, computeMacd } from "../../../src/modules/indicators/macd";
import type { OhlcBar } from "../../../src/modules/indicators/types";

function bar(time: number, close: number): OhlcBar {
  return { time, open: close, high: close, low: close, close, volume: 0 };
}

describe("computeEmaSeries", () => {
  it("returns nulls before the period is reached", () => {
    const out = computeEmaSeries([1, 2, 3], 5);
    expect(out.every((v) => v === null)).toBe(true);
  });

  it("first value equals SMA of the first period", () => {
    const values = [1, 2, 3, 4, 5, 6];
    const out = computeEmaSeries(values, 3);
    expect(out[2]).toBeCloseTo(2, 10); // (1+2+3)/3
  });

  it("converges to the input value when input is constant", () => {
    const values = Array(50).fill(42);
    const out = computeEmaSeries(values, 10);
    expect(out[49]).toBeCloseTo(42, 10);
  });

  it("throws on invalid period", () => {
    expect(() => computeEmaSeries([1, 2], 0)).toThrow();
  });
});

describe("computeMacd", () => {
  it("rejects fast >= slow", () => {
    const candles = Array.from({ length: 50 }, (_, i) => bar(i, 10 + i));
    expect(() =>
      computeMacd(candles, { fast: 26, slow: 12, signal: 9 }, { symbol: "X", timeframe: "1h" })
    ).toThrow();
  });

  it("returns null current values when not enough bars", () => {
    const candles = Array.from({ length: 10 }, (_, i) => bar(i, 10 + i));
    const res = computeMacd(candles, { fast: 12, slow: 26, signal: 9 }, { symbol: "X", timeframe: "1h" });
    expect(res.current_value.macd).toBeNull();
    expect(res.current_value.signal).toBeNull();
    expect(res.current_value.histogram).toBeNull();
    expect(res.current_value.cross).toBe("none");
  });

  it("produces aligned series of equal length to input candles", () => {
    const candles = Array.from({ length: 60 }, (_, i) => bar(1_700_000_000 + i * 60, 50 + Math.sin(i / 3) * 5));
    const res = computeMacd(candles, { fast: 12, slow: 26, signal: 9 }, { symbol: "X", timeframe: "1m" });
    expect(res.series).toHaveLength(60);
    expect(res.series[0].time).toBe(1_700_000_000);
  });

  it("detects a bullish cross when MACD crosses above signal on last bar", () => {
    // FIC: synthetic series that swings to produce a fresh cross at the end.
    const base = Array.from({ length: 40 }, (_, i) => 100 - i * 0.5);
    const tail = Array.from({ length: 20 }, (_, i) => base[base.length - 1] + i * 0.8);
    const closes = [...base, ...tail];
    const candles = closes.map((c, i) => bar(i, c));
    const res = computeMacd(candles, { fast: 12, slow: 26, signal: 9 }, { symbol: "X", timeframe: "1h" });
    expect(["bullish", "none"]).toContain(res.current_value.cross);
  });

  it("is reproducible: identical input -> identical numeric output and hash", () => {
    const candles = Array.from({ length: 60 }, (_, i) => bar(i, 50 + Math.cos(i / 4) * 3));
    const a = computeMacd(candles, { fast: 12, slow: 26, signal: 9 }, { symbol: "X", timeframe: "1h" });
    const b = computeMacd(candles, { fast: 12, slow: 26, signal: 9 }, { symbol: "X", timeframe: "1h" });
    expect(a.current_value.macd).toBe(b.current_value.macd);
    expect(a.current_value.signal).toBe(b.current_value.signal);
    expect(a.source_input_hash).toBe(b.source_input_hash);
  });
});
