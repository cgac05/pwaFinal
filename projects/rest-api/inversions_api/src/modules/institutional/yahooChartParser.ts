// FIC: Yahoo Finance v8 chart parser — real OHLCV data, no authentication required. (EN)
// FIC: Parser de gráfico Yahoo Finance v8 — datos OHLCV reales, sin autenticación requerida. (ES)

import type { InstitutionalSourceObservation, ParseFn } from "./institutionalDataService";

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const YAHOO_CHART_FALLBACK_URL = "https://query2.finance.yahoo.com/v8/finance/chart";
const YAHOO_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const REQUEST_TIMEOUT_MS = 10_000;

export interface RealCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// FIC: Synthetic fallback for when chart fetch fails — low confidence, partial status. (EN)
// FIC: Respaldo sintético cuando el fetch del gráfico falla — baja confianza, estado parcial. (ES)
function chartFallback(ticker: string): InstitutionalSourceObservation {
  const seed = ticker.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const baseVol = 500_000 + seed * 1_000;
  return {
    sourceId: "yahoo_chart",
    confidence: 0.25,
    volume: baseVol,
    status: "partial",
    asOf: new Date().toISOString(),
  };
}

// FIC: Attempt chart fetch from primary URL, fallback to secondary on failure. (EN)
// FIC: Intenta fetch del gráfico desde URL primaria, fallback a secundaria si falla. (ES)
async function fetchChart(
  ticker: string,
  range: string,
  fetchImpl: typeof globalThis.fetch
): Promise<Response | null> {
  for (const baseUrl of [YAHOO_CHART_URL, YAHOO_CHART_FALLBACK_URL]) {
    try {
      const url = `${baseUrl}/${encodeURIComponent(ticker)}?interval=1d&range=${range}&events=div%2Csplit`;
      const ac = new AbortController();
      const tid = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetchImpl(url, {
          headers: {
            "User-Agent": YAHOO_USER_AGENT,
            Accept: "application/json",
          },
          signal: ac.signal,
        });
        if (res.ok) return res;
      } finally {
        clearTimeout(tid);
      }
    } catch {
      // try next URL
    }
  }
  return null;
}

// FIC: Real Yahoo Finance chart parser — fetches 6-month daily OHLCV, no crumb needed. (EN)
// FIC: Parser real de gráfico Yahoo Finance — obtiene OHLCV diario 6 meses, sin crumb. (ES)
export const parseYahooChart: ParseFn = async (ticker, period, fetchImpl) => {
  // FIC: Always use 1y to ensure enough candles for SMA200 (252 trading days). (EN)
  // FIC: Siempre usa 1y para tener suficientes velas para SMA200 (252 días hábiles). (ES)
  const range = period === "quarterly" ? "2y" : "1y";

  try {
    const res = await fetchChart(ticker, range, fetchImpl);
    if (!res) return chartFallback(ticker);

    const data = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            regularMarketVolume?: number;
            currency?: string;
          };
          timestamp?: number[];
          indicators?: {
            quote?: Array<{
              open?: (number | null)[];
              high?: (number | null)[];
              low?: (number | null)[];
              close?: (number | null)[];
              volume?: (number | null)[];
            }>;
          };
        }>;
        error?: unknown;
      };
    };

    const result = data?.chart?.result?.[0];
    if (!result || data?.chart?.error) return chartFallback(ticker);

    const meta = result.meta ?? {};
    const timestamps = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0];
    if (!quote || timestamps.length === 0) return chartFallback(ticker);

    const opens = quote.open ?? [];
    const highs = quote.high ?? [];
    const lows = quote.low ?? [];
    const closes = quote.close ?? [];
    const volumes = quote.volume ?? [];

    // FIC: Filter out null/undefined entries — Yahoo sometimes sends null for non-trading days. (EN)
    // FIC: Filtrar entradas null/undefined — Yahoo a veces envía null para días no hábiles. (ES)
    const candles: RealCandle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const o = opens[i], h = highs[i], l = lows[i], c = closes[i], v = volumes[i];
      if (o != null && h != null && l != null && c != null && v != null &&
          isFinite(o) && isFinite(h) && isFinite(l) && isFinite(c) && isFinite(v)) {
        candles.push({ open: o, high: h, low: l, close: c, volume: v });
      }
    }

    if (candles.length < 10) return chartFallback(ticker);

    const avgVolume = candles.reduce((s, c) => s + c.volume, 0) / candles.length;
    const currentPrice = meta.regularMarketPrice ?? candles[candles.length - 1].close;
    const liquidity = avgVolume >= 5_000_000 ? "high" : avgVolume >= 1_000_000 ? "medium" : "low";

    // FIC: Confidence: based on candle count and data completeness. (EN)
    // FIC: Confianza: basada en cantidad de velas y completitud de datos. (ES)
    const confidence = Math.min(0.92, 0.60 + (candles.length / 252) * 0.32);

    // FIC: Estimate flows from average volume — 60% long bias as baseline. (EN)
    // FIC: Estima flujos desde volumen promedio — sesgo largo 60% como base. (ES)
    // FIC: Express flows in millions of dollars for consistent scale across sources. (EN)
    // FIC: Expresa los flujos en millones de dólares para escala consistente entre fuentes. (ES)
    const inflows  = Math.round((avgVolume * currentPrice * 0.60) / 1_000_000);
    const outflows = Math.round((avgVolume * currentPrice * 0.40) / 1_000_000);

    return {
      sourceId: "yahoo_chart",
      confidence,
      volume: avgVolume,
      flows: { inflows, outflows, asOf: new Date().toISOString() },
      liquidity,
      status: "ok",
      asOf: new Date().toISOString(),
      rawSourceData: {
        candles,
        currentPrice,
        candleCount: candles.length,
        avgVolume,
        range,
      },
    };
  } catch {
    return chartFallback(ticker);
  }
};

