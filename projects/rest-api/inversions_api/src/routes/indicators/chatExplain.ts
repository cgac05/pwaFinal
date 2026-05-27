// FIC: REST endpoint POST /api/chat/explain — explanatory Chat IA (Hansel, TEAM-02).
// FIC: Endpoint REST POST /api/chat/explain — Chat IA explicativo (Hansel, TEAM-02).

import { Router } from "express";
import {
  DeterministicMockExplainer,
  explainSignal,
  type LlmExplainer
} from "../../modules/indicators/chatExplainer";
import { getCandles, isSupportedTimeframe } from "../../modules/indicators/ohlcSource";
import { respondError } from "../../modules/indicators/errors";
import type { Timeframe } from "../../modules/indicators/types";

// FIC: CI uses the deterministic mock; the real provider is deferred to clarify T070.
// FIC: CI usa el mock determinista; el proveedor real queda diferido al clarify T070.
const defaultExplainer: LlmExplainer = new DeterministicMockExplainer();

export function createChatExplainRouter(explainer: LlmExplainer = defaultExplainer): Router {
  const router = Router();

  router.post("/explain", async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const symbol = String(body.symbol ?? "").toUpperCase();
    const timeframeRaw = String(body.timeframe ?? "1h");
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const context = typeof body.context === "string" ? body.context : undefined;

    if (!symbol) {
      return respondError(res, 400, "missing_symbol", "El campo 'symbol' es obligatorio.", "Ejemplo: { \"symbol\": \"AAPL\" }");
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
    if (!question) {
      return respondError(res, 400, "missing_question", "El campo 'question' es obligatorio y no puede estar vacio.");
    }

    const timeframe = timeframeRaw as Timeframe;
    const candles = getCandles({ symbol, timeframe, count: 300 });
    if (candles.length === 0) {
      return respondError(res, 404, "symbol_not_found", `No hay datos OHLC para '${symbol}'.`);
    }

    // FIC: Refusals and explanations both return 200 so the UI renders them uniformly.
    // FIC: Rechazos y explicaciones devuelven 200 para que la UI los muestre de forma uniforme.
    const explanation = await explainSignal(
      { symbol, timeframe, question, context },
      candles,
      { explainer }
    );
    return res.status(200).json(explanation);
  });

  return router;
}

export const chatExplainRouter = createChatExplainRouter();
