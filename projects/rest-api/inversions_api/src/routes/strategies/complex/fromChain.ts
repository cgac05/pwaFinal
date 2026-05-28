// FIC: From-Chain API route - delegates to shared handler for real Alpaca data.
// Accepts strategy_type to select which engine to use.
//
// FIC: Ruta API From-Chain - delega al handler compartido para datos reales de Alpaca.
// Acepta strategy_type para seleccionar qué motor usar.

import { Router } from "express";
import { authContextMiddleware } from "../../../middleware/authContext";
import {
  buildStrategyFromChain,
  mapBuildError,
  type SupportedStrategy,
  type StrategyChainRequest,
} from "./strategyFromChainHandler";

export const fromChainRouter = Router();

fromChainRouter.post("/from-chain", authContextMiddleware, async (req, res) => {
  try {
    const body = req.body as StrategyChainRequest & { strategy_type?: SupportedStrategy };

    // ── Validate strategy_type ──
    if (!body.strategy_type) {
      res.status(400).json({
        error: "strategy_type es requerido. strategy_type is required.",
        opciones: ["iron_condor", "iron_butterfly", "butterfly_spread", "condor"],
      });
      return;
    }

    const supported: SupportedStrategy[] = ["iron_condor", "iron_butterfly", "butterfly_spread", "condor"];
    if (!supported.includes(body.strategy_type)) {
      res.status(400).json({
        error: `Tipo de estrategia no soportado: ${body.strategy_type}. Unsupported strategy type.`,
        opciones: supported,
      });
      return;
    }

    // ── Validate common fields ──
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

    // ── Delegate to shared handler ──
    const result = await buildStrategyFromChain(body.strategy_type, {
      ticker: body.ticker,
      expiracion: body.expiracion,
      strikes: body.strikes,
      contratos: body.contratos,
      tipo_ala: body.tipo_ala,
      tolerancia_riesgo: body.tolerancia_riesgo,
      estilo_opcion: body.estilo_opcion,
      dias_vencimiento: body.dias_vencimiento,
      portfolio: body.portfolio,
    });

    res.status(200).json({
      strategy_type: body.strategy_type,
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
