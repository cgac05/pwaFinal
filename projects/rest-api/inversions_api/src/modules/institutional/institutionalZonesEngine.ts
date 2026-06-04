// FIC: Institutional S/R zones engine — pivot-based clustering with institutional signal weighting. (EN)
// FIC: Motor de zonas S/R institucionales — clustering de pivotes con ponderación de señales institucionales. (ES)

import type { InstitutionalAnalysisContract, InstitutionalLiquidity } from "./institutionalContract";
import type { InstitutionalResolveResult } from "./institutionalDataService";
import type { RealCandle } from "./yahooChartParser";

// ─── Output types ─────────────────────────────────────────────────────────────

export interface InstitutionalZone {
  price: number;
  type: "support" | "resistance";
  strength: number;      // 0–1
  confidence: number;    // 0–1
  volumeCluster: number;
  touches: number;
  liquidity: InstitutionalLiquidity;
}

export interface InstitutionalZonesResult {
  ticker: string;
  zones: InstitutionalZone[];
  supportZones: InstitutionalZone[];
  resistanceZones: InstitutionalZone[];
  candlesAnalyzed: number;
  sourceCount: number;
  atr: number;
  institutionalScore: number;
  analyzedAt: string;
}

// ─── Internals ────────────────────────────────────────────────────────────────

