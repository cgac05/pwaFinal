// FIC: Unit tests for Bollinger Bands computation (Edgar, TEAM-02).
// FIC: Tests unitarios del calculo de Bandas de Bollinger (Edgar, TEAM-02).

import { describe, expect, it } from "vitest";
import {
  bollingerZone,
  computeBollinger,
  computeBollingerSeries
} from "../../../src/modules/indicators/bollinger";
import type { OhlcBar } from "../../../src/modules/indicators/types";

function bar(time: number, close: number): OhlcBar {
  return { time, open: close, high: close, low: close, close, volume: 0 };
}

describe("computeBollingerSeries", () => {
  it("throws on invalid period or stdDev", () => {
    expect(() => computeBollingerSeries([1, 2, 3], 0, 2)).toThrow();
    expect(() => computeBollingerSeries([1, 2, 3], 3, 0)).toThrow();
  });

  it("returns nulls before the period is reached", () => {
    const out = computeBollingerSeries([1, 2, 3], 20, 2);
    expect(out.every((p) => p.middle === null)).toBe(true);
  });

  it("collapses bands onto the mean when input is constant", () => {
    const out = computeBollingerSeries(Array(30).fill(50), 20, 2);
    const last = out[29];
    expect(last.middle).toBeCloseTo(50, 10);
    expect(last.upper).toBeCloseTo(50, 10);
    expect(last.lower).toBeCloseTo(50, 10);
    expect(last.bandwidth).toBeCloseTo(0, 10);
  });

  it("places the mean as the middle band and symmetric upper/lower", () => {
    const closes = Array.from({ length: 25 }, (_, i) => i + 1);
    const out = computeBollingerSeries(closes, 20, 2);
    const p = out[24];
    expect(p.middle).not.toBeNull();
    const mid = p.middle as number;
    expect((p.upper as number) - mid).toBeCloseTo(mid - (p.lower as number), 9);
  });
});

describe("bollingerZone", () => {
  const point = { upper: 110, middle: 100, lower: 90, bandwidth: 0.2 };
  it.each([
    [120, "above_upper"],
    [80, "below_lower"],
    [100, "within"],
    [null, "unknown"]
  ] as const)("classifies close=%s as %s", (close, expected) => {
    expect(bollingerZone(close, point)).toBe(expected);
  });
});

describe("computeBollinger", () => {
  it("returns deterministic structure with percent_b and zone", () => {
    const candles = Array.from({ length: 30 }, (_, i) => bar(1_700_000_000 + i * 60, 100 + Math.sin(i / 3) * 5));
    const res = computeBollinger(candles, { period: 20, stdDev: 2 }, { symbol: "AAPL", timeframe: "1m" });
    expect(res.indicator).toBe("bollinger");
    expect(res.params).toEqual({ period: 20, stdDev: 2 });
    expect(res.bars_used).toBe(30);
    expect(res.series).toHaveLength(30);
    expect(res.current_value.middle).not.toBeNull();
    expect(["above_upper", "below_lower", "within"]).toContain(res.zone);
    expect(res.source_input_hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it("is reproducible across identical inputs", () => {
    const candles = Array.from({ length: 30 }, (_, i) => bar(i, 100 + Math.cos(i / 4) * 3));
    const a = computeBollinger(candles, { period: 20, stdDev: 2 }, { symbol: "X", timeframe: "1h" });
    const b = computeBollinger(candles, { period: 20, stdDev: 2 }, { symbol: "X", timeframe: "1h" });
    expect(a.current_value.upper).toBe(b.current_value.upper);
    expect(a.source_input_hash).toBe(b.source_input_hash);
  });
});
