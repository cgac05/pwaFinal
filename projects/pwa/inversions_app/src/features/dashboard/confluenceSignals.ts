// FIC: Client-side per-candle confluence engine — mirrors the confluence-table logic but applied
// FIC: across the whole OHLC series, so the chart can draw BUY/SELL flags on each historical candle
// FIC: where >=2 ENABLED indicators agree on a direction. Frontend-only; no backend dependency.
// FIC: Motor de confluencia vela-por-vela en cliente — replica la lógica de la tabla de confluencia
// FIC: pero aplicada a toda la serie OHLC, para dibujar banderas COMPRA/VENDE en cada vela histórica
// FIC: donde >=2 indicadores ACTIVOS coinciden en dirección. Solo frontend; sin dependencia del backend.

import {
  type OHLCVData,
  calcRSI,
  calcMACD,
  calcEMA,
  calcBollingerBands,
  calcDMI,
} from "../../utils/indicators";
import type { SubCoreIndicador } from "../../services/signals/confluenceTableApi";
import type { IndicatorState } from "../../store/indicators";

export type SignalDirection = "buy" | "sell";
type Dir = SignalDirection | "neutral";

// FIC: Minimum number of agreeing indicators required to emit a confluence flag (US-7). (EN)
// FIC: Mínimo de indicadores coincidentes para emitir una bandera de confluencia (US-7). (ES)
export const MIN_CONFLUENCE = 2;

// FIC: ADX strength gate — below this, +DI/-DI direction is treated as noise (neutral). (EN)
// FIC: Umbral de fuerza ADX — por debajo, la dirección +DI/-DI se considera ruido (neutral). (ES)
const ADX_MIN_STRENGTH = 20;

export interface IndicatorTrigger {
  indicator: SubCoreIndicador;
  direction: SignalDirection;
  /** Human-readable condition shown in the tooltip. */
  detail: string;
}

export interface ConfluenceSignal {
  /** Unix seconds — matches the candle time on the chart's time scale. */
  time: number;
  direction: SignalDirection;
  /** Indicators that agreed on `direction` at this candle (the confluence). */
  indicators: SubCoreIndicador[];
  triggers: IndicatorTrigger[];
  price: number;
  /** ISO/display date of the candle. */
  dateLabel: string;
}

// FIC: Per-candle directional STATE of one indicator (buy/sell/neutral) keyed by candle time. (EN)
// FIC: Estado direccional por vela de un indicador (buy/sell/neutral) indexado por tiempo de vela. (ES)
type StateByTime = Map<number, IndicatorTrigger>;

function toUnix(time: string): number {
  return Number(time);
}

function rsiStates(candles: OHLCVData[]): StateByTime {
  const out: StateByTime = new Map();
  for (const p of calcRSI(candles)) {
    if (p.value < 30) {
      out.set(toUnix(p.time), { indicator: "RSI", direction: "buy", detail: `RSI sobreventa (${p.value.toFixed(1)})` });
    } else if (p.value > 70) {
      out.set(toUnix(p.time), { indicator: "RSI", direction: "sell", detail: `RSI sobrecompra (${p.value.toFixed(1)})` });
    }
  }
  return out;
}

function macdStates(candles: OHLCVData[]): StateByTime {
  const out: StateByTime = new Map();
  for (const p of calcMACD(candles)) {
    if (p.macd > p.signal) {
      out.set(toUnix(p.time), { indicator: "MACD", direction: "buy", detail: "MACD sobre su señal (momentum alcista)" });
    } else if (p.macd < p.signal) {
      out.set(toUnix(p.time), { indicator: "MACD", direction: "sell", detail: "MACD bajo su señal (momentum bajista)" });
    }
  }
  return out;
}

function emaStates(candles: OHLCVData[]): StateByTime {
  const out: StateByTime = new Map();
  const closeByTime = new Map<number, number>();
  for (const c of candles) closeByTime.set(toUnix(c.time), c.close);
  for (const p of calcEMA(candles)) {
    const t = toUnix(p.time);
    const close = closeByTime.get(t);
    if (close === undefined) continue;
    if (close > p.value) {
      out.set(t, { indicator: "EMA", direction: "buy", detail: `Precio sobre EMA (${p.value.toFixed(2)})` });
    } else if (close < p.value) {
      out.set(t, { indicator: "EMA", direction: "sell", detail: `Precio bajo EMA (${p.value.toFixed(2)})` });
    }
  }
  return out;
}

