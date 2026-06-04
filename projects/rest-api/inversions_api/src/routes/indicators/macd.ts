// FIC: REST endpoint GET /api/indicators/macd — momentum slice (Kevin, TEAM-02).
// FIC: Endpoint REST GET /api/indicators/macd — slice de momentum (Kevin, TEAM-02).

import { Router } from "express";
import { computeMacd } from "../../modules/indicators/macd";
import { getCandles, isSupportedTimeframe } from "../../modules/indicators/ohlcSource";
import { respondError } from "../../modules/indicators/errors";
import { memoizeIndicator } from "../../modules/indicators/cache";
import type { Timeframe } from "../../modules/indicators/types";

export const macdRouter = Router();

macdRouter.get("/macd", async (req, res) => {
  const symbol = String(req.query.symbol ?? "").toUpperCase();
  const timeframeRaw = String(req.query.timeframe ?? "1h");
  const fast = Number(req.query.fast ?? 12);
  const slow = Number(req.query.slow ?? 26);
  const signal = Number(req.query.signal ?? 9);
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
  if (![fast, slow, signal].every((n) => Number.isInteger(n) && n > 0 && n <= 500)) {
    return respondError(res, 400, "invalid_params", "fast, slow y signal deben ser enteros en (0, 500].");
  }
  if (fast >= slow) {
    return respondError(res, 400, "invalid_params", "'fast' debe ser menor que 'slow'.");
  }
  if (!Number.isInteger(countRaw) || countRaw <= 0 || countRaw > 1000) {
    return respondError(res, 400, "invalid_count", "El parametro 'count' debe ser entero en (0, 1000].");
  }

  const timeframe = timeframeRaw as Timeframe;
  const candles = await getCandles({ symbol, timeframe, count: countRaw });

  if (candles.length === 0) {
    return respondError(res, 404, "symbol_not_found", `No hay datos OHLC para '${symbol}'.`);
  }

  const minBars = slow + signal;
  if (candles.length < minBars) {
    return respondError(
      res,
      422,
      "insufficient_data",
      `Se requieren al menos ${minBars} velas; recibidas ${candles.length}.`,
      "Aumenta 'count' o reduce 'slow'/'signal'."
    );
  }

  const result = memoizeIndicator({
    indicator: "macd",
    symbol,
    timeframe,
    params: { fast, slow, signal },
    candles,
    compute: () => computeMacd(candles, { fast, slow, signal }, { symbol, timeframe })
  });
  return res.status(200).json(result);
});
