// FIC: Institutional copilot AI route — submit and poll for Gemini-powered analysis. (EN)
// FIC: Ruta IA del copiloto institucional — envío y polling para análisis potenciado por Gemini. (ES)

import { Router, type Request, type Response } from "express";
import { authContextMiddleware } from "../../middleware/authContext";
import {
  InstitutionalCopilotChat,
  inferAIRole,
} from "../../modules/ai/institutionalCopilotChat";
import type { InstitutionalZone } from "../../modules/institutional/institutionalZonesEngine";

export const institutionalCopilotRouter = Router();

// FIC: Singleton copilot chat instance — shared job map across requests. (EN)
// FIC: Instancia singleton del copiloto — mapa de jobs compartido entre requests. (ES)
const copilot = new InstitutionalCopilotChat();

// FIC: POST /api/ai/institutional-chat — submit a question with institutional context. (EN)
// FIC: POST /api/ai/institutional-chat — envía una pregunta con contexto institucional. (ES)
institutionalCopilotRouter.post(
  "/institutional-chat",
  authContextMiddleware,
  async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;

    const ticker = body.ticker !== undefined ? String(body.ticker).trim() : null;
    const currentPrice = body.currentPrice !== undefined ? Number(body.currentPrice) : null;
    const zones = body.zones;
    const question = body.question !== undefined ? String(body.question).trim() : null;

    if (!ticker || ticker.length === 0) {
      return res.status(400).json({ code: "MISSING_TICKER" });
    }
    if (currentPrice === null || !isFinite(currentPrice) || currentPrice <= 0) {
      return res.status(400).json({ code: "MISSING_OR_INVALID_PRICE" });
    }
    if (!Array.isArray(zones) || zones.length === 0) {
      return res.status(400).json({ code: "MISSING_ZONES" });
    }
    if (!question || question.length === 0) {
      return res.status(400).json({ code: "MISSING_QUESTION" });
    }

    const userRole =
      typeof body.userRole === "string"
        ? body.userRole
        : req.authContext?.role;

    try {
      const submitResult = await copilot.submit({
        ticker: ticker.toUpperCase(),
        currentPrice,
        zones: zones as InstitutionalZone[],
        question,
        userRole: typeof userRole === "string" ? userRole : undefined,
        contextId: typeof body.contextId === "string" ? body.contextId : undefined,
      });

      if (submitResult.status === "completed") {
        return res.status(200).json(submitResult.response);
      }

      // FIC: Gemini exceeded 5s window — return 202 with polling URL. (EN)
      // FIC: Gemini superó la ventana de 5s — retorna 202 con URL de polling. (ES)
      return res.status(202).json({
        status: "pending",
        contextId: submitResult.contextId,
        responseId: submitResult.responseId,
        pollingUrl: submitResult.pollingUrl,
        retryAfterSeconds: submitResult.retryAfterSeconds,
      });
    } catch {
      return res.status(500).json({
        code: "INSTITUTIONAL_COPILOT_ERROR",
        ai_unavailable: true,
      });
    }
  }
);

// FIC: GET /api/ai/institutional-chat/poll/:responseId — poll for async copilot result. (EN)
// FIC: GET /api/ai/institutional-chat/poll/:responseId — polling del resultado asíncrono del copiloto. (ES)
institutionalCopilotRouter.get(
  "/institutional-chat/poll/:responseId",
  authContextMiddleware,
  (req: Request, res: Response) => {
    const { responseId } = req.params;
    const pollResult = copilot.poll(responseId);

    if (pollResult.status === "pending") {
      return res.status(202).json({ status: "pending", responseId });
    }

    if (pollResult.status === "error") {
      return res.status(500).json({
        code: "INSTITUTIONAL_COPILOT_ERROR",
        ai_unavailable: pollResult.ai_unavailable ?? true,
      });
    }

    return res.status(200).json(pollResult.response);
  }
);

export { inferAIRole };
