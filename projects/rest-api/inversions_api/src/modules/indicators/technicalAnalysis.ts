// FIC: Technical analysis module — support/resistance levels, trend classification, trend lines. (EN)
// FIC: Módulo de análisis técnico — niveles de soporte/resistencia, clasificación de tendencia, líneas de tendencia. (ES)

import { ALGORITHM_VERSION, OhlcBar, Timeframe } from "./types";
import { inputHash } from "./ohlcSource";
import { computeEmaSeries } from "./macd";
import { computeAdxSeries, adxStrength } from "./adx";

// ─── Internal constants ───────────────────────────────────────────────────────
const PIVOT_WINDOW = 20;
const CLUSTER_TOLERANCE = 0.005;
const MIN_BARS = 78;

export interface Point {
  time: number;
  price: number;
}

export interface TrendLine {
  direction: "ALCISTA" | "BAJISTA";
  p1: Point;
  p2: Point;
  pEnd: Point;
  slope: number;
  strength?: number;
}

export interface PriceLevel {
  price: number;
  touches: number;
  strength: "DEBIL" | "MODERADO" | "FUERTE";
  firstSeen: number;
  lastSeen: number;
}

export interface TechnicalAnalysisResult {
  trend: string;
  trendStrength: string;
  adxValue: number | null;
  ema20: number | null;
  ema50: number | null;
  lastClose: number | null;
  supports: PriceLevel[];
  resistances: PriceLevel[];
  trendLines: TrendLine[];
  algorithm_version: string;
  computed_at: string;
  source_input_hash: string;
  bars_used: number;
}

export interface AnalysisOptions {
  pivotWindow?: number;
  clusterTolerance?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function touchesToStrength(touches: number): "DEBIL" | "MODERADO" | "FUERTE" {
  if (touches >= 4) return "FUERTE";
  if (touches >= 2) return "MODERADO";
  return "DEBIL";
}

// FIC: Returns indices of bars whose low is strictly the lowest in [i-window, i+window]. (EN)
function findLocalMinima(candles: OhlcBar[], window: number): number[] {
  const indices: number[] = [];
  for (let i = window; i < candles.length - window; i++) {
    const low = candles[i].low;
    let isMin = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j !== i && candles[j].low <= low) {
        isMin = false;
        break;
      }
    }
    if (isMin) indices.push(i);
  }
  return indices;
}

// FIC: Returns indices of bars whose high is strictly the highest in [i-window, i+window]. (EN)
function findLocalMaxima(candles: OhlcBar[], window: number): number[] {
  const indices: number[] = [];
  for (let i = window; i < candles.length - window; i++) {
    const high = candles[i].high;
    let isMax = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j !== i && candles[j].high >= high) {
        isMax = false;
        break;
      }
    }
    if (isMax) indices.push(i);
  }
  return indices;
}

// FIC: Merge price points within CLUSTER_TOLERANCE of each other into PriceLevels. (EN)
function clusterLevels(points: { price: number; time: number }[], tolerance: number): PriceLevel[] {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.price - b.price);
  const clusters: PriceLevel[] = [];
  
  let cPrice = sorted[0].price;
  let cCount = 1;
  let cFirst = sorted[0].time;
  let cLast = sorted[0].time;

  for (let i = 1; i < sorted.length; i++) {
    const ref = Math.max(cPrice, sorted[i].price);
    if ((sorted[i].price - cPrice) / ref <= tolerance) {
      cPrice = (cPrice * cCount + sorted[i].price) / (cCount + 1);
      cCount += 1;
      cFirst = Math.min(cFirst, sorted[i].time);
      cLast = Math.max(cLast, sorted[i].time);
    } else {
      clusters.push({
        price: cPrice,
        touches: cCount,
        strength: touchesToStrength(cCount),
        firstSeen: cFirst,
        lastSeen: cLast,
      });
      cPrice = sorted[i].price;
      cCount = 1;
      cFirst = sorted[i].time;
      cLast = sorted[i].time;
    }
  }
  
  clusters.push({
    price: cPrice,
    touches: cCount,
    strength: touchesToStrength(cCount),
    firstSeen: cFirst,
    lastSeen: cLast,
  });
  return clusters;
}

