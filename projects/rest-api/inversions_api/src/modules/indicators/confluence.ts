// FIC: Technical confluence engine — consolidates the 5 indicators into one verdict (Mauricio, TEAM-02).
// FIC: Motor de confluencia tecnica — consolida los 5 indicadores en un veredicto (Mauricio, TEAM-02).

import {
  ALGORITHM_VERSION,
  type ConfluenceComponent,
  type ConfluenceVerdict,
  type ConfluenceVerdictLabel,
  type OhlcBar,
  type Timeframe
} from "./types";
import { inputHash } from "./ohlcSource";
import { verdictFromScore as thresholdVerdict } from "./thresholds";
import { computeRsi } from "./rsi";
import { computeMacd } from "./macd";
import { computeEma } from "./ema";
import { computeAdx } from "./adx";
import { computeBollinger } from "./bollinger";

export interface ProbeMeta {
  symbol: string;
  timeframe: Timeframe;
}

export interface ProbeReading {
  signal: number; // directional reading in [-1, 1]
  value: number | null; // headline raw value for traceability
  detail: string; // Spanish human-readable explanation
}

// FIC: A probe wraps one indicator behind a neutral interface so missing indicators
// FIC: Una sonda envuelve un indicador tras una interfaz neutral para que un indicador
// FIC: faltante pueda degradarse sin romper la confluencia.
export interface IndicatorProbe {
  name: string;
  weight: number;
  evaluate(candles: OhlcBar[], meta: ProbeMeta): ProbeReading;
}

function clamp(x: number, lo = -1, hi = 1): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(lo, Math.min(hi, x));
}

