// FIC: Market quotes endpoint — quad fallback: Yahoo Finance → Alpaca → Tradier → deterministic mock. (EN)
// FIC: Endpoint de cotizaciones de mercado — quad fallback: Yahoo Finance → Alpaca → Tradier → mock determinista. (ES)

import { Router } from "express";
import type { Request, Response } from "express";
import { isTradierConfigured, tradierGet } from "../../modules/market/tradierClient";

const YAHOO_CHART_URLS = [
  "https://query1.finance.yahoo.com/v8/finance/chart",
  "https://query2.finance.yahoo.com/v8/finance/chart",
];
const YAHOO_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const YAHOO_QUOTE_TIMEOUT_MS = 5_000;

export const marketQuotesRouter = Router();

interface MarketQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

interface TradierQuote {
  symbol: string;
  last: number | null;
  close: number | null;
  open: number | null;
  change: number | null;
  change_percentage: number | null;
}

interface TradierQuotesResponse {
  quotes: {
    quote: TradierQuote | TradierQuote[];
  };
}

// FIC: Fetch a single quote from Yahoo Finance v8 chart — returns regularMarketPrice + daily change. (EN)
// FIC: Obtiene una cotización de Yahoo Finance v8 chart — devuelve regularMarketPrice + cambio diario. (ES)
async function fetchSingleYahooQuote(symbol: string): Promise<MarketQuote | null> {
  for (const base of YAHOO_CHART_URLS) {
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), YAHOO_QUOTE_TIMEOUT_MS);
    try {
      const url = `${base}/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
      const res = await fetch(url, {
        headers: { "User-Agent": YAHOO_USER_AGENT, Accept: "application/json" },
        signal: ac.signal,
      });
      if (!res.ok) continue;

      const data = (await res.json()) as {
        chart?: {
          result?: Array<{
            meta?: {
              regularMarketPrice?: number;
              chartPreviousClose?: number;
              previousClose?: number;
              regularMarketChange?: number;
              regularMarketChangePercent?: number;
            };
          }>;
          error?: unknown;
        };
      };

      if (data?.chart?.error) continue;
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta?.regularMarketPrice) continue;

      const price = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
      const change = meta.regularMarketChange ?? (price - prevClose);
      const changePercent =
        meta.regularMarketChangePercent ?? (prevClose > 0 ? (change / prevClose) * 100 : 0);

      return {
        symbol,
        price: Number(price.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(3)),
        timestamp: new Date().toISOString(),
      };
    } catch {
      // try next base URL
    } finally {
      clearTimeout(tid);
    }
  }
  return null;
}

async function fetchFromYahoo(symbols: string[]): Promise<MarketQuote[] | null> {
  try {
    const results = await Promise.all(symbols.map(fetchSingleYahooQuote));
    const validCount = results.filter((r) => r !== null && r.price > 0).length;
    if (validCount === 0) return null;
    return symbols.map((sym, i) => results[i] ?? demoPriceForSymbol(sym));
  } catch {
    return null;
  }
}

// FIC: Generate deterministic demo prices seeded by symbol name — last resort only. (EN)
// FIC: Genera precios demo deterministas sembrados por nombre del símbolo — solo último recurso. (ES)
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
    timestamp: new Date().toISOString(),
  };
}

function mapTradierQuote(q: TradierQuote): MarketQuote {
  return {
    symbol: q.symbol,
    price: Number((q.last ?? q.close ?? 0).toFixed(2)),
    change: Number((q.change ?? 0).toFixed(2)),
    changePercent: Number((q.change_percentage ?? 0).toFixed(3)),
    timestamp: new Date().toISOString(),
  };
}

async function fetchFromTradier(symbols: string[]): Promise<MarketQuote[]> {
  const data = await tradierGet<TradierQuotesResponse>("/markets/quotes", {
    symbols: symbols.join(","),
    greeks: "false",
  });

  const raw = data?.quotes?.quote;
  if (!raw) return symbols.map(demoPriceForSymbol);

  const quoteArr: TradierQuote[] = Array.isArray(raw) ? raw : [raw];
  const quoteMap = new Map(quoteArr.map((q) => [q.symbol, q]));

  return symbols.map((sym) => {
    const q = quoteMap.get(sym);
    return q ? mapTradierQuote(q) : demoPriceForSymbol(sym);
  });
}

async function fetchFromAlpaca(
  symbols: string[],
  apiKey: string,
  secretKey: string
): Promise<MarketQuote[] | null> {
  const equitySymbols = symbols.filter((s) => /^[A-Z]{1,5}$/.test(s));
  if (equitySymbols.length === 0) return null;

  try {
    const res = await fetch(
      `https://data.alpaca.markets/v2/stocks/bars/latest?symbols=${equitySymbols.join(",")}&feed=iex`,
      {
        headers: {
          "APCA-API-KEY-ID":     apiKey,
          "APCA-API-SECRET-KEY": secretKey,
          Accept: "application/json",
        },
      }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as { bars?: Record<string, { o: number; h: number; l: number; c: number; v: number }> };
    const barsMap = data.bars ?? {};

    const result: MarketQuote[] = symbols.map((sym) => {
      const bar = barsMap[sym];
      if (!bar) return demoPriceForSymbol(sym);
      const change = bar.c - bar.o;
      return {
        symbol: sym,
        price: Number(bar.c.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: bar.o > 0 ? Number(((change / bar.o) * 100).toFixed(3)) : 0,
        timestamp: new Date().toISOString(),
      };
    });

    return result.some((q) => q.price > 0) ? result : null;
  } catch {
    return null;
  }
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

  const runtimeMode = process.env.RUNTIME_MODE ?? "online";
  if (runtimeMode === "offline") {
    res.status(503).json({ error: "market data unavailable in offline mode" });
    return;
  }

  try {
    let quotes: MarketQuote[];

    // Source 1 — Yahoo Finance
    const yahooResult = await fetchFromYahoo(symbols);
    if (yahooResult) {
      res.status(200).json({ quotes: yahooResult, source: "yahoo" });
      return;
    }

    // Source 2 — Alpaca production keys
    const alpacaApiKey    = process.env.ALPACA_API_KEY    ?? process.env.ALPACA_API_KEY_PAPER;
    const alpacaSecretKey = process.env.ALPACA_SECRET_KEY ?? process.env.ALPACA_SECRET_KEY_PAPER;

    if (alpacaApiKey && alpacaSecretKey) {
      const alpacaResult = await fetchFromAlpaca(symbols, alpacaApiKey, alpacaSecretKey);
      if (alpacaResult) {
        res.status(200).json({ quotes: alpacaResult, source: "alpaca" });
        return;
      }
    }

    // Source 3 — Tradier
    if (isTradierConfigured()) {
      try {
        quotes = await fetchFromTradier(symbols);
        res.status(200).json({ quotes, source: "tradier" });
        return;
      } catch {
        // fall through to mock
      }
    }

    // Source 4 — deterministic mock
    quotes = symbols.map(demoPriceForSymbol);
    res.status(200).json({ quotes, source: "mock" });
  } catch (err) {
    console.error("Market quotes error:", err);
    res.status(200).json({ quotes: symbols.map(demoPriceForSymbol), source: "mock" });
  }
});
