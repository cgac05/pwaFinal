// FIC: Unit tests for the technical confluence engine (Mauricio, TEAM-02).
// FIC: Tests unitarios del motor de confluencia tecnica (Mauricio, TEAM-02).

import { describe, expect, it } from "vitest";
import {
  computeConfluence,
  DEFAULT_PROBES,
  verdictFromScore,
  type IndicatorProbe
} from "../../../src/modules/indicators/confluence";
import type { OhlcBar } from "../../../src/modules/indicators/types";

function bar(time: number, close: number, spread = 1.5): OhlcBar {
  return { time, open: close, high: close + spread, low: close - spread, close, volume: 1000 };
}

const META = { symbol: "TEST", timeframe: "1h" as const };
const STUB_CANDLES: OhlcBar[] = Array.from({ length: 40 }, (_, i) => bar(i, 100 + i));

function fixedProbe(name: string, weight: number, signal: number): IndicatorProbe {
  return {
    name,
    weight,
    evaluate: () => ({ signal, value: signal, detail: `${name} fijo en ${signal}` })
  };
}

function throwingProbe(name: string, weight: number): IndicatorProbe {
  return {
    name,
    weight,
    evaluate: () => {
      throw new Error(`${name} no disponible`);
    }
  };
}

describe("verdictFromScore", () => {
  // FIC: T140/T141 — verdict thresholds: alcista >0.2, bajista <-0.2, neutral inclusivo en limites.
  it.each([
    [0.8, "alcista"],
    [0.21, "alcista"],
    [0.2, "neutral"],
    [0.0, "neutral"],
    [-0.2, "neutral"],
    [-0.21, "bajista"],
    [-0.5, "bajista"]
  ] as const)("maps score=%s to %s", (score, expected) => {
    expect(verdictFromScore(score)).toBe(expected);
  });
});

describe("computeConfluence — known verdicts", () => {
  it("yields 'alcista' when every indicator is bullish", () => {
    const probes = ["rsi", "macd", "ema", "adx", "bollinger"].map((n) => fixedProbe(n, 0.2, 1));
    const v = computeConfluence(STUB_CANDLES, META, probes);
    expect(v.verdict).toBe("alcista");
    expect(v.score).toBeCloseTo(1, 6);
    expect(v.degraded).toBe(false);
    expect(v.missing).toEqual([]);
    expect(v.components).toHaveLength(5);
  });

  it("yields 'bajista' when every indicator is bearish", () => {
    const probes = ["rsi", "macd", "ema", "adx", "bollinger"].map((n) => fixedProbe(n, 0.2, -1));
    const v = computeConfluence(STUB_CANDLES, META, probes);
    expect(v.verdict).toBe("bajista");
    expect(v.score).toBeCloseTo(-1, 6);
  });

  it("yields 'neutral' when indicators cancel out", () => {
    const probes = ["rsi", "macd", "ema", "adx", "bollinger"].map((n) => fixedProbe(n, 0.2, 0));
    const v = computeConfluence(STUB_CANDLES, META, probes);
    expect(v.verdict).toBe("neutral");
    expect(v.score).toBeCloseTo(0, 6);
  });
});

describe("computeConfluence — degradation policy", () => {
  it("degrades but still scores when one indicator throws", () => {
    const probes: IndicatorProbe[] = [
      fixedProbe("rsi", 0.2, 1),
      fixedProbe("macd", 0.25, 1),
      fixedProbe("ema", 0.2, 1),
      fixedProbe("adx", 0.2, 1),
      throwingProbe("bollinger", 0.15)
    ];
    const v = computeConfluence(STUB_CANDLES, META, probes);
    expect(v.degraded).toBe(true);
    expect(v.missing).toEqual(["bollinger"]);
    expect(v.inputs_used).toHaveLength(4);
    expect(v.verdict).toBe("alcista");
    const bollinger = v.components.find((c) => c.indicator === "bollinger");
    expect(bollinger?.available).toBe(false);
    expect(bollinger?.contribution).toBe(0);
  });

  it("forces 'neutral' when fewer than 3 indicators are available", () => {
    const probes: IndicatorProbe[] = [
      fixedProbe("rsi", 0.2, 1),
      fixedProbe("macd", 0.25, 1),
      throwingProbe("ema", 0.2),
      throwingProbe("adx", 0.2),
      throwingProbe("bollinger", 0.15)
    ];
    const v = computeConfluence(STUB_CANDLES, META, probes);
    expect(v.verdict).toBe("neutral");
    expect(v.degraded).toBe(true);
    expect(v.missing).toHaveLength(3);
  });

  it("never throws even when every indicator fails", () => {
    const probes = ["rsi", "macd", "ema", "adx", "bollinger"].map((n) => throwingProbe(n, 0.2));
    const v = computeConfluence(STUB_CANDLES, META, probes);
    expect(v.verdict).toBe("neutral");
    expect(v.inputs_used).toEqual([]);
    expect(v.degraded).toBe(true);
  });
});

describe("computeConfluence — real indicators and traceability", () => {
  it("classifies a clean uptrend as 'alcista' with the 5 default probes", () => {
    const candles = Array.from({ length: 90 }, (_, i) => bar(i, 100 + i * 1.5));
    const v = computeConfluence(candles, META);
    expect(v.verdict).toBe("alcista");
    expect(v.degraded).toBe(false);
    expect(v.inputs_used).toHaveLength(5);
  });

  it("classifies a clean downtrend as 'bajista'", () => {
    const candles = Array.from({ length: 90 }, (_, i) => bar(i, 300 - i * 1.5));
    const v = computeConfluence(candles, META);
    expect(v.verdict).toBe("bajista");
  });

  it("is reproducible: identical candles -> identical score, verdict and hash", () => {
    const candles = Array.from({ length: 90 }, (_, i) => bar(i, 150 + Math.sin(i / 5) * 10));
    const a = computeConfluence(candles, META);
    const b = computeConfluence(candles, META);
    expect(a.score).toBe(b.score);
    expect(a.verdict).toBe(b.verdict);
    expect(a.source_input_hash).toBe(b.source_input_hash);
    expect(a.algorithm_version).toBe(b.algorithm_version);
    expect(a.bars_used).toBe(90);
  });

  it("exposes the 5 canonical probes by default", () => {
    expect(DEFAULT_PROBES.map((p) => p.name)).toEqual(["rsi", "macd", "ema", "adx", "bollinger"]);
  });
});
