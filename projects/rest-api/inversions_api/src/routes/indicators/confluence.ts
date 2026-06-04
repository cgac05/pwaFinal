// FIC: REST endpoint GET /api/indicators/confluence — consolidated verdict (Mauricio, TEAM-02).
// FIC: Endpoint REST GET /api/indicators/confluence — veredicto consolidado (Mauricio, TEAM-02).

import { Router } from "express";
import { computeConfluence } from "../../modules/indicators/confluence";
import { getCandles, isSupportedTimeframe } from "../../modules/indicators/ohlcSource";
import { respondError } from "../../modules/indicators/errors";
import { memoizeIndicator } from "../../modules/indicators/cache";
import type { Timeframe } from "../../modules/indicators/types";

export const indicatorsConfluenceRouter = Router();

indicatorsConfluenceRouter.get("/confluence", async (req, res) => {
  const symbol = String(req.query.symbol ?? "").toUpperCase();
  const timeframeRaw = String(req.query.timeframe ?? "1h");
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
  if (!Number.isInteger(countRaw) || countRaw <= 0 || countRaw > 1000) {
    return respondError(res, 400, "invalid_count", "El parametro 'count' debe ser entero en (0, 1000].");
  }

  const timeframe = timeframeRaw as Timeframe;
  const candles = await getCandles({ symbol, timeframe, count: countRaw });

  if (candles.length === 0) {
    return respondError(res, 404, "symbol_not_found", `No hay datos OHLC para '${symbol}'.`);
  }

  // FIC: computeConfluence never throws — a missing indicator degrades, it does not 500.
  // FIC: computeConfluence nunca lanza — un indicador faltante degrada, no produce 500.
  const verdict = memoizeIndicator({
    indicator: "confluence",
    symbol,
    timeframe,
    params: { count: countRaw },
    candles,
    compute: () => computeConfluence(candles, { symbol, timeframe })
  });
  return res.status(200).json(verdict);
});
