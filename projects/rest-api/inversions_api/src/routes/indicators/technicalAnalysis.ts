// FIC: REST endpoint POST /api/indicators/technical-analysis — support/resistance levels, trend, trend lines. (EN)
// FIC: Endpoint REST POST /api/indicators/technical-analysis — niveles de soporte/resistencia, tendencia, líneas de tendencia. (ES)

import { Router } from "express";
import { analyzeTechnicalLevels } from "../../modules/indicators/technicalAnalysis";
import { getCandles, isSupportedTimeframe } from "../../modules/indicators/ohlcSource";
import { respondError } from "../../modules/indicators/errors";
import { memoizeIndicator } from "../../modules/indicators/cache";
import type { Timeframe } from "../../modules/indicators/types";

export const technicalAnalysisRouter = Router();

// FIC: POST /api/indicators/technical-analysis
// FIC: Body: { symbol: string, timeframe?: Timeframe, count?: number, pivotWindow?: number, supportResistanceWindow?: number, trendWindow?: number, clusterTolerance?: number }
technicalAnalysisRouter.post("/technical-analysis", async (req, res) => {
  const body = req.body ?? {};
  const symbol = String(body.symbol ?? "").toUpperCase();
  const timeframeRaw = String(body.timeframe ?? "1d");
  const countRaw = Number(body.count ?? 300);
  
  const pivotWindowRaw = body.pivotWindow !== undefined ? Number(body.pivotWindow) : undefined;
  const supportResistanceWindowRaw = body.supportResistanceWindow !== undefined
    ? Number(body.supportResistanceWindow)
    : undefined;
  const trendWindowRaw = body.trendWindow !== undefined ? Number(body.trendWindow) : undefined;
  const clusterToleranceRaw = body.clusterTolerance !== undefined ? Number(body.clusterTolerance) : undefined;

  const allowedPanelWindows = new Set([5, 10, 15, 20, 50]);

  // ── Validation ────────────────────────────────────────────────────────────
  if (!symbol) {
    return respondError(
      res,
      400,
      "missing_symbol",
      "El campo 'symbol' es obligatorio.",
      "Ejemplo: { \"symbol\": \"AAPL\" }"
    );
  }
  if (!isSupportedTimeframe(timeframeRaw)) {
    return respondError(
      res,
      400,
      "invalid_timeframe",
      `Timeframe '${timeframeRaw}' no soportado.`,
      "Valores válidos: 1m, 5m, 15m, 1h, 4h, 1d"
    );
  }
  if (!Number.isInteger(countRaw) || countRaw <= 0 || countRaw > 1000) {
    return respondError(
      res,
      400,
      "invalid_count",
      "El campo 'count' debe ser un entero en (0, 1000]."
    );
  }
  if (pivotWindowRaw !== undefined && (!Number.isInteger(pivotWindowRaw) || pivotWindowRaw < 2 || pivotWindowRaw > 50)) {
    return respondError(
      res,
      400,
      "invalid_pivot_window",
      "El campo 'pivotWindow' debe ser un entero en [2, 50]."
    );
  }
  if (
    supportResistanceWindowRaw !== undefined &&
    (!Number.isInteger(supportResistanceWindowRaw) || !allowedPanelWindows.has(supportResistanceWindowRaw))
  ) {
    return respondError(
      res,
      400,
      "invalid_support_resistance_window",
      "El campo 'supportResistanceWindow' debe ser uno de: 5, 10, 15, 20, 50."
    );
  }
  if (
    trendWindowRaw !== undefined &&
    (!Number.isInteger(trendWindowRaw) || !allowedPanelWindows.has(trendWindowRaw))
  ) {
    return respondError(
      res,
      400,
      "invalid_trend_window",
      "El campo 'trendWindow' debe ser uno de: 5, 10, 15, 20, 50."
    );
  }
  if (
    clusterToleranceRaw !== undefined &&
    (!Number.isFinite(clusterToleranceRaw) || clusterToleranceRaw <= 0 || clusterToleranceRaw > 0.1)
  ) {
    return respondError(
      res,
      400,
      "invalid_cluster_tolerance",
      "El campo 'clusterTolerance' debe ser un número en (0, 0.1].",
      "Ejemplo: 0.005 equivale a 0.5%"
    );
  }

  // ── Load candles ──────────────────────────────────────────────────────────
  const timeframe = timeframeRaw as Timeframe;
  const candles = await getCandles({ symbol, timeframe, count: countRaw });
  if (candles.length === 0) {
    return respondError(res, 404, "symbol_not_found", `No hay datos OHLC para '${symbol}'.`);
  }

  // FIC: Minimum 78 bars required (EMA50 seed + ADX(14) warm-up = 50 + 28). (EN)
  const MIN_BARS = 78;
  if (candles.length < MIN_BARS) {
    return respondError(
      res,
      422,
      "insufficient_data",
      `Se requieren al menos ${MIN_BARS} velas; recibidas ${candles.length}.`,
      "Aumenta 'count' o usa un timeframe con más historia disponible."
    );
  }

  // ── Compute (memoized) ────────────────────────────────────────────────────
  const supportResistanceWindow = supportResistanceWindowRaw ?? pivotWindowRaw ?? 20;
  const trendWindow = trendWindowRaw ?? pivotWindowRaw ?? 20;
  const params = {
    supportResistanceWindow,
    trendWindow,
    pivotWindow: pivotWindowRaw ?? "none",
    clusterTolerance: clusterToleranceRaw ?? 0.005,
  };

  const result = memoizeIndicator({
    indicator: "technical-analysis",
    symbol,
    timeframe,
    params,
    candles,
    compute: () => {
      const levelsResult = analyzeTechnicalLevels(
        candles,
        { symbol, timeframe },
        {
          pivotWindow: supportResistanceWindow,
          clusterTolerance: clusterToleranceRaw,
        }
      );
      if (supportResistanceWindow === trendWindow) {
        return levelsResult;
      }
      const trendResult = analyzeTechnicalLevels(
        candles,
        { symbol, timeframe },
        {
          pivotWindow: trendWindow,
          clusterTolerance: clusterToleranceRaw,
        }
      );
      return {
        ...levelsResult,
        trendLines: trendResult.trendLines,
      };
    },
  });

  return res.status(200).json(result);
});
