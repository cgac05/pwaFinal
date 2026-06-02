// FIC: A_ESTRATEGIA table builder — translates market conditions to strategy viability rows. (EN)
// FIC: Constructor de tabla A_ESTRATEGIA — traduce condiciones de mercado a filas de viabilidad. (ES)
//
// This core evaluates which complex option strategies (Iron Condor, Butterfly, etc.)
// are viable based on current market volatility, trend direction, and price levels.

import type {
  ConfluenceSignalRow,
  Tendencia,
  TipoSenal,
  DeltaPrev,
  Timeframe,
} from "./types";
import type { OhlcBar } from "./types";

// ─── Helpers ──

function tipoSenalFromScore(score: number): TipoSenal {
  if (score > 0.2)  return "CALL";
  if (score < -0.2) return "PUT";
  return "HOLD";
}

function tendenciaFromScore(score: number): Tendencia {
  if (score > 0.15)  return "ALCISTA";
  if (score < -0.15) return "BAJISTA";
  return "LATERAL";
}

// Calculate simple volatility as percentage change over last N candles
function calculateSimpleVolatility(candles: OhlcBar[], periods: number = 20): number {
  if (candles.length < 2) return 0;
  
  const recentCandles = candles.slice(-Math.min(periods, candles.length));
  const closes = recentCandles.map(c => c.close || c.open);
  const returns = [];
  
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  
  if (returns.length === 0) return 0;
  
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * 100; // Percentage
}

// Calculate trend direction (1 = up, -1 = down, 0 = neutral)
function calculateTrendDirection(candles: OhlcBar[], periods: number = 10): number {
  if (candles.length < periods) return 0;
  
  const recent = candles.slice(-periods);
  const closes = recent.map(c => c.close || c.open);
  
  const sma = closes.reduce((a, b) => a + b, 0) / closes.length;
  const lastClose = closes[closes.length - 1];
  
  const diff = lastClose - sma;
  const normalized = diff / sma;
  
  if (normalized > 0.02) return 1;     // Uptrend
  if (normalized < -0.02) return -1;   // Downtrend
  return 0;                             // Neutral
}

// Calculate ATR (Average True Range) as percentage of last close
function calculateATRPercent(candles: OhlcBar[]): number {
  if (candles.length < 14) return 2; // Default 2% if insufficient data
  
  const recentCandles = candles.slice(-14);
  let sumTR = 0;
  
  for (let i = 0; i < recentCandles.length; i++) {
    const current = recentCandles[i];
    const previous = i > 0 ? recentCandles[i - 1] : null;
    
    const high = current.high;
    const low = current.low;
    
    let tr = high - low; // True Range base
    
    if (previous) {
      const upGap = Math.abs(high - previous.close);
      const downGap = Math.abs(low - previous.close);
      tr = Math.max(tr, upGap, downGap);
    }
    
    sumTR += tr;
  }
  
  const atr = sumTR / 14;
  const lastClose = candles[candles.length - 1].close || candles[candles.length - 1].open;
  
  return (atr / lastClose) * 100;
}

// Map trend + volatility to strategy viability
function getStrategyViabilityString(trendDir: number, volatility: number, atrPercent: number): {
  signal: string;
  strategies: string[];
  explanation: string;
} {
  const isHighVol = volatility > 2.5;
  const isLowVol = volatility < 1.5;
  const isWideRanges = atrPercent > 2;
  
  if (trendDir > 0) {
    // UPTREND
    if (isLowVol) {
      return {
        signal: "CALL",
        strategies: ["Bull Call Spread (tight)"],
        explanation: "Tendencia alcista con baja volatilidad → Spreads ajustados recomendados para capturar movimiento sin sobre-exposición"
      };
    } else if (isHighVol) {
      return {
        signal: "CALL",
        strategies: ["Call Ratio Spread", "Iron Condor (call-heavy)"],
        explanation: "Tendencia alcista con volatilidad alta → Venta de upside calls para capturar IV crush"
      };
    } else {
      return {
        signal: "CALL",
        strategies: ["Bull Call Spread", "Iron Condor"],
        explanation: "Tendencia alcista neutral → Múltiples estructuras viables; Iron Condor es versátil"
      };
    }
  } else if (trendDir < 0) {
    // DOWNTREND
    if (isLowVol) {
      return {
        signal: "PUT",
        strategies: ["Bear Put Spread (tight)"],
        explanation: "Tendencia bajista con baja volatilidad → Spreads ajustados para limitar riesgo"
      };
    } else if (isHighVol) {
      return {
        signal: "PUT",
        strategies: ["Put Ratio Spread", "Iron Condor (put-heavy)"],
        explanation: "Tendencia bajista con volatilidad alta → Venta de downside puts para capitalizar IV"
      };
    } else {
      return {
        signal: "PUT",
        strategies: ["Bear Put Spread", "Iron Condor"],
        explanation: "Tendencia bajista neutral → Iron Condor adaptable a cualquier sesgo"
      };
    }
  } else {
    // LATERAL / NEUTRAL
    if (isLowVol && !isWideRanges) {
      return {
        signal: "HOLD",
        strategies: ["Butterfly Spread", "Iron Butterfly (tight)"],
        explanation: "Mercado lateral con baja volatilidad → Butterfly es óptimo para rango estrecho"
      };
    } else if (isHighVol || isWideRanges) {
      return {
        signal: "HOLD",
        strategies: ["Iron Condor (wide)", "Strangle"],
        explanation: "Mercado lateral con volatilidad/rango amplios → Iron Condor wide vende IV en ambos lados"
      };
    } else {
      return {
        signal: "HOLD",
        strategies: ["Iron Condor", "Straddle"],
        explanation: "Mercado neutral → Esperar confirmación de tendencia o ejecutar Iron Condor versátil"
      };
    }
  }
}

