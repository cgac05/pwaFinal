import { Router } from "express";
import { runAiCore } from "../../modules/simulation/aiCoreRunner";
import { respondError } from "../../modules/indicators/errors";
import type { ConfluenceSignalRow } from "../../modules/indicators/types";

export const retryAiRouter = Router();

// POST /api/simulation/retry-ai
// Payload: { ticket, timeframe, sourceInputHash, precalculatedRows }
retryAiRouter.post("/retry-ai", async (req, res) => {
  const body = req.body ?? {} as Record<string, unknown>;
  const ticket = String(body.ticket ?? "").toUpperCase();
  const timeframe = String(body.timeframe ?? "1h");
  const sourceInputHash = String(body.sourceInputHash ?? "");
  const precalculatedRows = Array.isArray(body.precalculatedRows) ? (body.precalculatedRows as ConfluenceSignalRow[]) : undefined;

  if (!ticket) return respondError(res, 400, "missing_ticket", "El campo 'ticket' es obligatorio.");
  if (!sourceInputHash) return respondError(res, 400, "missing_source_input_hash", "El campo 'sourceInputHash' es obligatorio.");
  if (!precalculatedRows) return respondError(res, 400, "missing_precalculated_rows", "El campo 'precalculatedRows' es obligatorio y debe ser un array.");

  try {
    const aiRow = await runAiCore({
      ticket,
      timeframe: timeframe as any,
      sourceInputHash,
      computedAt: new Date(),
      precalculatedRows
    });
    return res.status(200).json(aiRow);
  } catch (err: any) {
    console.error("retry-ai error:", err && err.stack ? err.stack : err);
    return respondError(res, 500, "retry_ai_failed", "Fallo al ejecutar reintento AI.");
  }
});

export default retryAiRouter;
