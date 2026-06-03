// FIC: Wheel eligibility service -- pre-filter assets before Cash Secured Put / Covered Call analysis. (EN)
// FIC: Servicio de elegibilidad Wheel -- prefiltra activos antes del analisis Cash Secured Put / Covered Call. (ES)

import { computeEmaSeries } from "../../indicators/macd";
import { getCandles } from "../../indicators/ohlcSource";
import type { OhlcBar } from "../../indicators/types";
import { fetchYahooOhlc } from "../../institutional/yahooChartParser";

export type WheelEligibilityCriterionId =
  | "daily_ema_50_above_200"
  | "weekly_ema_10_above_20"
  | "weinstein_stage_2"
  | "atr_trailing_stop_2x_atr14"
  | "earnings_more_than_30_days"
  | "iv_rank_above_30";

export type WheelEligibilityCriterionStatus = "pass" | "fail" | "unavailable";

export type WheelEligibilityStatus = "eligible" | "not_eligible" | "partial";

export interface WheelEligibilityCriterion {
  id: WheelEligibilityCriterionId;
  label: string;
  status: WheelEligibilityCriterionStatus;
  value?: number | string;
  threshold?: number | string;
  details: string;
}

export interface WheelEligibilityResult {
  ticker: string;
  eligible: boolean;
  status: WheelEligibilityStatus;
  evaluatedAt: string;
  criteria: WheelEligibilityCriterion[];
  summary: {
    passed: number;
    failed: number;
    unavailable: number;
    total: number;
  };
}

const DAILY_CANDLE_COUNT = 260;
const ATR_PERIOD = 14;
const ATR_MULTIPLIER = 2;

function lastValue(values: Array<number | null>): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    const value = values[i];
    if (value !== null && Number.isFinite(value)) return value;
  }
  return null;
}

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function unavailableCriterion(
  id: WheelEligibilityCriterionId,
  label: string,
  details: string
): WheelEligibilityCriterion {
  return { id, label, status: "unavailable", details };
}

function calculateAtrSeries(candles: OhlcBar[], period: number): Array<number | null> {
  const trueRanges = candles.map((candle, index) => {
    if (index === 0) return candle.high - candle.low;
    const previousClose = candles[index - 1].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    );
  });

  const atr: Array<number | null> = Array(candles.length).fill(null);
  if (trueRanges.length < period) return atr;

  let running = trueRanges.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  atr[period - 1] = running;

  for (let i = period; i < trueRanges.length; i++) {
    running = ((running * (period - 1)) + trueRanges[i]) / period;
    atr[i] = running;
  }

  return atr;
}

function calculateAtrTrailingStop(
  candles: OhlcBar[],
  period = ATR_PERIOD,
  multiplier = ATR_MULTIPLIER
): number | null {
  const atr = calculateAtrSeries(candles, period);
  let stop: number | null = null;

  for (let i = 0; i < candles.length; i++) {
    const atrValue = atr[i];
    if (atrValue === null) continue;

    const close = candles[i].close;
    const longStop = close - multiplier * atrValue;
    const shortStop = close + multiplier * atrValue;

    if (stop === null) {
      stop = longStop;
      continue;
    }

    stop = close > stop
      ? Math.max(stop, longStop)
      : shortStop;
  }

  return stop;
}

function evaluateDailyEma(candles: OhlcBar[]): WheelEligibilityCriterion {
  const closes = candles.map((candle) => candle.close);
  const ema50 = lastValue(computeEmaSeries(closes, 50));
  const ema200 = lastValue(computeEmaSeries(closes, 200));

  if (ema50 === null || ema200 === null) {
    return unavailableCriterion(
      "daily_ema_50_above_200",
      "EMA50 > EMA200 diario",
      `Se requieren al menos 200 velas diarias; recibidas ${candles.length}.`
    );
  }

  const passed = ema50 > ema200;
  return {
    id: "daily_ema_50_above_200",
    label: "EMA50 > EMA200 diario",
    status: passed ? "pass" : "fail",
    value: `EMA50=${round(ema50, 2)}, EMA200=${round(ema200, 2)}`,
    threshold: "EMA50 mayor que EMA200",
    details: passed
      ? "La tendencia diaria primaria cumple el filtro alcista."
      : "La EMA50 diaria no supera la EMA200 diaria.",
  };
}

function evaluateWeeklyEma(candles: OhlcBar[]): WheelEligibilityCriterion {
  const closes = candles.map((candle) => candle.close);
  const ema10 = lastValue(computeEmaSeries(closes, 10));
  const ema20 = lastValue(computeEmaSeries(closes, 20));

  if (ema10 === null || ema20 === null) {
    return unavailableCriterion(
      "weekly_ema_10_above_20",
      "EMA10 > EMA20 semanal",
      `Se requieren al menos 20 velas semanales; recibidas ${candles.length}.`
    );
  }

  const passed = ema10 > ema20;
  return {
    id: "weekly_ema_10_above_20",
    label: "EMA10 > EMA20 semanal",
    status: passed ? "pass" : "fail",
    value: `EMA10=${round(ema10, 2)}, EMA20=${round(ema20, 2)}`,
    threshold: "EMA10 mayor que EMA20",
    details: passed
      ? "El momentum semanal cumple el filtro alcista."
      : "La EMA10 semanal no supera la EMA20 semanal.",
  };
}

