// FIC: REST endpoint GET /api/indicators/rsi — momentum slice (Kevin, TEAM-02).
// FIC: Endpoint REST GET /api/indicators/rsi — slice de momentum (Kevin, TEAM-02).

import { Router } from "express";
import { computeRsi } from "../../modules/indicators/rsi";
import { getCandles, isSupportedTimeframe } from "../../modules/indicators/ohlcSource";
import { respondError } from "../../modules/indicators/errors";
import { memoizeIndicator } from "../../modules/indicators/cache";
import type { Timeframe } from "../../modules/indicators/types";

export const rsiRouter = Router();

rsiRouter.get("/rsi", async (req, res) => {
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
  if (candles.length <= periodRaw) {
    return respondError(
      res,
      422,
      "insufficient_data",
      `Se requieren al menos ${periodRaw + 1} velas; recibidas ${candles.length}.`,
      "Aumenta 'count' o reduce 'period'."
    );
  }

  // FIC: T143 — memoiza por (symbol, timeframe, params, last_bar_ts), TTL = duracion de 1 vela.
  const result = memoizeIndicator({
    indicator: "rsi",
    symbol,
    timeframe,
    params: { period: periodRaw },
    candles,
    compute: () => computeRsi(candles, { period: periodRaw }, { symbol, timeframe })
  });
  return res.status(200).json(result);
});
