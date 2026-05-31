// FIC: Coverage analyze route — runs 4 coverage strategies and returns results. (EN)
// FIC: Ruta de análisis de cobertura — ejecuta 4 estrategias de cobertura y retorna resultados. (ES)

import { Router, type Request, type Response } from "express";
import { authContextMiddleware } from "../../middleware/authContext";
import { adaptContractToEngine, adaptResultToResponse } from "../../modules/strategies/coverage/coverageStrategyAdapter";
import { CoverageSimulationEngine } from "../../modules/strategies/coverage/coverageSimulationEngine";
import type { CoverageStrategyContract } from "../../modules/strategies/coverage/coverageStrategyContract";

export const coverageAnalyzeRouter = Router();

const ALLOWED_ROLES = new Set(["analyst", "risk_manager", "trader", "admin"]);

// FIC: Build all 4 coverage strategy contracts from request body with defaults. (EN)
// FIC: Construye los 4 contratos de estrategia de cobertura desde el body con valores predeterminados. (ES)
function buildContracts(body: Record<string, unknown>): CoverageStrategyContract[] {
  const ticker = String(body.ticker ?? "SPY").toUpperCase().trim();
  const currentPrice = Number(body.currentPrice ?? 450);
  const shares = Number(body.shares ?? 100);
  const capital = Number(body.capital ?? currentPrice * shares);
  const riskTolerancePct = Number(body.riskTolerancePct ?? 0.05);
  const putStrikePrice = Number(body.putStrikePrice ?? currentPrice * 0.95);
  const callStrikePrice = Number(body.callStrikePrice ?? currentPrice * 1.05);
  const iv = Number(body.iv ?? 0.25);
  const dte = Number(body.dte ?? 90);

  const kinds: CoverageStrategyContract["kind"][] = [
    "protective_put",
    "married_put",
    "collar_put",
    "covered_straddle",
  ];

  return kinds.map((kind) =>
    adaptContractToEngine({
      kind,
      ticker,
      underlyingPrice: currentPrice,
      shares,
      capital,
      riskTolerancePct,
      putStrikePrice,
      callStrikePrice,
      iv,
      dte,
    })
  );
}

// FIC: POST /api/coverage/analyze — run all 4 strategies and return adapted results. (EN)
// FIC: POST /api/coverage/analyze — ejecuta las 4 estrategias y retorna resultados adaptados. (ES)
coverageAnalyzeRouter.post(
  "/analyze",
  authContextMiddleware,
  async (req: Request, res: Response) => {
    const role = req.authContext?.role ?? "";
    if (!ALLOWED_ROLES.has(role)) {
      return res.status(403).json({ code: "FORBIDDEN_ROLE" });
    }

    const body = req.body as Record<string, unknown>;
    const ticker = body.ticker !== undefined ? String(body.ticker).trim() : null;
    const currentPrice = body.currentPrice !== undefined ? Number(body.currentPrice) : null;
    const shares = body.shares !== undefined ? Number(body.shares) : null;

    if (ticker !== null && ticker.length === 0) {
      return res.status(400).json({ code: "INVALID_TICKER" });
    }
    if (currentPrice !== null && (!isFinite(currentPrice) || currentPrice <= 0)) {
      return res.status(400).json({ code: "INVALID_PRICE" });
    }
    if (shares !== null && (!isFinite(shares) || shares <= 0)) {
      return res.status(400).json({ code: "INVALID_SHARES" });
    }

    const simulationEngine = new CoverageSimulationEngine();
    const contracts = buildContracts(body);

    const settled = await Promise.allSettled(
      contracts.map((contract) => simulationEngine.analyze(contract))
    );

    const results = settled
      .filter((s): s is PromiseFulfilledResult<Awaited<ReturnType<typeof simulationEngine.analyze>>> => s.status === "fulfilled")
      .map((s) => adaptResultToResponse(s.value.strategyResult));

    return res.status(200).json({
      results,
      generatedAt: new Date().toISOString(),
    });
  }
);
