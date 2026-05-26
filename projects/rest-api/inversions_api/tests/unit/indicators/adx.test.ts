// FIC: Unit tests for ADX computation (Edgar, TEAM-02).
// FIC: Tests unitarios del calculo de ADX (Edgar, TEAM-02).

import { describe, expect, it } from "vitest";
import { adxStrength, computeAdx, computeAdxSeries } from "../../../src/modules/indicators/adx";
import type { OhlcBar } from "../../../src/modules/indicators/types";

function bar(time: number, close: number, spread = 1): OhlcBar {
  return {
    time,
    open: close,
    high: close + spread,
    low: close - spread,
    close,
    volume: 0
  };
}

describe("adxStrength", () => {
  // FIC: T139/T141 — limites exactos: <20 sin_tendencia, [20,25) debil, [25,50) fuerte, >=50 muy_fuerte.
  it.each([
    [null, "sin_tendencia"],
    [10, "sin_tendencia"],
    [19.99, "sin_tendencia"],
    [20, "debil"],
    [22, "debil"],
    [24.99, "debil"],
    [25, "fuerte"],
    [35, "fuerte"],
    [49.99, "fuerte"],
    [50, "muy_fuerte"],
    [60, "muy_fuerte"]
  ] as const)("classifies adx=%s as %s", (value, expected) => {
    expect(adxStrength(value)).toBe(expected);
  });
});

describe("computeAdxSeries", () => {
  it("throws on invalid period", () => {
    expect(() => computeAdxSeries([1], [1], [1], 0)).toThrow();
  });

  it("returns all nulls when there are fewer than 2*period bars", () => {
    const h = Array.from({ length: 20 }, (_, i) => i + 1);
    const { adx } = computeAdxSeries(h, h, h, 14);
    expect(adx.every((v) => v === null)).toBe(true);
  });

  it("yields a strong reading with +DI dominant on a clean uptrend", () => {
    const n = 60;
    const highs = Array.from({ length: n }, (_, i) => 100 + i * 2 + 1);
    const lows = Array.from({ length: n }, (_, i) => 100 + i * 2 - 1);
    const closes = Array.from({ length: n }, (_, i) => 100 + i * 2);
    const { adx, plusDi, minusDi } = computeAdxSeries(highs, lows, closes, 14);
    const lastAdx = adx[n - 1] as number;
    expect(lastAdx).toBeGreaterThan(50);
    expect(plusDi[n - 1] as number).toBeGreaterThan(minusDi[n - 1] as number);
  });
});

describe("computeAdx", () => {
  it("returns null current values when not enough bars", () => {
    const candles = Array.from({ length: 20 }, (_, i) => bar(i, 100 + i));
    const res = computeAdx(candles, { period: 14 }, { symbol: "X", timeframe: "1h" });
    expect(res.current_value.adx).toBeNull();
    expect(res.current_value.strength).toBe("sin_tendencia");
  });

  it("classifies a strong uptrend as fuerte/muy_fuerte with +DI > -DI", () => {
    const candles = Array.from({ length: 60 }, (_, i) => bar(i, 100 + i * 2));
    const res = computeAdx(candles, { period: 14 }, { symbol: "X", timeframe: "1h" });
    expect(["fuerte", "muy_fuerte"]).toContain(res.current_value.strength);
    expect(res.current_value.plus_di as number).toBeGreaterThan(res.current_value.minus_di as number);
    expect(res.series).toHaveLength(60);
  });

  it("is reproducible: identical input -> identical output and hash", () => {
    const candles = Array.from({ length: 60 }, (_, i) => bar(i, 100 + Math.sin(i / 3) * 10));
    const a = computeAdx(candles, { period: 14 }, { symbol: "X", timeframe: "1h" });
    const b = computeAdx(candles, { period: 14 }, { symbol: "X", timeframe: "1h" });
    expect(a.current_value.adx).toBe(b.current_value.adx);
    expect(a.source_input_hash).toBe(b.source_input_hash);
  });
});
