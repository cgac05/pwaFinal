// FIC: REST endpoint GET /api/indicators/bollinger — volatility slice (Edgar, TEAM-02).
// FIC: Endpoint REST GET /api/indicators/bollinger — slice de volatilidad (Edgar, TEAM-02).

import { Router } from "express";
import { computeBollinger } from "../../modules/indicators/bollinger";
import { getCandles, isSupportedTimeframe } from "../../modules/indicators/ohlcSource";
import { respondError } from "../../modules/indicators/errors";
import { memoizeIndicator } from "../../modules/indicators/cache";
import type { Timeframe } from "../../modules/indicators/types";

export const bollingerRouter = Router();

bollingerRouter.get("/bollinger", async (req, res) => {
  const symbol = String(req.query.symbol ?? "").toUpperCase();
  const timeframeRaw = String(req.query.timeframe ?? "1h");
  const periodRaw = Number(req.query.period ?? 20);
  const stdDevRaw = Number(req.query.stdDev ?? 2);
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
  if (!Number.isFinite(stdDevRaw) || stdDevRaw <= 0 || stdDevRaw > 10) {
    return respondError(res, 400, "invalid_params", "El parametro 'stdDev' debe ser un numero en (0, 10].");
  }
  if (!Number.isInteger(countRaw) || countRaw <= 0 || countRaw > 1000) {
    return respondError(res, 400, "invalid_count", "El parametro 'count' debe ser entero en (0, 1000].");
  }

  const timeframe = timeframeRaw as Timeframe;
  const candles = await getCandles({ symbol, timeframe, count: countRaw });

  if (candles.length === 0) {
    return respondError(res, 404, "symbol_not_found", `No hay datos OHLC para '${symbol}'.`);
  }
  if (candles.length < periodRaw) {
    return respondError(
      res,
      422,
      "insufficient_data",
      `Se requieren al menos ${periodRaw} velas; recibidas ${candles.length}.`,
      "Aumenta 'count' o reduce 'period'."
    );
  }

  const result = memoizeIndicator({
    indicator: "bollinger",
    symbol,
    timeframe,
    params: { period: periodRaw, stdDev: stdDevRaw },
    candles,
    compute: () => computeBollinger(candles, { period: periodRaw, stdDev: stdDevRaw }, { symbol, timeframe })
  });
  return res.status(200).json(result);
});