// FIC: OHLC candle shape used by the SuperChart route — includes unix timestamp. (EN)
// FIC: Shape de vela OHLC usada por la ruta SuperChart — incluye timestamp unix. (ES)
export interface OhlcCandle {
  time: number;  // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// FIC: Map timeframe string from frontend to Yahoo Finance interval and range params. (EN)
// FIC: Mapea string de timeframe del frontend a parámetros interval y range de Yahoo Finance. (ES)
// Yahoo hard limits: 1m→7d, 5m/15m→60d, 60m→730d, 1d/1wk/1mo→max
function timeframeToYahooParams(timeframe: string): { interval: string; range: string } {
  switch (timeframe) {
    case "1m":  return { interval: "1m",  range: "7d" };
    case "5m":  return { interval: "5m",  range: "60d" };
    case "15m": return { interval: "15m", range: "60d" };
    case "1h":  return { interval: "60m", range: "730d" };
    case "4h":  return { interval: "60m", range: "730d" }; // Yahoo has no 4h — use 60m
    case "1w":  return { interval: "1wk", range: "max" };
    case "1M":  return { interval: "1mo", range: "max" };
    default:    return { interval: "1d",  range: "5y" };   // 1d default — ~1 260 trading days
  }
}

// FIC: Map a requested date range (days back) to the closest Yahoo range string. (EN)
// FIC: Mapea un rango solicitado (días hacia atrás) al string de range de Yahoo más cercano. (ES)
function daysToYahooRange(daysBack: number, interval: string): string {
  // Enforce Yahoo API hard limits per interval
  if (interval === "1m")  return "7d";
  if (interval === "5m" || interval === "15m") return daysBack <= 30 ? "1mo" : "60d";
  if (interval === "60m") return daysBack <= 365 ? "1y" : "730d";
  // For daily/weekly/monthly — map freely
  if (daysBack <= 5)    return "5d";
  if (daysBack <= 35)   return "1mo";
  if (daysBack <= 95)   return "3mo";
  if (daysBack <= 200)  return "6mo";
  if (daysBack <= 400)  return "1y";
  if (daysBack <= 800)  return "2y";
  if (daysBack <= 1900) return "5y";
  return "max";
}

// FIC: Fetch real OHLCV candles from Yahoo Finance v8 chart API, mapped to OhlcCandle[]. (EN)
// FIC: Obtiene velas OHLCV reales de la API v8 chart de Yahoo Finance, mapeadas a OhlcCandle[]. (ES)
// Returns null on network failure so the caller can fall back gracefully.
export async function fetchYahooOhlc(
  symbol: string,
  timeframe: string,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
  startDateIso?: string
): Promise<OhlcCandle[] | null> {
  const { interval, range: defaultRange } = timeframeToYahooParams(timeframe);
  const range = startDateIso
    ? daysToYahooRange(
        Math.max(1, Math.round((Date.now() - new Date(startDateIso).getTime()) / 86_400_000)),
        interval
      )
    : defaultRange;

  const res = await fetchChart(symbol, range, fetchImpl).catch(() => null);
  // Override the hardcoded interval=1d in fetchChart by re-fetching with the right interval
  // fetchChart always uses interval=1d — we need to fetch directly for intraday
  if (!res && interval !== "1d") return null;

  // For intervals other than 1d, fetch directly with the right interval
  let chartRes: Response | null = null;
  if (interval === "1d") {
    chartRes = res;
  } else {
    for (const baseUrl of [YAHOO_CHART_URL, YAHOO_CHART_FALLBACK_URL]) {
      try {
        const url = `${baseUrl}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
        const ac = new AbortController();
        const tid = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
        try {
          const r = await fetchImpl(url, {
            headers: { "User-Agent": YAHOO_USER_AGENT, Accept: "application/json" },
            signal: ac.signal,
          });
          if (r.ok) { chartRes = r; break; }
        } finally {
          clearTimeout(tid);
        }
      } catch { /* try next */ }
    }
    if (!chartRes) return null;
  }

  if (!chartRes) return null;

  try {
    const data = (await chartRes.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: {
            quote?: Array<{
              open?: (number | null)[];
              high?: (number | null)[];
              low?: (number | null)[];
              close?: (number | null)[];
              volume?: (number | null)[];
            }>;
          };
        }>;
        error?: unknown;
      };
    };

    const result = data?.chart?.result?.[0];
    if (!result || data?.chart?.error) return null;

    const timestamps = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0];
    if (!quote || timestamps.length === 0) return null;

    const opens   = quote.open   ?? [];
    const highs   = quote.high   ?? [];
    const lows    = quote.low    ?? [];
    const closes  = quote.close  ?? [];
    const volumes = quote.volume ?? [];

    const candles: OhlcCandle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const o = opens[i], h = highs[i], l = lows[i], c = closes[i], v = volumes[i];
      if (o != null && h != null && l != null && c != null && v != null &&
          isFinite(o) && isFinite(h) && isFinite(l) && isFinite(c) && isFinite(v)) {
        candles.push({ time: timestamps[i], open: o, high: h, low: l, close: c, volume: v });
      }
    }

    return candles.length >= 2 ? candles : null;
  } catch {
    return null;
  }
}
