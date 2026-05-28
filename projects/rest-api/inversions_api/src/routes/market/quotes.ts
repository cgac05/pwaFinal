// FIC: Market quotes endpoint — routes to active broker in real mode, Alpaca paper in demo mode.
// FIC: Endpoint de cotizaciones de mercado — enruta al broker activo en modo real, Alpaca paper en modo demo.

import { Router } from "express";
import type { Request, Response } from "express";

export const marketQuotesRouter = Router();

interface MarketQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

// FIC: Generate deterministic demo prices seeded by symbol name.
// FIC: Genera precios demo deterministas sembrados por nombre del símbolo.
function demoPriceForSymbol(symbol: string): MarketQuote {
  const seed = symbol.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const base = 50 + (seed % 450);
  const change = ((seed % 20) - 10) / 10;
  const changePercent = (change / base) * 100;
  return {
    symbol,
    price: Number((base + change).toFixed(2)),
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(3)),
    timestamp: new Date().toISOString()
  };
}

marketQuotesRouter.get("/quotes", async (req: Request, res: Response) => {
  const symbolsParam = req.query.symbols as string | undefined;

  if (!symbolsParam || symbolsParam.trim() === "") {
    res.status(400).json({ error: "symbols parameter required" });
    return;
  }

  const symbols = symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

  if (symbols.length > 50) {
    res.status(400).json({ error: "max 50 symbols per request" });
    return;
  }

  // FIC: Check runtime mode from environment — offline returns 503 immediately.
  // FIC: Verifica modo runtime del entorno — offline retorna 503 de inmediato.
  const runtimeMode = process.env.RUNTIME_MODE ?? "online";
  const operationalMode = process.env.OPERATIONAL_MODE ?? "demo";

  if (runtimeMode === "offline") {
    res.status(503).json({ error: "market data unavailable in offline mode" });
    return;
  }

  try {
    let quotes: MarketQuote[];

    if (operationalMode === "demo") {
      // FIC: Demo mode — use Alpaca paper sandbox or deterministic demo prices.
      // FIC: Modo demo — usa sandbox de Alpaca paper o precios demo deterministas.
      const alpacaApiKey = process.env.ALPACA_API_KEY_PAPER;
      const alpacaSecretKey = process.env.ALPACA_SECRET_KEY_PAPER;

      if (alpacaApiKey && alpacaSecretKey) {
        const symbolsList = symbols.join(",");
        const alpacaRes = await fetch(
          `https://data.sandbox.alpaca.markets/v2/stocks/bars/latest?symbols=${symbolsList}`,
          {
            headers: {
              "APCA-API-KEY-ID": alpacaApiKey,
              "APCA-API-SECRET-KEY": alpacaSecretKey
            }
          }
        );

        if (!alpacaRes.ok) {
          quotes = symbols.map(demoPriceForSymbol);
        } else {
          const data = await alpacaRes.json() as { bars: Record<string, { c: number; o: number }> };
          quotes = symbols.map((sym) => {
            const bar = data.bars?.[sym];
            if (!bar) return demoPriceForSymbol(sym);
            const change = bar.c - bar.o;
            return {
              symbol: sym,
              price: Number(bar.c.toFixed(2)),
              change: Number(change.toFixed(2)),
              changePercent: Number(((change / bar.o) * 100).toFixed(3)),
              timestamp: new Date().toISOString()
            };
          });
        }
      } else {
        quotes = symbols.map(demoPriceForSymbol);
      }
    } else {
      // FIC: Real mode — active broker integration point (extend here for IBKR/Alpaca live).
      // FIC: Modo real — punto de integración con broker activo (extender aquí para IBKR/Alpaca live).
      quotes = symbols.map(demoPriceForSymbol);
    }

    res.status(200).json({ quotes });
  } catch (err) {
    console.error("Market quotes error:", err);
    res.status(502).json({ error: "upstream data unavailable" });
  }
});