function bbStates(candles: OHLCVData[]): StateByTime {
  const out: StateByTime = new Map();
  const closeByTime = new Map<number, number>();
  for (const c of candles) closeByTime.set(toUnix(c.time), c.close);
  for (const p of calcBollingerBands(candles)) {
    const t = toUnix(p.time);
    const close = closeByTime.get(t);
    if (close === undefined) continue;
    if (close <= p.lower) {
      out.set(t, { indicator: "BB", direction: "buy", detail: "Cierre bajo la banda inferior de Bollinger" });
    } else if (close >= p.upper) {
      out.set(t, { indicator: "BB", direction: "sell", detail: "Cierre sobre la banda superior de Bollinger" });
    }
  }
  return out;
}

function adxStates(candles: OHLCVData[]): StateByTime {
  const out: StateByTime = new Map();
  for (const p of calcDMI(candles)) {
    if (p.adx < ADX_MIN_STRENGTH) continue; // weak trend → no directional vote
    if (p.plusDI > p.minusDI) {
      out.set(toUnix(p.time), { indicator: "ADX", direction: "buy", detail: `+DI>-DI con ADX ${p.adx.toFixed(0)} (tendencia alcista fuerte)` });
    } else if (p.minusDI > p.plusDI) {
      out.set(toUnix(p.time), { indicator: "ADX", direction: "sell", detail: `-DI>+DI con ADX ${p.adx.toFixed(0)} (tendencia bajista fuerte)` });
    }
  }
  return out;
}

const STATE_BUILDERS: Record<SubCoreIndicador, (c: OHLCVData[]) => StateByTime> = {
  RSI: rsiStates,
  MACD: macdStates,
  EMA: emaStates,
  ADX: adxStates,
  BB: bbStates,
};

/**
 * FIC: Compute confluence flags across the candle series. A flag is emitted only at the candle
 * where a buy/sell confluence EPISODE STARTS (the direction differs from the previous candle),
 * so contiguous agreement does not saturate the chart. (EN)
 * FIC: Calcula banderas de confluencia sobre la serie. Solo se emite bandera en la vela donde
 * COMIENZA un episodio de confluencia compra/venta (cambia respecto a la vela previa), para no
 * saturar el gráfico cuando la coincidencia persiste varias velas. (ES)
 */
export function computeConfluenceSignals(
  candles: OHLCVData[],
  active: IndicatorState,
): ConfluenceSignal[] {
  const enabled = (Object.keys(active) as SubCoreIndicador[]).filter((k) => active[k]);
  if (candles.length === 0 || enabled.length === 0) return [];

  // FIC: With a single indicator enabled, show its own signals (threshold 1); with 2+, require
  // FIC: real confluence (>=2 agree) to avoid saturating the chart. (EN)
  // FIC: Con un solo indicador prendido, muestra sus señales (umbral 1); con 2+, exige confluencia
  // FIC: real (>=2 coinciden) para no saturar el gráfico. (ES)
  const threshold = Math.min(MIN_CONFLUENCE, enabled.length);

  // Precompute each enabled indicator's per-candle directional state.
  const states = enabled.map((ind) => STATE_BUILDERS[ind](candles));

  const signals: ConfluenceSignal[] = [];
  let prevDir: Dir = "neutral";

  for (const candle of candles) {
    const t = toUnix(candle.time);
    const buys: IndicatorTrigger[] = [];
    const sells: IndicatorTrigger[] = [];

    for (const state of states) {
      const trig = state.get(t);
      if (!trig) continue;
      if (trig.direction === "buy") buys.push(trig);
      else sells.push(trig);
    }

    // Confluence direction: the side with >=MIN_CONFLUENCE agreeing indicators and a clear majority.
    let dir: Dir = "neutral";
    let winners: IndicatorTrigger[] = [];
    if (buys.length >= threshold && buys.length > sells.length) {
      dir = "buy";
      winners = buys;
    } else if (sells.length >= threshold && sells.length > buys.length) {
      dir = "sell";
      winners = sells;
    }

    // Emit only at the onset of a new buy/sell episode (transition), not on every persisting candle.
    if (dir !== "neutral" && dir !== prevDir) {
      signals.push({
        time: t,
        direction: dir,
        indicators: winners.map((w) => w.indicator),
        triggers: winners,
        price: candle.close,
        dateLabel: candle.time,
      });
    }
    prevDir = dir;
  }

  return signals;
}
