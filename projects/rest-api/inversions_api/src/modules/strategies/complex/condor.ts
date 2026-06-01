// FIC: Condor API route - uses real Alpaca data via shared handler.
// No default portfolio, no hardcoded premiums.
//
// FIC: Ruta API de Condor - usa datos reales de Alpaca via handler compartido.
// Sin portfolio por defecto, sin primas hardcodeadas.

import { Router } from "express";
import { authContextMiddleware } from "../../../middleware/authContext";
import {
  buildStrategyFromChain,
  mapBuildError,
  type StrategyChainRequest,
} from "./strategyFromChainHandler";

export const condorRouter = Router();

condorRouter.post("/condor", authContextMiddleware, async (req, res) => {
  try {
    const body = req.body as StrategyChainRequest;

    if (!body.ticker) {
      res.status(400).json({ error: "ticker es requerido. ticker is required." });
      return;
    }

    if (!body.strikes || body.strikes.length === 0) {
      res.status(400).json({
        error: "Se requieren strikes para construir la estrategia. Strikes are required.",
      });
      return;
    }

    if (body.expiracion && !/^\d{4}-\d{2}-\d{2}$/.test(body.expiracion)) {
      res.status(400).json({
        error: "Formato de fecha invalido. Use YYYY-MM-DD. Invalid date format.",
      });
      return;
    }

    if (!body.portfolio) {
      res.status(400).json({
        error: "portfolio es requerido (valor_portafolio_usd, poder_compra_usd). No hay valor por defecto.",
      });
      return;
    }

    const result = await buildStrategyFromChain("condor", body);

    res.status(200).json({
      strategy_type: "condor",
      ticker: result.ticker,
      expiracion: result.expiracion,
      premiums_used: result.premiums_used,
      validation: result.validation,
      profile: result.profile,
      simulation: result.simulation,
      risk: result.risk,
      report: result.report,
      summary: result.summary,
    });
  } catch (error) {
    const mapped = mapBuildError(error);
    res.status(mapped.statusCode).json(mapped.body);
  }
});
