// FIC: REST GET /api/signals/confluence-table — Phase 5 canonical table (Kevin, TEAM-02).
// FIC: Endpoint REST GET /api/signals/confluence-table — tabla canonica Phase 5 (FR-014, US5).

import { Router } from "express";
import { buildIndicatorsTable } from "../../modules/indicators/confluenceTable";
import { buildCoreStubs } from "../../modules/indicators/coreStubs";
import { computeConfluence } from "../../modules/indicators/confluence";
import { getCandles, isSupportedTimeframe } from "../../modules/indicators/ohlcSource";
import { respondError } from "../../modules/indicators/errors";
import { runAiCore } from "../../modules/simulation/aiCoreRunner";
import { buildNewsConfluenceRows } from "../../modules/news/newsConfluenceRows";
import {
  ALGORITHM_VERSION,
  ALL_CORE_IDS,
  type ConfluenceSignalRow,
  type CoreId,
  type Timeframe
} from "../../modules/indicators/types";

export const confluenceTableRouter = Router();

confluenceTableRouter.get("/confluence-table", async (req, res) => {
  const ticket = String(req.query.ticket ?? "").toUpperCase();
  const timeframeRaw = String(req.query.timeframe ?? "1h");
  const fromRaw = req.query.from ? String(req.query.from) : undefined;
  const toRaw = req.query.to ? String(req.query.to) : undefined;
  const coresRaw = req.query.cores;

  if (!ticket) {
    return respondError(res, 400, "missing_ticket", "El parametro 'ticket' es obligatorio.", "Ejemplo: ?ticket=AAPL");
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
  if (fromRaw && toRaw) {
    const fromTs = Date.parse(fromRaw);
    const toTs = Date.parse(toRaw);
    if (!Number.isFinite(fromTs) || !Number.isFinite(toTs)) {
      return respondError(res, 400, "INVALID_RANGE", "Rango 'from'/'to' invalido.");
    }
    if (fromTs > toTs) {
      return respondError(res, 400, "INVALID_RANGE", "'from' es posterior a 'to'.");
    }
  }

  let coresFilter: CoreId[] | undefined;
  if (coresRaw) {
    const list = Array.isArray(coresRaw) ? coresRaw.map(String) : String(coresRaw).split(",");
    for (const c of list) {
      if (!ALL_CORE_IDS.includes(c as CoreId)) {
        return respondError(res, 400, "INVALID_CORE", `core '${c}' no esta en el enum CoreId.`);
      }
    }
    coresFilter = list as CoreId[];
  }

  const timeframe = timeframeRaw as Timeframe;
  const candles = await getCandles({ symbol: ticket, timeframe, count: 300 });

  if (candles.length === 0) {
    return respondError(res, 404, "symbol_not_found", `No hay datos OHLC para '${ticket}'.`);
  }

  const verdict = computeConfluence(candles, { symbol: ticket, timeframe });
  const latestPrice = candles[candles.length - 1]?.close ?? candles[candles.length - 1]?.open ?? 0;

  let rows: ConfluenceSignalRow[] = [];
  const wantsIndicadores = !coresFilter || coresFilter.includes("A_INDICADORES");
  if (wantsIndicadores) {
    rows = buildIndicatorsTable({ ticket, timeframe, candles });
  }

  const wantsNoticias = !coresFilter || coresFilter.includes("A_NOTICIAS");
  if (wantsNoticias) {
    const newsRows = await buildNewsConfluenceRows({
        ticket,
        timeframe,
        precio: latestPrice,
        sourceInputHash: verdict.source_input_hash,
        now: new Date(),
        limit: 100,
        from: fromRaw,
        to: toRaw
      });
    rows = [...rows, ...newsRows];
  }

  const stubCores = (["A_FUNDAMENTAL", "A_TECNICO", "A_INSTITUCIONAL"] as CoreId[])
    .filter((c) => !coresFilter || coresFilter.includes(c));
  if (stubCores.length > 0) {
    rows = [
      ...rows,
      ...buildCoreStubs({
        ticket,
        timeframe,
        cores: stubCores,
        sourceInputHash: verdict.source_input_hash
      })
    ];
  }

  const wantsIa = !coresFilter || coresFilter.includes("A_IA");
  if (wantsIa) {
    const aiRow = await runAiCore({
      ticket,
      timeframe,
      sourceInputHash: verdict.source_input_hash,
      computedAt: new Date(),
      precalculatedRows: rows
    });
    rows.push(aiRow);
  }

  return res.status(200).json({
    rows,
    generated_at: new Date().toISOString(),
    algorithm_version: ALGORITHM_VERSION,
    ticket,
    timeframe,
    bars_used: candles.length,
    source_input_hash: verdict.source_input_hash
  });
});