function deltaVsAnterior(
  previous: ConfluenceSignalRow | undefined,
  tipoSenal: TipoSenal
): DeltaPrev {
  if (!previous) return "NUEVA";
  if (previous.tipoSenal === tipoSenal) return "CONFIRMADA";
  if (
    (previous.tipoSenal === "CALL" && tipoSenal === "PUT") ||
    (previous.tipoSenal === "PUT"  && tipoSenal === "CALL")
  ) return "INVERTIDA";
  return "DEGRADADA";
}

export interface StrategyTableInput {
  ticket: string;
  timeframe: Timeframe;
  candles: OhlcBar[];
  sourceInputHash: string;
  previousRows?: ConfluenceSignalRow[];
  now?: Date;
}

// FIC: Build a single A_ESTRATEGIA ConfluenceSignalRow from market conditions. (EN)
// FIC: Construye una fila ConfluenceSignalRow de A_ESTRATEGIA desde condiciones del mercado. (ES)
// This core evaluates which complex strategies are viable based on volatility, trend, and ranges.
export function buildStrategyViabilityTable(input: StrategyTableInput): ConfluenceSignalRow[] {
  const computedAt = input.now ?? new Date();

  try {
    // 1. Calculate market conditions
    const volatility = calculateSimpleVolatility(input.candles);
    const trendDir = calculateTrendDirection(input.candles);
    const atrPercent = calculateATRPercent(input.candles);
    
    // 2. Map to strategy viability
    const viability = getStrategyViabilityString(trendDir, volatility, atrPercent);
    
    // 3. Calculate score based on condition confidence
    let score = 0;
    if (trendDir > 0.5) score = 0.6;         // Strong uptrend
    else if (trendDir > 0) score = 0.3;      // Mild uptrend
    else if (trendDir < -0.5) score = -0.6;  // Strong downtrend
    else if (trendDir < 0) score = -0.3;     // Mild downtrend
    else score = 0;                          // Neutral
    
    const tipoSenal = tipoSenalFromScore(score);
    const tendencia = tendenciaFromScore(score);
    const precio = input.candles[input.candles.length - 1]?.close 
                 || input.candles[input.candles.length - 1]?.open 
                 || 0;

    const previous = input.previousRows?.find(
      (r) => r.core === "A_ESTRATEGIA" && !r.subCore
    );

    // Vigencia = 5 candle-lengths ahead (same convention as coreStubs)
    const TIMEFRAME_MS: Record<string, number> = {
      "1m": 60_000, "5m": 300_000, "15m": 900_000,
      "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000
    };
    const tfMs = TIMEFRAME_MS[input.timeframe] ?? 3_600_000;
    const vigencia = new Date(computedAt.getTime() + tfMs * 5).toISOString();

    const metricas: Record<string, number> = {
      "volatility_percent": Math.round(volatility * 100) / 100,
      "trend_direction": trendDir,
      "atr_percent": Math.round(atrPercent * 100) / 100,
      "confidence": Math.abs(score)
    };

    const row: ConfluenceSignalRow = {
      ticket: input.ticket,
      core: "A_ESTRATEGIA",
      precio,
      tipoSenal,
      fecha: computedAt.toISOString().slice(0, 10),
      timeframe: input.timeframe,
      tendencia,
      score: parseFloat(score.toFixed(4)),
      peso: 0.1,
      invertir: Math.abs(score) >= 0.3,
      estado: "ACTIVA",
      vigencia,
      fuente: "strategy-viability-engine",
      evidencia_refs: [
        `volatility_percent:${volatility.toFixed(2)}`,
        `trend_direction:${trendDir}`,
        `atr_percent:${atrPercent.toFixed(2)}`,
        `viable_strategies:${viability.strategies.length}`
      ],
      ia_revisada: false,
      delta_vs_anterior: deltaVsAnterior(previous, tipoSenal),
      observacion: {
        objetivo: `Evaluar viabilidad de estrategias complejas en ${input.timeframe}`,
        senal: `${viability.signal === "CALL" ? "ALCISTA" : viability.signal === "PUT" ? "BAJISTA" : "NEUTRAL"} | Estrategias: ${viability.strategies.join(", ")}`,
        explicacion: viability.explanation,
        metricas
      },
      algorithm_version: "1.0",
      computed_at: computedAt.toISOString(),
      source_input_hash: input.sourceInputHash
    };

    return [row];
  } catch (err) {
    console.error("[A_ESTRATEGIA] engine error:", err);
    // Fallback: return empty array (will be stubbed if enabled)
    return [];
  }
}
