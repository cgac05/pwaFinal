// FIC: Coverage compare route — ranks all 4 strategies using CoverageComparator. (EN)
// FIC: Ruta de comparación de cobertura — rankea las 4 estrategias usando CoverageComparator. (ES)

import { Router, type Request, type Response } from "express";
import { authContextMiddleware } from "../../middleware/authContext";
import { CoverageComparator } from "../../modules/strategies/coverage/coverageComparator";

export const coverageCompareRouter = Router();

const ALLOWED_ROLES = new Set(["analyst", "risk_manager", "trader", "admin"]);

// FIC: POST /api/coverage/compare — compare all 4 strategies and return ranked matrix. (EN)
// FIC: POST /api/coverage/compare — compara las 4 estrategias y retorna la matriz rankeada. (ES)
coverageCompareRouter.post(
  "/compare",
  authContextMiddleware,
  async (req: Request, res: Response) => {
    const role = req.authContext?.role ?? "";
    if (!ALLOWED_ROLES.has(role)) {
      return res.status(403).json({ code: "FORBIDDEN_ROLE" });
    }

    const body = req.body as Record<string, unknown>;

    const comparator = new CoverageComparator();
    const result = await comparator.compare({
      ticker: String(body.ticker ?? "SPY").toUpperCase().trim(),
      currentPrice: Number(body.currentPrice ?? 450),
      shares: body.shares !== undefined ? Number(body.shares) : undefined,
      capital: body.capital !== undefined ? Number(body.capital) : undefined,
      riskTolerancePct: body.riskTolerancePct !== undefined ? Number(body.riskTolerancePct) : undefined,
      putStrikePrice: body.putStrikePrice !== undefined ? Number(body.putStrikePrice) : undefined,
      callStrikePrice: body.callStrikePrice !== undefined ? Number(body.callStrikePrice) : undefined,
      iv: body.iv !== undefined ? Number(body.iv) : undefined,
      dte: body.dte !== undefined ? Number(body.dte) : undefined,
    });

    return res.status(200).json(result);
  }
);
