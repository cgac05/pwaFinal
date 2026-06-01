// FIC: Option expirations route — returns available expiration dates for a symbol. (EN)
// FIC: Ruta de expiraciones de opciones — retorna fechas de expiración disponibles para un símbolo. (ES)
// Data source: Tradier (if TRADIER_API_KEY set) → Yahoo Finance v7 (fallback)
// TODO: replace Yahoo with tradierClient when TRADIER_API_KEY is available

import { Router, type Request, type Response } from "express";
import { authContextMiddleware } from "../../middleware/authContext";
import { fetchYahooExpirations } from "../../modules/institutional/yahooOptionsParser";
import { isTradierConfigured, tradierGet } from "../../modules/market/tradierClient";
import { fetchAlpacaExpirations, isAlpacaOptionsConfigured } from "../../modules/market/alpacaOptionsClient";
import { fetchMarketdataExpirations, isMarketdataConfigured } from "../../modules/market/marketdataClient";
import { fetchCboeChain } from "../../modules/market/cboeOptionsClient";

export const optionExpirationsRouter = Router();

const ALLOWED_ROLES = new Set(["analyst", "risk_manager", "trader", "admin"]);

// FIC: Convert unix timestamp (seconds) to YYYY-MM-DD string. (EN)
function timestampToDate(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

// FIC: Generate next N standard monthly option expiration dates (3rd Friday of each month). (EN)
// FIC: Genera las próximas N fechas estándar de expiración de opciones (3er viernes de cada mes). (ES)
// Used as fallback when real expirations are unavailable (Yahoo blocked, Tradier not configured).
function generateStandardExpirations(count = 12): string[] {
  const results: string[] = [];
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth(); // 0-indexed

  while (results.length < count) {
    // Find 3rd Friday: first day of month, advance to Friday, add 14 days
    const firstOfMonth = new Date(Date.UTC(year, month, 1));
    const dayOfWeek = firstOfMonth.getUTCDay(); // 0=Sun, 5=Fri
    const daysToFirstFriday = (5 - dayOfWeek + 7) % 7;
    const thirdFriday = new Date(Date.UTC(year, month, 1 + daysToFirstFriday + 14));

    if (thirdFriday > now) {
      results.push(thirdFriday.toISOString().slice(0, 10));
    }

    month++;
    if (month > 11) { month = 0; year++; }
  }

  return results;
}

optionExpirationsRouter.get(
  "/expirations",
  authContextMiddleware,
  async (req: Request, res: Response) => {
    const role = req.authContext?.role ?? "";
    if (!ALLOWED_ROLES.has(role)) {
      res.status(403).json({ code: "FORBIDDEN_ROLE" });
      return;
    }

    const symbol = typeof req.query.symbol === "string" ? req.query.symbol.trim().toUpperCase() : "";
    if (!symbol) {
      res.status(400).json({ code: "INVALID_SYMBOL", message: "symbol query param is required" });
      return;
    }

    // FIC: Tradier path — full expirations including weeklies. (EN)
    // FIC: Path Tradier — expiraciones completas incluyendo semanales. (ES)
    if (isTradierConfigured()) {
      try {
        const data = await tradierGet<{ expirations: { date: string | string[] } | null }>(
          "/markets/options/expirations",
          { symbol, includeAllRoots: "true" }
        );
        const dates = data?.expirations?.date;
        const expirations: string[] = dates
          ? Array.isArray(dates) ? dates : [dates]
          : [];

        res.status(200).json({ symbol, expirations });
        return;
      } catch {
        res.status(502).json({ code: "TRADIER_UNAVAILABLE" });
        return;
      }
    }

    // FIC: Yahoo Finance path — expirationDates as unix timestamps → convert to YYYY-MM-DD. (EN)
    // FIC: Path Yahoo Finance — expirationDates como timestamps unix → convertir a YYYY-MM-DD. (ES)
    // FIC: Source 2 — CBOE delayed quotes (free, no auth, real data ~15min delay). (EN)
    // FIC: Fuente 2 — Cotizaciones diferidas CBOE (gratuito, sin auth, datos reales ~15min delay). (ES)
    {
      const cboeChain = await fetchCboeChain(symbol);
      if (cboeChain && cboeChain.expirations.length > 0) {
        res.status(200).json({ symbol, expirations: cboeChain.expirations, source: "cboe" });
        return;
      }
    }

    // FIC: Source 3 — MarketData.app (free, includes Greeks, add MARKETDATA_API_TOKEN to .env). (EN)
    // FIC: Fuente 2 — MarketData.app (gratuito, incluye Greeks, agregar MARKETDATA_API_TOKEN al .env). (ES)
    if (isMarketdataConfigured()) {
      const mdDates = await fetchMarketdataExpirations(symbol);
      if (mdDates) {
        res.status(200).json({ symbol, expirations: mdDates, source: "marketdata" });
        return;
      }
    }

    // FIC: Source 3 — Alpaca options contracts (uses existing ALPACA_API_KEY). (EN)
    // FIC: Fuente 2 — contratos de opciones Alpaca (usa ALPACA_API_KEY existente). (ES)
    if (isAlpacaOptionsConfigured()) {
      const alpacaDates = await fetchAlpacaExpirations(symbol);
      if (alpacaDates) {
        res.status(200).json({ symbol, expirations: alpacaDates, source: "alpaca" });
        return;
      }
    }

    // FIC: Source 3 — Yahoo Finance v7 (often blocked in WSL). (EN)
    // FIC: Fuente 3 — Yahoo Finance v7 (frecuentemente bloqueado en WSL). (ES)
    // TODO: replace Yahoo with tradierClient when TRADIER_API_KEY is available
    const timestamps = await fetchYahooExpirations(symbol);
    const expirations = timestamps
      ? timestamps.map(timestampToDate)
      : generateStandardExpirations(12);

    res.status(200).json({
      symbol,
      expirations,
      source: timestamps ? "yahoo" : "synthetic",
    });
  }
);
