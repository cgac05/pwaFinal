// FIC: Coverage simulate route — runs Monte Carlo simulation for a protective_put strategy. (EN)
// FIC: Ruta de simulación de cobertura — ejecuta simulación Monte Carlo para una estrategia protective_put. (ES)

import { Router, type Request, type Response } from "express";
import { authContextMiddleware } from "../../middleware/authContext";
import { adaptContractToEngine } from "../../modules/strategies/coverage/coverageStrategyAdapter";
import { CoverageSimulationEngine } from "../../modules/strategies/coverage/coverageSimulationEngine";

export const coverageSimulateRouter = Router();

const ALLOWED_ROLES = new Set(["analyst", "risk_manager", "trader", "admin"]);

// FIC: POST /api/coverage/simulate — simulate a protective_put with user-supplied params. (EN)
// FIC: POST /api/coverage/simulate — simula una protective_put con parámetros del usuario. (ES)
coverageSimulateRouter.post(
  "/simulate",
  authContextMiddleware,
  async (req: Request, res: Response) => {
    const role = req.authContext?.role ?? "";
    if (!ALLOWED_ROLES.has(role)) {
      return res.status(403).json({ code: "FORBIDDEN_ROLE" });
    }

    const body = req.body as Record<string, unknown>;
    const ticker = String(body.ticker ?? "SPY").toUpperCase().trim();
    const currentPrice = Number(body.currentPrice ?? 450);
    const shares = Number(body.shares ?? 100);
    const capital = Number(body.capital ?? currentPrice * shares);
    const riskTolerancePct = Number(body.riskTolerancePct ?? 0.05);
    const putStrikePrice = Number(body.putStrikePrice ?? currentPrice * 0.95);
    const iv = Number(body.iv ?? 0.25);
    const dte = Number(body.dte ?? 90);
    const monteCarloIterations = Number(body.monteCarloIterations ?? 256);

    const contract = adaptContractToEngine({
      kind: "protective_put",
      ticker,
      underlyingPrice: currentPrice,
      shares,
      capital,
      riskTolerancePct,
      putStrikePrice,
      iv,
      dte,
    });

    const engine = new CoverageSimulationEngine(monteCarloIterations);
    const result = await engine.analyze(contract);

    return res.status(200).json(result);
  }
);
