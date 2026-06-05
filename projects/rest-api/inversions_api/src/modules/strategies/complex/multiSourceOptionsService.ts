import { isTradierConfigured, tradierGet } from "../../market/tradierClient";
import { fetchCboeChain, filterByExpiration } from "../../market/cboeOptionsClient";
import { fetchMarketdataOptionChain, isMarketdataConfigured } from "../../market/marketdataClient";
import { fetchAlpacaOptionChain, isAlpacaOptionsConfigured } from "../../market/alpacaOptionsClient";
import { fetchYahooOptionChain } from "../../institutional/yahooOptionsParser";
import type { OptionsChain, OptionChainEntry } from "./alpacaOptionsService";

function dateToTimestamp(dateStr: string): number {
  return Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
}

function toOptionChain(
  ticker: string,
  expiration: string,
  entries: OptionChainEntry[],
  subyacente_precio: number | null
): OptionsChain {
  const calls = entries.filter((e) => e.tipo === "call");
  const puts = entries.filter((e) => e.tipo === "put");
  return {
    ticker: ticker.toUpperCase(),
    expiracion: expiration,
    subyacente_precio,
    entries,
    grouped: { calls, puts },
  };
}

async function tryFromTradier(ticker: string, expiration: string): Promise<OptionsChain | null> {
  if (!isTradierConfigured()) return null;
  try {
    interface TradierContract {
      symbol: string;
      strike: number;
      bid: number;
      ask: number;
      last: number;
      volume: number;
      open_interest: number;
      implied_volatility: number;
      option_type: "call" | "put";
      greeks?: { delta?: number; gamma?: number; theta?: number; vega?: number; smv_vol?: number };
    }

    interface TradierChainResponse {
      options: { option: TradierContract | TradierContract[] } | null;
    }

    let underlyingPrice = 0;
    try {
      const qData = await tradierGet<{ quotes: { quote: { last?: number } } }>(
        "/markets/quotes",
        { symbols: ticker, greeks: "false" }
      );
      underlyingPrice = qData?.quotes?.quote?.last ?? 0;
    } catch { /* non-fatal */ }

    const data = await tradierGet<TradierChainResponse>("/markets/options/chains", {
      symbol: ticker,
      expiration,
      greeks: "true",
    });

    const raw = data?.options?.option;
    const contracts: TradierContract[] = raw
      ? Array.isArray(raw) ? raw : [raw]
      : [];

    if (contracts.length === 0) return null;

    const entries: OptionChainEntry[] = contracts.map((c) => {
      const bid = c.bid ?? 0;
      const ask = c.ask ?? 0;
      const mid = bid > 0 && ask > 0 ? Math.round(((bid + ask) / 2) * 100) / 100 : null;

      let greeks: OptionChainEntry["greeks"] | undefined;
      if (c.greeks) {
        greeks = {
          delta: c.greeks.delta ?? 0,
          gamma: c.greeks.gamma ?? 0,
          theta: c.greeks.theta ?? 0,
          vega: c.greeks.vega ?? 0,
          implied_volatility: c.greeks.smv_vol ?? c.implied_volatility ?? 0,
        };
      }

      return {
        symbol: c.symbol || `${ticker}${expiration.replace(/-/g, "")}${c.option_type === "call" ? "C" : "P"}${String(Math.round(c.strike * 1000)).padStart(8, "0")}`,
        strike: c.strike,
        tipo: c.option_type,
        expiracion: expiration,
        bid,
        ask,
        mid,
        estilo: "americana",
        tradable: true,
        greeks,
      };
    });

    return toOptionChain(ticker, expiration, entries, underlyingPrice > 0 ? underlyingPrice : null);
  } catch {
    return null;
  }
}

async function tryFromCboe(ticker: string, expiration: string): Promise<OptionsChain | null> {
  try {
    const cboeChain = await fetchCboeChain(ticker);
    if (!cboeChain) return null;

    const filtered = filterByExpiration(cboeChain, expiration);
    if (filtered.length === 0) return null;

    const entries: OptionChainEntry[] = filtered.map((c) => {
      const bid = c.bid ?? 0;
      const ask = c.ask ?? 0;
      const mid = bid > 0 && ask > 0 ? Math.round(((bid + ask) / 2) * 100) / 100 : null;

      return {
        symbol: c.contractSymbol,
        strike: c.strike,
        tipo: c.type,
        expiracion: expiration,
        bid,
        ask,
        mid,
        estilo: "americana",
        tradable: true,
        greeks: {
          delta: c.delta,
          gamma: c.gamma,
          theta: c.theta,
          vega: c.vega,
          implied_volatility: c.iv,
        },
      };
    });

    return toOptionChain(ticker, expiration, entries, cboeChain.underlyingPrice > 0 ? cboeChain.underlyingPrice : null);
  } catch {
    return null;
  }
}

async function tryFromMarketdata(ticker: string, expiration: string): Promise<OptionsChain | null> {
  if (!isMarketdataConfigured()) return null;
  try {
    const mdData = await fetchMarketdataOptionChain(ticker, expiration);
    if (!mdData || mdData.rows.length === 0) return null;

    const underlyingPrice = mdData.underlyingPrice ?? 0;

    const entries: OptionChainEntry[] = mdData.rows.map((r) => {
      const bid = r.bid ?? 0;
      const ask = r.ask ?? 0;
      const mid = bid > 0 && ask > 0 ? Math.round(((bid + ask) / 2) * 100) / 100 : null;

      return {
        symbol: r.contractSymbol,
        strike: r.strike,
        tipo: r.type,
        expiracion: expiration,
        bid,
        ask,
        mid,
        estilo: "americana",
        tradable: true,
        greeks: {
          delta: r.delta,
          gamma: r.gamma,
          theta: r.theta,
          vega: r.vega,
          implied_volatility: r.impliedVolatility,
        },
      };
    });

    return toOptionChain(ticker, expiration, entries, underlyingPrice > 0 ? underlyingPrice : null);
  } catch {
    return null;
  }
}

