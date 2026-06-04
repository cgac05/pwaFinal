// FIC: REST endpoint GET /api/indicators/adx — trend strength slice (Edgar, TEAM-02).
// FIC: Endpoint REST GET /api/indicators/adx — slice de fuerza de tendencia (Edgar, TEAM-02).

import { Router } from "express";
import { computeAdx } from "../../modules/indicators/adx";
import { getCandles, isSupportedTimeframe } from "../../modules/indicators/ohlcSource";
import { respondError } from "../../modules/indicators/errors";
import { memoizeIndicator } from "../../modules/indicators/cache";
import type { Timeframe } from "../../modules/indicators/types";

export const adxRouter = Router();

adxRouter.get("/adx", async (req, res) => {
  const symbol = String(req.query.symbol ?? "").toUpperCase();
  const timeframeRaw = String(req.query.timeframe ?? "1h");
  const periodRaw = Number(req.query.period ?? 14);
  const countRaw = Number(req.query.count ?? 300);

  if (!symbol) {
    return respondError(res, 400, "missing_symbol", "El parametro 'symbol' es obligatorio.", "Ejemplo: ?symbol=AAPL");
  }
  if (!isSupportedTimeframe(timeframeRaw)) {
    return respondError(
      res,
      400,
      "invalid_timeframe",
      `Timeframe '${timeframeRaw}' no soportado.`,
      "Valores validos: 1m, 5m, 15m, 1h, 4h, 1d"
    );
  }
  if (!Number.isInteger(periodRaw) || periodRaw <= 0 || periodRaw > 500) {
    return respondError(res, 400, "invalid_period", "El parametro 'period' debe ser entero en (0, 500].");
  }
  if (!Number.isInteger(countRaw) || countRaw <= 0 || countRaw > 1000) {
    return respondError(res, 400, "invalid_count", "El parametro 'count' debe ser entero en (0, 1000].");
  }

  const timeframe = timeframeRaw as Timeframe;
  const candles = await getCandles({ symbol, timeframe, count: countRaw });

  if (candles.length === 0) {
    return respondError(res, 404, "symbol_not_found", `No hay datos OHLC para '${symbol}'.`);
  }

  const minBars = 2 * periodRaw;
  if (candles.length < minBars) {
    return respondError(
      res,
      422,
      "insufficient_data",
      `Se requieren al menos ${minBars} velas; recibidas ${candles.length}.`,
      "Aumenta 'count' o reduce 'period'."
    );
  }

  const result = memoizeIndicator({
    indicator: "adx",
    symbol,
    timeframe,
    params: { period: periodRaw },
    candles,
    compute: () => computeAdx(candles, { period: periodRaw }, { symbol, timeframe })
  });
  return res.status(200).json(result);
});
