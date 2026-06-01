// FIC: Options Chain API route - fetches real options chain data from Alpaca Markets.
// FIC: Ruta API de Options Chain - obtiene datos reales de options chain desde Alpaca Markets.

import { Router } from "express";
import { authContextMiddleware } from "../../../middleware/authContext";
import { createAlpacaOptionsService, type OptionsChain } from "../../../modules/strategies/complex/alpacaOptionsService";

export const optionsChainRouter = Router();

const optionsService = createAlpacaOptionsService();

/**
 * FIC: GET /api/strategies/complex/expirations
 * Returns available expiration dates for a ticker within a relative range (from today).
 *
 * Query params:
 *   - ticker (required): Underlying symbol (e.g., SPY, AAPL, MSFT)
 *   - rangeMonths (required): Number of months forward from today (1, 2, 6, 12)
 *
 * FIC: GET /api/strategies/complex/expirations
 * Devuelve fechas de expiración disponibles para un ticker en un rango relativo (desde hoy).
 *
 * Parámetros de query:
 *   - ticker (requerido): Símbolo subyacente (ej: SPY, AAPL, MSFT)
 *   - rangeMonths (requerido): Número de meses hacia adelante desde hoy (1, 2, 6, 12)
 */
optionsChainRouter.get("/expirations", authContextMiddleware, async (req, res) => {
  try {
    const ticker = (req.query.ticker as string)?.trim().toUpperCase();
    const rangeMonthsStr = req.query.rangeMonths as string | undefined;

    if (!ticker) {
      res.status(400).json({
        error: "Ticker es requerido. Ticker is required.",
        ejemplo: "/api/strategies/complex/expirations?ticker=SPY&rangeMonths=6",
      });
      return;
    }

    if (!rangeMonthsStr) {
      res.status(400).json({
        error: "rangeMonths es requerido. rangeMonths is required.",
        ejemplo: "/api/strategies/complex/expirations?ticker=SPY&rangeMonths=6",
      });
      return;
    }

    const rangeMonths = parseInt(rangeMonthsStr, 10);
    if (isNaN(rangeMonths) || rangeMonths < 1) {
      res.status(400).json({
        error: "rangeMonths debe ser un numero positivo. rangeMonths must be a positive number.",
      });
      return;
    }

    const expiraciones = await optionsService.getExpirations(ticker, rangeMonths);

    res.status(200).json({
      ticker,
      rangeMonths,
      expiraciones,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("No se encontraron expiraciones")) {
      res.status(404).json({
        error: message,
        ticker: (req.query.ticker as string)?.trim().toUpperCase(),
        rangeMonths: parseInt(req.query.rangeMonths as string) || 0,
        expiraciones: [],
      });
      return;
    }

    if (message.includes("401") || message.includes("403")) {
      res.status(502).json({
        error: "Error de autenticacion con Alpaca. Verificar API keys. Alpaca auth error. Check API keys.",
        detalle: message,
      });
      return;
    }

    res.status(500).json({
      error: "Error al obtener expiraciones. Error fetching expirations.",
      detalle: message,
    });
  }
});

/**
 * FIC: GET /api/strategies/complex/options-chain
 * Fetches real options chain data from Alpaca for a given ticker and optional expiration.
 * Returns strikes, bid/ask prices, and Greeks (if available).
 *
 * Query params:
 *   - ticker (required): Underlying symbol (e.g., SPY, AAPL, MSFT)
 *   - expiration (optional): Expiration date in YYYY-MM-DD format (default: nearest active)
 *
 * FIC: GET /api/strategies/complex/options-chain
 * Obtiene datos reales de options chain desde Alpaca para un ticker y vencimiento opcional.
 * Devuelve strikes, precios bid/ask, y Griegas (si están disponibles).
 *
 * Parámetros de query:
 *   - ticker (requerido): Símbolo subyacente (ej: SPY, AAPL, MSFT)
 *   - expiration (opcional): Fecha de vencimiento en formato YYYY-MM-DD (default: la más cercana activa)
 */
optionsChainRouter.get("/options-chain", authContextMiddleware, async (req, res) => {
  try {
    const ticker = (req.query.ticker as string)?.trim().toUpperCase();
    const expiration = (req.query.expiration as string)?.trim() || undefined;

    // FIC: Validate required params
    if (!ticker) {
      res.status(400).json({
        error: "Ticker es requerido. Ticker is required.",
        ejemplo: "/api/strategies/complex/options-chain?ticker=SPY&expiration=2026-06-19",
      });
      return;
    }

    // FIC: Validate expiration format if provided
    if (expiration && !/^\d{4}-\d{2}-\d{2}$/.test(expiration)) {
      res.status(400).json({
        error: "Formato de fecha invalido. Use YYYY-MM-DD. Invalid date format. Use YYYY-MM-DD.",
      });
      return;
    }

    const chain: OptionsChain = await optionsService.getOptionsChain(ticker, expiration);

    // FIC: Check if we got data
    if (chain.entries.length === 0) {
      const msg = expiration
        ? `No se encontraron opciones para ${ticker} con vencimiento ${expiration}. ` +
          `No options found for ${ticker} with expiration ${expiration}.`
        : `No se encontraron opciones activas para ${ticker}. ` +
          `No active options found for ${ticker}.`;

      res.status(404).json({
        error: msg,
        ticker,
        expiracion: expiration ?? "any",
        entries: [],
      });
      return;
    }

    // FIC: Return successful response
    res.status(200).json({
      ticker: chain.ticker,
      expiracion: chain.expiracion,
      total_contratos: chain.entries.length,
      total_calls: chain.grouped.calls.length,
      total_puts: chain.grouped.puts.length,
      resumen: {
        call_strike_min: chain.grouped.calls.length > 0
          ? Math.min(...chain.grouped.calls.map((c) => c.strike))
          : null,
        call_strike_max: chain.grouped.calls.length > 0
          ? Math.max(...chain.grouped.calls.map((c) => c.strike))
          : null,
        put_strike_min: chain.grouped.puts.length > 0
          ? Math.min(...chain.grouped.puts.map((c) => c.strike))
          : null,
        put_strike_max: chain.grouped.puts.length > 0
          ? Math.max(...chain.grouped.puts.map((c) => c.strike))
          : null,
      },
      grouped: chain.grouped,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // FIC: Check for Alpaca auth errors
    if (message.includes("401") || message.includes("403")) {
      res.status(502).json({
        error: "Error de autenticacion con Alpaca. Verificar API keys. Alpaca auth error. Check API keys.",
        detalle: message,
      });
      return;
    }

    res.status(500).json({
      error: "Error al obtener options chain. Error fetching options chain.",
      detalle: message,
    });
  }
});