async function tryFromAlpaca(ticker: string, expiration: string): Promise<OptionsChain | null> {
  if (!isAlpacaOptionsConfigured()) return null;
  try {
    const alpacaRows = await fetchAlpacaOptionChain(ticker, expiration);
    if (!alpacaRows || alpacaRows.length === 0) return null;

    let underlyingPrice = 0;
    try {
      const qRes = await fetch(
        `https://data.alpaca.markets/v2/stocks/${ticker}/quotes/latest`,
        {
          headers: {
            "APCA-API-KEY-ID": process.env.ALPACA_API_KEY ?? "",
            "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET_KEY ?? "",
            Accept: "application/json",
          },
        }
      );
      if (qRes.ok) {
        const qData = (await qRes.json()) as { quote?: { ap?: number; bp?: number } };
        const ap = qData?.quote?.ap ?? 0;
        const bp = qData?.quote?.bp ?? 0;
        underlyingPrice = ap > 0 && bp > 0 ? (ap + bp) / 2 : ap || bp;
      }
    } catch { /* use 0 */ }

    const entries: OptionChainEntry[] = alpacaRows.map((r) => {
      const bid = r.bid ?? 0;
      const ask = r.ask ?? 0;
      const mid = bid > 0 && ask > 0 ? Math.round(((bid + ask) / 2) * 100) / 100 : null;

      return {
        symbol: r.contractSymbol,
        strike: r.strike,
        tipo: r.type,
        expiracion: expiration,
        bid,
        ask,
        mid,
        estilo: "americana",
        tradable: true,
        greeks: undefined,
      };
    });

    return toOptionChain(ticker, expiration, entries, underlyingPrice > 0 ? underlyingPrice : null);
  } catch {
    return null;
  }
}

async function tryFromYahoo(ticker: string, expiration: string): Promise<OptionsChain | null> {
  try {
    const expirationTs = dateToTimestamp(expiration);
    const chainData = await fetchYahooOptionChain(ticker, expirationTs);
    if (!chainData) return null;

    const entries: OptionChainEntry[] = [];
    for (const c of chainData.calls) {
      const bid = c.bid ?? 0;
      const ask = c.ask ?? 0;
      const mid = bid > 0 && ask > 0 ? Math.round(((bid + ask) / 2) * 100) / 100 : null;
      entries.push({
        symbol: c.contractSymbol,
        strike: c.strike,
        tipo: "call",
        expiracion: expiration,
        bid,
        ask,
        mid,
        estilo: "americana",
        tradable: true,
        greeks: undefined,
      });
    }
    for (const p of chainData.puts) {
      const bid = p.bid ?? 0;
      const ask = p.ask ?? 0;
      const mid = bid > 0 && ask > 0 ? Math.round(((bid + ask) / 2) * 100) / 100 : null;
      entries.push({
        symbol: p.contractSymbol,
        strike: p.strike,
        tipo: "put",
        expiracion: expiration,
        bid,
        ask,
        mid,
        estilo: "americana",
        tradable: true,
        greeks: undefined,
      });
    }

    if (entries.length === 0) return null;

    return toOptionChain(ticker, expiration, entries, chainData.underlyingPrice > 0 ? chainData.underlyingPrice : null);
  } catch {
    return null;
  }
}

async function findNearestExpiration(ticker: string): Promise<string | null> {
  if (isTradierConfigured()) {
    try {
      const expData = await tradierGet<{ expirations: { date: string | string[] } | null }>(
        "/markets/options/expirations",
        { symbol: ticker, includeAllRoots: "true" }
      );
      const dates = expData?.expirations?.date;
      const expirations: string[] = dates ? (Array.isArray(dates) ? dates : [dates]) : [];
      if (expirations.length > 0) return expirations[0];
    } catch { /* fall through */ }
  }

  const cboeChain = await fetchCboeChain(ticker);
  if (cboeChain && cboeChain.expirations.length > 0) {
    return cboeChain.expirations[0];
  }

  return null;
}

export async function getMultiSourceOptionsChain(
  ticker: string,
  expiration?: string
): Promise<OptionsChain> {
  const cleanTicker = ticker.trim().toUpperCase();
  let cleanExpiration = expiration?.trim() || "";

  if (!cleanExpiration) {
    const nearest = await findNearestExpiration(cleanTicker);
    if (!nearest) {
      throw new Error(
        `No options found for ${cleanTicker}. No hay opciones disponibles para ${cleanTicker}.`
      );
    }
    cleanExpiration = nearest;
  }

  // FIC: Try each source in priority order: Tradier → CBOE → MarketData → Alpaca → Yahoo
  // Same cascade as the /api/options/chain route for consistency.

  const tradier = await tryFromTradier(cleanTicker, cleanExpiration);
  if (tradier) return tradier;

  const cboe = await tryFromCboe(cleanTicker, cleanExpiration);
  if (cboe) return cboe;

  const md = await tryFromMarketdata(cleanTicker, cleanExpiration);
  if (md) return md;

  const alpaca = await tryFromAlpaca(cleanTicker, cleanExpiration);
  if (alpaca) return alpaca;

  const yahoo = await tryFromYahoo(cleanTicker, cleanExpiration);
  if (yahoo) return yahoo;

  throw new Error(
    `No options found for ${cleanTicker} expiration ${cleanExpiration}. ` +
    `No se encontraron opciones para ${cleanTicker} expiración ${cleanExpiration}.`
  );
}