function evaluateWeinsteinStage2(candles: OhlcBar[]): WheelEligibilityCriterion {
  const closes = candles.map((candle) => candle.close);
  const ema30 = computeEmaSeries(closes, 30);
  const latestClose = closes[closes.length - 1];
  const latestEma30 = lastValue(ema30);
  const priorEma30 = ema30.length >= 5 ? ema30[ema30.length - 5] : null;
  const priorClose10w = closes.length >= 11 ? closes[closes.length - 11] : undefined;

  if (
    latestEma30 === null ||
    priorEma30 === null ||
    priorClose10w === undefined ||
    latestClose === undefined
  ) {
    return unavailableCriterion(
      "weinstein_stage_2",
      "Stage 2 de Weinstein",
      `Se requieren suficientes velas semanales para EMA30 y pendiente; recibidas ${candles.length}.`
    );
  }

  const priceAboveTrend = latestClose > latestEma30;
  const ema30Rising = latestEma30 > priorEma30;
  const priceAdvancing = latestClose > priorClose10w;
  const passed = priceAboveTrend && ema30Rising && priceAdvancing;

  return {
    id: "weinstein_stage_2",
    label: "Stage 2 de Weinstein",
    status: passed ? "pass" : "fail",
    value: `Close=${round(latestClose, 2)}, Close10w=${round(priorClose10w, 2)}, EMA30w=${round(latestEma30, 2)}, EMA30w_prev=${round(priorEma30, 2)}`,
    threshold: "Precio > EMA30 semanal, EMA30 semanal ascendente, precio > cierre de 10 semanas atras",
    details: passed
      ? "El activo cumple una aproximacion Stage 2 con datos semanales disponibles."
      : `No cumple Stage 2: precioSobreEMA30=${priceAboveTrend}, ema30Ascendente=${ema30Rising}, precioAvanzando10w=${priceAdvancing}.`,
  };
}

function evaluateAtrTrailingStop(candles: OhlcBar[]): WheelEligibilityCriterion {
  const latestClose = candles[candles.length - 1]?.close;
  const stop = calculateAtrTrailingStop(candles);

  if (latestClose === undefined || stop === null) {
    return unavailableCriterion(
      "atr_trailing_stop_2x_atr14",
      "Precio > ATR Trailing Stop (2 x ATR14)",
      `Se requieren al menos ${ATR_PERIOD} velas diarias para ATR14; recibidas ${candles.length}.`
    );
  }

  const passed = latestClose > stop;
  return {
    id: "atr_trailing_stop_2x_atr14",
    label: "Precio > ATR Trailing Stop (2 x ATR14)",
    status: passed ? "pass" : "fail",
    value: `Close=${round(latestClose, 2)}, Stop=${round(stop, 2)}`,
    threshold: "Precio de cierre mayor que trailing stop",
    details: passed
      ? "El precio se mantiene por encima del ATR trailing stop."
      : "El precio esta por debajo del ATR trailing stop.",
  };
}

async function getWeeklyCandles(ticker: string): Promise<OhlcBar[] | null> {
  const candles = await fetchYahooOhlc(ticker, "1w", globalThis.fetch);
  if (!candles || candles.length === 0) return null;
  return candles.map((candle) => ({
    time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  }));
}

function buildResult(ticker: string, criteria: WheelEligibilityCriterion[]): WheelEligibilityResult {
  const passed = criteria.filter((criterion) => criterion.status === "pass").length;
  const failed = criteria.filter((criterion) => criterion.status === "fail").length;
  const unavailable = criteria.filter((criterion) => criterion.status === "unavailable").length;
  const total = criteria.length;
  const eligible = failed === 0;

  return {
    ticker,
    eligible,
    status: failed > 0 ? "not_eligible" : unavailable > 0 ? "partial" : "eligible",
    evaluatedAt: new Date().toISOString(),
    criteria,
    summary: { passed, failed, unavailable, total },
  };
}

export class WheelEligibilityService {
  async evaluate(ticker: string): Promise<WheelEligibilityResult> {
    const normalizedTicker = ticker.trim().toUpperCase();

    const [dailyCandles, weeklyCandles] = await Promise.all([
      getCandles({ symbol: normalizedTicker, timeframe: "1d", count: DAILY_CANDLE_COUNT }),
      getWeeklyCandles(normalizedTicker).catch(() => null),
    ]);

    const criteria: WheelEligibilityCriterion[] = [
      evaluateDailyEma(dailyCandles),
      weeklyCandles
        ? evaluateWeeklyEma(weeklyCandles)
        : unavailableCriterion(
            "weekly_ema_10_above_20",
            "EMA10 > EMA20 semanal",
            "No se pudieron obtener velas semanales desde la fuente OHLC existente."
          ),
      weeklyCandles
        ? evaluateWeinsteinStage2(weeklyCandles)
        : unavailableCriterion(
            "weinstein_stage_2",
            "Stage 2 de Weinstein",
            "No se pudieron obtener velas semanales desde la fuente OHLC existente."
          ),
      evaluateAtrTrailingStop(dailyCandles),
      unavailableCriterion(
        "earnings_more_than_30_days",
        "Earnings a mas de 30 dias",
        "No existe dato de proxima fecha de earnings en los servicios actuales."
      ),
      unavailableCriterion(
        "iv_rank_above_30",
        "IV Rank > 30",
        "La option chain actual provee IV vigente, pero no historico de IV ni IV Rank calculado."
      ),
    ];

    return buildResult(normalizedTicker, criteria);
  }
}

export function createWheelEligibilityService(): WheelEligibilityService {
  return new WheelEligibilityService();
}
