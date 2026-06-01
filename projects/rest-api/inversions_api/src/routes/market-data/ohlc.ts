// FIC: OHLC market data route — fetches real historical prices from Yahoo Finance.
// Falls back to deterministic mock candles if Yahoo is unavailable.

import { Router } from "express";

const YAHOO_BASE = "https://query1.finance.yahoo.com";
const YAHOO_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; inversions-app/1.0)",
  Accept: "application/json"
};

function intervalMs(timeframe: string): number {
  switch (timeframe) {
    case "1m":  return 60_000;
    case "5m":  return 300_000;
    case "15m": return 900_000;
    case "1h":  return 3_600_000;
    case "4h":  return 14_400_000;
    case "1w":  return 604_800_000;
    case "1M":  return 2_592_000_000;
    default:    return 86_400_000; // 1d
  }
}

/** Map timeframe string to Yahoo Finance range + interval params. */
function yahooParams(timeframe: string): { range: string; interval: string } {
  switch (timeframe) {
    case "1m":  return { range: "1d",  interval: "1m" };
    case "5m":  return { range: "5d",  interval: "5m" };
    case "15m": return { range: "5d",  interval: "15m" };
    case "1h":  return { range: "1mo", interval: "60m" };
    case "4h":  return { range: "3mo", interval: "60m" }; // Yahoo max is 60m; aggregate client-side if needed
    case "1w":  return { range: "5y",  interval: "1wk" };
    case "1M":  return { range: "10y", interval: "1mo" };
    default:    return { range: "1y",  interval: "1d" };
  }
}

function mockCandles(symbol: string, timeframe: string, count = 300) {
  const step = intervalMs(timeframe);
  const now = Date.now();
  return Array.from({ length: count }).map((_, index) => {
    const t = now - (count - index) * step;
    const base = 100 + Math.sin(index / 12) * 8 + (symbol.charCodeAt(0) % 7);
    const open  = Number((base + Math.sin(index / 3)).toFixed(2));
    const close = Number((base + Math.cos(index / 4)).toFixed(2));
    const high  = Number((Math.max(open, close) + 0.8).toFixed(2));
    const low   = Number((Math.min(open, close) - 0.8).toFixed(2));
    return { time: Math.floor(t / 1000), open, high, low, close, volume: Math.round(1000 + Math.abs(Math.sin(index)) * 3000) };
  });
}

async function fetchYahooOhlc(symbol: string, timeframe: string) {
  const { range, interval } = yahooParams(timeframe);
  const url = `${YAHOO_BASE}/v8/finance/chart/${symbol}?range=${range}&interval=${interval}&includeAdjustedClose=true`;

  const res = await fetch(url, { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;

  const json = await res.json() as any;
  const result = json?.chart?.result?.[0];
  if (!result) return null;

  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  const adjClose: number[] = result.indicators?.adjclose?.[0]?.adjclose ?? quote?.close ?? [];

  if (!timestamps.length || !quote) return null;

  const candles = timestamps
    .map((t, i) => {
      const open  = quote.open?.[i];
      const high  = quote.high?.[i];
      const low   = quote.low?.[i];
      const close = adjClose[i] ?? quote.close?.[i];
      const volume = quote.volume?.[i] ?? 0;
      if (open == null || high == null || low == null || close == null) return null;
      return {
        time: t,
        open:   Number(open.toFixed(2)),
        high:   Number(high.toFixed(2)),
        low:    Number(low.toFixed(2)),
        close:  Number(close.toFixed(2)),
        volume: Math.round(volume)
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return candles;
}

export const marketDataOhlcRouter = Router();

marketDataOhlcRouter.get("/ohlc", async (req, res) => {
  const symbol    = String(req.query.symbol   ?? "SPY").toUpperCase();
  const timeframe = String(req.query.timeframe ?? "1d");

  try {
    const candles = await fetchYahooOhlc(symbol, timeframe);

    if (candles && candles.length > 0) {
      // FIC: source label MUST match the frontend badge map ("yahoo" | "tradier" | "mock"). (EN)
      // FIC: la etiqueta source DEBE coincidir con el mapa de badges del front. (ES)
      return res.status(200).json({ symbol, timeframe, candles, source: "yahoo" });
    }
  } catch (err) {
    console.warn(`[ohlc] Yahoo fetch failed for ${symbol}:`, err);
  }

  // Fallback: deterministic mock
  const candles = mockCandles(symbol, timeframe);
  return res.status(200).json({ symbol, timeframe, candles, source: "mock" });
});