// FIC: Classify trend using EMA20 vs EMA50 cross and price position. (EN)
function classifyTrend(ema20: number | null, ema50: number | null, lastClose: number | null): string {
  if (ema20 === null || ema50 === null || lastClose === null) return "LATERAL";
  if (ema20 > ema50 && lastClose > ema20) return "ALCISTA";
  if (ema20 < ema50 && lastClose < ema20) return "BAJISTA";
  return "LATERAL";
}

// FIC: Scan forward from fromIdx until price violates the line by tolerancePct. (EN)
// FIC: Avanza desde fromIdx hasta que el precio viola la linea por mas de tolerancePct. (ES)
function scanToBreakout(
  candles: OhlcBar[],
  fromIdx: number,
  slope: number,
  intercept: number,
  type: "bullish" | "bearish",
  limitIdx: number,
  tolerancePct: number
): number {
  let lastIntact = fromIdx;
  for (let i = fromIdx + 1; i <= limitIdx; i++) {
    const linePrice = slope * i + intercept;
    if (type === "bullish" && candles[i].close < linePrice * (1 - tolerancePct)) break;
    if (type === "bearish" && candles[i].close > linePrice * (1 + tolerancePct)) break;
    lastIntact = i;
  }
  return lastIntact;
}

// FIC: Minimum normalised slope grows with window to avoid near-horizontal lines. (EN)
function minSlopeNormForWindow(n: number): number {
  return 0.00008 + (n / 50) * 0.00042;
}

// FIC: Deduplicate and cap trendlines per direction, prioritising longest-surviving lines. (EN)
function pruneTrendLines(lines: TrendLine[], maxPerDir: number, slopeSimilarity: number): TrendLine[] {
  const byDir = (dir: "ALCISTA" | "BAJISTA") =>
    lines
      .filter(l => l.direction === dir)
      .sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0));

  const dedupe = (group: TrendLine[]): TrendLine[] => {
    const kept: TrendLine[] = [];
    for (const line of group) {
      const dup = kept.some(k => Math.abs(k.slope - line.slope) < slopeSimilarity);
      if (!dup) kept.push(line);
      if (kept.length >= maxPerDir) break;
    }
    return kept;
  };

  return [...dedupe(byDir("ALCISTA")), ...dedupe(byDir("BAJISTA"))];
}