interface Candle { open: number; high: number; low: number; close: number; volume: number }
interface ZoneCandidate { price: number; type: "support" | "resistance"; volume: number }
interface ZoneCluster {
  price: number;
  type: "support" | "resistance";
  volumeCluster: number;
  touches: number;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class InstitutionalZonesEngine {
  private readonly maxZones: number;
  private readonly pivotWindow: number;
  private readonly clusterTolerancePct: number;
  private readonly liquidityVolumeMultiplier: number;

  constructor(
    maxZones = 8,
    pivotWindow = 2,
    clusterTolerancePct = 0.0125,
    liquidityVolumeMultiplier = 1.15
  ) {
    this.maxZones = maxZones;
    this.pivotWindow = pivotWindow;
    this.clusterTolerancePct = clusterTolerancePct;
    this.liquidityVolumeMultiplier = liquidityVolumeMultiplier;
  }

  // FIC: Main analysis entry point — accepts preResolvedResult to avoid duplicate data fetching. (EN)
  // FIC: Punto de entrada principal — acepta preResolvedResult para evitar fetch duplicado de datos. (ES)
  async analyze(
    request: InstitutionalAnalysisContract,
    preResolvedResult?: InstitutionalResolveResult,
    directCandles?: Array<{ open: number; high: number; low: number; close: number; volume: number }>
  ): Promise<InstitutionalZonesResult> {
    const candles = this.extractRealCandles(preResolvedResult) ?? directCandles ?? this.buildFallbackCandles(request.ticker);
    const avgVol = candles.reduce((s, c) => s + c.volume, 0) / candles.length;
    const atr = this.computeAtr(candles);
    const referencePrice = candles[candles.length - 1].close;

    const candidates = this.buildCandidates(candles, avgVol);
    const clusters = this.clusterCandidates(candidates, referencePrice);

    const merged = preResolvedResult?.merged;
    const instScore = this.computeInstitutionalScore(merged, request);
    const liq: InstitutionalLiquidity = merged?.liquidity ?? request.liquidity;
    const sourceCount = preResolvedResult?.usedSourceIds.length ?? 0;

    const maxVol = Math.max(...clusters.map((c) => c.volumeCluster), 1);

    const zones: InstitutionalZone[] = clusters.slice(0, this.maxZones).map((cluster) => {
      const volumeScore = cluster.volumeCluster / maxVol;
      const sourceScore = sourceCount > 0 ? Math.min(sourceCount / 4, 1) : 0.2;
      const touchesScore = Math.min(cluster.touches / 5, 1);
      const liqWeight = liq === "high" ? 1 : liq === "medium" ? 0.7 : 0.4;

      // FIC: Zone confidence: base + institutional score + liquidity + directional bias + body factor. (EN)
      // FIC: Confianza de zona: base + score institucional + liquidez + sesgo direccional + factor cuerpo. (ES)
      const zoneConf = Math.min(
        0.95,
        0.35 + instScore * 0.35 + (liq === "high" ? 0.15 : 0.05) + 0.1 * 0.5 + 0.05 * 0.5
      );

      // FIC: Zone strength: weighted sum of volume, source breadth, touches, liquidity, and confidence. (EN)
      // FIC: Fuerza de zona: suma ponderada de volumen, amplitud de fuentes, toques, liquidez y confianza. (ES)
      const strength = Math.min(
        1,
        0.25 + volumeScore * 0.35 + sourceScore * 0.2 + touchesScore * 0.15 + liqWeight * 0.05 + zoneConf * 0.15
      );

      return { price: cluster.price, type: cluster.type, strength, confidence: zoneConf, volumeCluster: cluster.volumeCluster, touches: cluster.touches, liquidity: liq };
    });

    zones.sort((a, b) => b.strength - a.strength);

    return {
      ticker: request.ticker,
      zones,
      supportZones: zones.filter((z) => z.type === "support"),
      resistanceZones: zones.filter((z) => z.type === "resistance"),
      candlesAnalyzed: candles.length,
      sourceCount,
      atr,
      institutionalScore: instScore,
      analyzedAt: new Date().toISOString(),
    };
  }

  // FIC: Extract real candles from yahoo_chart observation in preResolvedResult. (EN)
  // FIC: Extrae velas reales de la observación yahoo_chart en preResolvedResult. (ES)
  private extractRealCandles(preResolvedResult?: InstitutionalResolveResult): Candle[] | null {
    const chartObs = preResolvedResult?.observations.find(
      (o) => o.sourceId === "yahoo_chart" && o.status !== "failed"
    );
    if (!chartObs?.rawSourceData) return null;
    const raw = chartObs.rawSourceData["candles"];
    if (!Array.isArray(raw) || raw.length < 10) return null;
    const candles = raw as RealCandle[];
    return candles.map((c) => ({
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
  }

  // FIC: Build 60 deterministic sinusoidal candles — no Math.random, same ticker = same candles. (EN)
  // FIC: Genera 60 velas sinusoidales deterministas — sin Math.random, mismo ticker = mismas velas. (ES)
  private buildFallbackCandles(ticker: string, count = 60): Candle[] {
    const seed = ticker.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
    const basePrice = 100 + (seed % 900);
    const baseVol = 500_000 + seed * 1_000;
    const candles: Candle[] = [];
    let price = basePrice;

    for (let i = 0; i < count; i++) {
      // Drift ±1.2% sinusoidal, noise ±0.7% cosine
      const drift = Math.sin((i * Math.PI) / 30) * 0.012;
      const noise = Math.cos((i * Math.PI) / 15) * 0.007;
      price = Math.max(price * (1 + drift + noise), 1);

      const range = price * 0.015;
      candles.push({
        open: price * (1 - 0.003),
        high: price + range * 0.4,
        low: price - range * 0.4,
        close: price,
        volume: baseVol * (1 + Math.sin((i * Math.PI) / 20) * 0.3),
      });
    }
    return candles;
  }

  private computeAtr(candles: Candle[]): number {
    if (candles.length === 0) return 0;
    return candles.reduce((s, c) => s + (c.high - c.low), 0) / candles.length;
  }

  // FIC: Find pivot lows/highs with volume filter — volume must exceed avgVol × multiplier. (EN)
  // FIC: Encuentra pivot lows/highs con filtro de volumen — volumen debe superar avgVol × multiplicador. (ES)
  private buildCandidates(candles: Candle[], avgVol: number): ZoneCandidate[] {
    const w = this.pivotWindow;
    const candidates: ZoneCandidate[] = [];

    for (let i = w; i < candles.length - w; i++) {
      const c = candles[i];
      if (c.volume < avgVol * this.liquidityVolumeMultiplier) continue;

      let isPivotLow = true;
      let isPivotHigh = true;
      for (let j = i - w; j <= i + w; j++) {
        if (j === i) continue;
        if (candles[j].close < c.close) isPivotLow = false;
        if (candles[j].close > c.close) isPivotHigh = false;
      }
      if (isPivotLow) candidates.push({ price: c.low, type: "support", volume: c.volume });
      if (isPivotHigh) candidates.push({ price: c.high, type: "resistance", volume: c.volume });
    }
    return candidates;
  }

  // FIC: Cluster nearby price levels using tolerance = referencePrice × clusterTolerancePct. (EN)
  // FIC: Agrupa niveles de precio cercanos usando tolerancia = referencePrice × clusterTolerancePct. (ES)
  private clusterCandidates(candidates: ZoneCandidate[], referencePrice: number): ZoneCluster[] {
    const tolerance = referencePrice * this.clusterTolerancePct;
    const clusters: Array<{ prices: number[]; type: "support" | "resistance"; volumes: number[] }> = [];

    for (const cand of candidates) {
      const existing = clusters.find(
        (cl) => cl.type === cand.type && Math.abs(cl.prices[0] - cand.price) <= tolerance
      );
      if (existing) {
        existing.prices.push(cand.price);
        existing.volumes.push(cand.volume);
      } else {
        clusters.push({ prices: [cand.price], type: cand.type, volumes: [cand.volume] });
      }
    }

    return clusters
      .map((cl) => ({
        price: cl.prices.reduce((s, p) => s + p, 0) / cl.prices.length,
        type: cl.type,
        volumeCluster: cl.volumes.reduce((s, v) => s + v, 0),
        touches: cl.prices.length,
      }))
      .sort((a, b) => b.volumeCluster - a.volumeCluster);
  }

  // FIC: Institutional score from confidence, ownership, positions, and flows. (EN)
  // FIC: Score institucional derivado de confianza, propiedad, posiciones y flujos. (ES)
  private computeInstitutionalScore(
    merged: InstitutionalResolveResult["merged"] | undefined,
    request: InstitutionalAnalysisContract
  ): number {
    const confidence = merged?.confidence ?? 0.5;
    const ownership = Math.min((merged?.fundsOwnershipPct ?? request.fundsOwnershipPct) / 100, 1);
    const posCount = merged?.openPositions?.count ?? request.openPositions.count;
    const posFactor = Math.min(posCount / 1_000, 1);
    const inflows = merged?.flows?.inflows ?? request.flows.inflows;
    const outflows = merged?.flows?.outflows ?? request.flows.outflows;
    const total = inflows + outflows;
    const flowFactor = total > 0 ? Math.abs(inflows - outflows) / total : 0;
    return Math.min(1, 0.2 + confidence * 0.35 + ownership * 0.2 + posFactor * 0.15 + flowFactor * 0.1);
  }
}