function round(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

export const rsiProbe: IndicatorProbe = {
  name: "rsi",
  weight: 0.2,
  evaluate(candles, meta) {
    const r = computeRsi(candles, { period: 14 }, meta);
    const v = r.current_value;
    if (v === null) throw new Error("RSI sin valor disponible");
    return { signal: clamp((v - 50) / 50), value: v, detail: `RSI en ${v.toFixed(2)} (zona ${r.zone}).` };
  }
};

export const macdProbe: IndicatorProbe = {
  name: "macd",
  weight: 0.25,
  evaluate(candles, meta) {
    const m = computeMacd(candles, { fast: 12, slow: 26, signal: 9 }, meta);
    const hist = m.current_value.histogram;
    if (hist === null) throw new Error("MACD sin valor disponible");
    const macdLine = m.current_value.macd ?? 0;
    const signal = clamp(hist / (Math.abs(macdLine) + Math.abs(hist) + 1e-9));
    return {
      signal,
      value: hist,
      detail: `Histograma MACD en ${hist.toFixed(4)} (cruce ${m.current_value.cross}).`
    };
  }
};

export const emaProbe: IndicatorProbe = {
  name: "ema",
  weight: 0.2,
  evaluate(candles, meta) {
    const e = computeEma(candles, { period: 20 }, meta);
    const v = e.current_value;
    if (v === null) throw new Error("EMA sin valor disponible");
    const lastClose = candles[candles.length - 1].close;
    const denom = Math.abs(v) * 0.02 || 1;
    return {
      signal: clamp((lastClose - v) / denom),
      value: v,
      detail: `Precio ${lastClose.toFixed(2)} frente a EMA20 ${v.toFixed(2)} (${e.zone}).`
    };
  }
};

export const adxProbe: IndicatorProbe = {
  name: "adx",
  weight: 0.2,
  evaluate(candles, meta) {
    const a = computeAdx(candles, { period: 14 }, meta);
    const { adx, plus_di, minus_di } = a.current_value;
    if (adx === null || plus_di === null || minus_di === null) {
      throw new Error("ADX sin valor disponible");
    }
    const direction = clamp((plus_di - minus_di) / 100);
    const strengthFactor = clamp(adx / 50, 0, 1);
    return {
      signal: clamp(direction * strengthFactor),
      value: adx,
      detail: `ADX ${adx.toFixed(2)} (${a.current_value.strength}), +DI ${plus_di.toFixed(1)} / -DI ${minus_di.toFixed(1)}.`
    };
  }
};

export const bollingerProbe: IndicatorProbe = {
  name: "bollinger",
  weight: 0.15,
  evaluate(candles, meta) {
    const b = computeBollinger(candles, { period: 20, stdDev: 2 }, meta);
    const pb = b.current_value.percent_b;
    if (pb === null) throw new Error("Bollinger sin valor disponible");
    return { signal: clamp((pb - 0.5) * 2), value: pb, detail: `%B en ${pb.toFixed(2)} (${b.zone}).` };
  }
};

// FIC: Default probe set — the canonical 5 indicators of the TEAM-02 core.
// FIC: Conjunto de sondas por defecto — los 5 indicadores canonicos del core de TEAM-02.
export const DEFAULT_PROBES: IndicatorProbe[] = [rsiProbe, macdProbe, emaProbe, adxProbe, bollingerProbe];

// FIC: Re-export centralized verdict thresholds (T140). Original heuristic kept for backwards-compat
// FIC: pero ahora delega a thresholds.ts donde >0.2 alcista, <-0.2 bajista, resto neutral.
export function verdictFromScore(score: number): ConfluenceVerdictLabel {
  return thresholdVerdict(score);
}

// FIC: Consolidate probes into a verdict. Never throws: a failing probe degrades gracefully.
// FIC: Consolida las sondas en un veredicto. Nunca lanza: una sonda fallida degrada con gracia.
export function computeConfluence(
  candles: OhlcBar[],
  meta: ProbeMeta,
  probes: IndicatorProbe[] = DEFAULT_PROBES
): ConfluenceVerdict {
  const order = new Map(probes.map((p, i) => [p.name, i]));
  const evaluated: Array<{ probe: IndicatorProbe; reading: ProbeReading }> = [];
  const missing: string[] = [];

  for (const probe of probes) {
    try {
      evaluated.push({ probe, reading: probe.evaluate(candles, meta) });
    } catch {
      missing.push(probe.name);
    }
  }

  const availableWeight = evaluated.reduce((sum, e) => sum + e.probe.weight, 0);
  const components: ConfluenceComponent[] = [];
  let score = 0;

  for (const { probe, reading } of evaluated) {
    const normWeight = availableWeight > 0 ? probe.weight / availableWeight : 0;
    const contribution = reading.signal * normWeight;
    score += contribution;
    components.push({
      indicator: probe.name,
      available: true,
      signal: round(reading.signal),
      weight: probe.weight,
      contribution: round(contribution),
      value: reading.value,
      detail: reading.detail
    });
  }

  for (const name of missing) {
    const probe = probes.find((p) => p.name === name);
    components.push({
      indicator: name,
      available: false,
      signal: 0,
      weight: probe ? probe.weight : 0,
      contribution: 0,
      value: null,
      detail: `Indicador ${name} no disponible; excluido del calculo.`
    });
  }

  components.sort((a, b) => (order.get(a.indicator) ?? 0) - (order.get(b.indicator) ?? 0));

  const availableCount = evaluated.length;
  const finalScore = clamp(round(score));
  // FIC: With fewer than 3 indicators the verdict is forced to neutral (degradation policy).
  // FIC: Con menos de 3 indicadores el veredicto se fuerza a neutral (politica de degradacion).
  const verdict: ConfluenceVerdictLabel = availableCount < 3 ? "neutral" : verdictFromScore(finalScore);

  return {
    symbol: meta.symbol,
    timeframe: meta.timeframe,
    verdict,
    score: finalScore,
    components,
    degraded: missing.length > 0 || availableCount < probes.length,
    missing,
    inputs_used: evaluated.map((e) => e.probe.name),
    algorithm_version: ALGORITHM_VERSION,
    computed_at: new Date().toISOString(),
    source_input_hash: inputHash(candles),
    bars_used: candles.length
  };
}