// FIC: Build multiple structurally relevant trendlines per direction. (EN)
// FIC: Genera multiples lineas de tendencia relevantes por direccion. (ES)
// Bullish: consecutive ascending pivot lows that survive scanToBreakout.
// Bearish: consecutive descending pivot highs that survive scanToBreakout.
// Pruned to max 5 per direction, deduplicating near-identical slopes.
function buildTrendLines(
  candles: OhlcBar[],
  minimaIndices: number[],
  maximaIndices: number[],
  window: number
): TrendLine[] {
  if (candles.length < 2) return [];

  const avgPrice = candles.reduce((s, c) => s + c.close, 0) / candles.length;
  const minSlopeNorm = minSlopeNormForWindow(window);
  const limitIdx = candles.length - 1;
  const tolerancePct = 0.0015;
  const lines: TrendLine[] = [];

  // Bullish: consecutive ascending pivot lows
  for (let k = 0; k < minimaIndices.length - 1; k++) {
    const iA = minimaIndices[k];
    const iB = minimaIndices[k + 1];
    const pA = candles[iA];
    const pB = candles[iB];

    if (pB.low <= pA.low) continue;

    const slope = (pB.low - pA.low) / (iB - iA);
    const slopeNorm = slope / avgPrice;
    if (slopeNorm < minSlopeNorm) continue;

    const intercept = pA.low - slope * iA;
    const endIdx = scanToBreakout(candles, iB, slope, intercept, "bullish", limitIdx, tolerancePct);
    const duration = endIdx - iA;
    if (duration <= window) continue;

    lines.push({
      direction: "ALCISTA",
      p1: { time: pA.time, price: pA.low },
      p2: { time: pB.time, price: pB.low },
      pEnd: { time: candles[endIdx].time, price: slope * endIdx + intercept },
      slope: slopeNorm,
      strength: duration,
    });
  }

  // Bearish: consecutive descending pivot highs
  for (let k = 0; k < maximaIndices.length - 1; k++) {
    const iA = maximaIndices[k];
    const iB = maximaIndices[k + 1];
    const pA = candles[iA];
    const pB = candles[iB];

    if (pB.high >= pA.high) continue;

    const slope = (pB.high - pA.high) / (iB - iA);
    const slopeNorm = slope / avgPrice;
    if (Math.abs(slopeNorm) < minSlopeNorm) continue;

    const intercept = pA.high - slope * iA;
    const endIdx = scanToBreakout(candles, iB, slope, intercept, "bearish", limitIdx, tolerancePct);
    const duration = endIdx - iA;
    if (duration <= window) continue;

    lines.push({
      direction: "BAJISTA",
      p1: { time: pA.time, price: pA.high },
      p2: { time: pB.time, price: pB.high },
      pEnd: { time: candles[endIdx].time, price: slope * endIdx + intercept },
      slope: slopeNorm,
      strength: duration,
    });
  }

  return pruneTrendLines(lines, 5, minSlopeNorm * 0.5);
}

// Main export
export function analyzeTechnicalLevels(
  candles: OhlcBar[],
  meta: { symbol: string; timeframe: Timeframe },
  options: AnalysisOptions = {}
): TechnicalAnalysisResult {
  const computed_at = new Date().toISOString();
  const source_input_hash = inputHash(candles);
  const bars_used = candles.length;
  const window = options.pivotWindow ?? PIVOT_WINDOW;
  const tolerance = options.clusterTolerance ?? CLUSTER_TOLERANCE;

  if (candles.length < MIN_BARS) {
    return {
      trend: "LATERAL",
      trendStrength: "sin_tendencia",
      adxValue: null,
      ema20: null,
      ema50: null,
      lastClose: null,
      supports: [],
      resistances: [],
      trendLines: [],
      algorithm_version: ALGORITHM_VERSION,
      computed_at,
      source_input_hash,
      bars_used,
    };
  }

  const closes = candles.map((c) => c.close);
  const ema20Series = computeEmaSeries(closes, 20);
  const ema50Series = computeEmaSeries(closes, 50);
  const lastIdx = candles.length - 1;
  const ema20 = ema20Series[lastIdx] ?? null;
  const ema50 = ema50Series[lastIdx] ?? null;
  const lastClose = closes[lastIdx] ?? null;

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const { adx: adxSeries } = computeAdxSeries(highs, lows, closes, 14);
  const adxValue = adxSeries[lastIdx] ?? null;

  const trend = classifyTrend(ema20, ema50, lastClose);
  const trendStrength = adxStrength(adxValue);

  const minimaIndices = findLocalMinima(candles, window);
  const maximaIndices = findLocalMaxima(candles, window);
  const supportPoints = minimaIndices.map((i) => ({ price: candles[i].low, time: candles[i].time }));
  const resistancePoints = maximaIndices.map((i) => ({ price: candles[i].high, time: candles[i].time }));

  const supports = clusterLevels(supportPoints, tolerance).sort((a, b) => b.price - a.price);
  const resistances = clusterLevels(resistancePoints, tolerance).sort((a, b) => a.price - b.price);

  const trendLines = buildTrendLines(candles, minimaIndices, maximaIndices, window);

  return {
    trend,
    trendStrength,
    adxValue,
    ema20,
    ema50,
    lastClose,
    supports,
    resistances,
    trendLines,
    algorithm_version: ALGORITHM_VERSION,
    computed_at,
    source_input_hash,
    bars_used,
  };
}
