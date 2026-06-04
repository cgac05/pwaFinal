// FIC: Wheel eligibility route -- read-only screening endpoint for the Wheel modal. (EN)
// FIC: Ruta de elegibilidad Wheel -- endpoint de lectura para el modal Wheel. (ES)

import { Router, type Request, type Response } from "express";
import { authContextMiddleware } from "../../middleware/authContext";
import { createWheelEligibilityService } from "../../modules/strategies/coverage/wheelEligibilityService";

export const wheelEligibilityRouter = Router();

const ALLOWED_ROLES = new Set(["analyst", "risk_manager", "trader", "admin"]);

// FIC: GET /api/coverage/wheel/eligibility?symbol=AAPL -- evaluates only available criteria. (EN)
// FIC: GET /api/coverage/wheel/eligibility?symbol=AAPL -- evalua solo criterios disponibles. (ES)
wheelEligibilityRouter.get(
  "/wheel/eligibility",
  authContextMiddleware,
  async (req: Request, res: Response) => {
    const role = req.authContext?.role ?? "";
    if (!ALLOWED_ROLES.has(role)) {
      return res.status(403).json({ code: "FORBIDDEN_ROLE" });
    }

    const symbol = typeof req.query.symbol === "string"
      ? req.query.symbol.trim().toUpperCase()
      : "";

    if (!symbol) {
      return res.status(400).json({
        code: "INVALID_SYMBOL",
        message: "symbol query param is required",
      });
    }

    try {
      const service = createWheelEligibilityService();
      const result = await service.evaluate(symbol);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({
        code: "WHEEL_ELIGIBILITY_FAILED",
        message: err instanceof Error ? err.message : "Unknown wheel eligibility error",
      });
    }
  }
);
