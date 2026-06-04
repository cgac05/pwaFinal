// FIC: Option chain resolution service — resolves real premiums + IV for coverage analysis. (EN)
// FIC: Servicio de resolución de cadena de opciones — resuelve primas + IV reales para análisis de cobertura. (ES)
// Sources tried in order: CBOE (free, greeks) → Tradier → Yahoo Finance v7.
// Used by /api/coverage/analyze to enrich contracts when frontend doesn't send chain data.

import { fetchCboeChain, filterByExpiration } from "./cboeOptionsClient";
import {
  fetchYahooOptionChain,
  fetchYahooExpirations,
} from "../institutional/yahooOptionsParser";
import { isTradierConfigured, tradierGet } from "./tradierClient";

export interface ResolvedOptionContext {
  underlyingPrice: number;
  expirationDate: string;
  dte: number;
  putPremium: number;
  callPremium: number;
  // Representative IV: average of the two selected strikes (or whichever is available).
  iv: number;
}

// FIC: Find the row whose strike is closest to the target. (EN)
function closestStrike<T extends { strike: number }>(rows: T[], target: number): T | undefined {
  if (rows.length === 0) return undefined;
  return rows.reduce((best, r) =>
    Math.abs(r.strike - target) < Math.abs(best.strike - target) ? r : best
  );
}

// FIC: Pick the expiration date closest to targetDte days out (minimum 7 days). (EN)
function pickBestExpiration(dates: string[], targetDte: number): string | null {
  const now = Date.now();
  const candidates = dates
    .map((d) => {
      const ms = new Date(`${d}T16:00:00Z`).getTime() - now;
      const dte = ms / 86_400_000;
      return { date: d, dte, diff: Math.abs(dte - targetDte) };
    })
    .filter((d) => d.dte >= 7);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.diff - b.diff);
  return candidates[0].date;
}

function midOrLast(bid: number, ask: number, last: number): number {
  return bid > 0 && ask > 0 ? (bid + ask) / 2 : last || 0;
}

// FIC: Attempt CBOE — real greeks + IV, no auth, ~15min delay. (EN)
async function tryFromCboe(
  symbol: string,
  putTarget: number,
  callTarget: number,
  targetDte: number
): Promise<ResolvedOptionContext | null> {
  try {
    const cboe = await fetchCboeChain(symbol);
    if (!cboe || cboe.expirations.length === 0) return null;

    const bestExp = pickBestExpiration(cboe.expirations, targetDte);
    if (!bestExp) return null;

    const filtered = filterByExpiration(cboe, bestExp);
    const calls = filtered.filter((c) => c.type === "call");
    const puts  = filtered.filter((c) => c.type === "put");

    const bestCall = closestStrike(calls, callTarget);
    const bestPut  = closestStrike(puts, putTarget);
    if (!bestCall && !bestPut) return null;

    const dte = Math.max(1, Math.round(
      (new Date(`${bestExp}T16:00:00Z`).getTime() - Date.now()) / 86_400_000
    ));
    const callPremium = bestCall ? midOrLast(bestCall.bid, bestCall.ask, bestCall.lastPrice) : 0;
    const putPremium  = bestPut  ? midOrLast(bestPut.bid,  bestPut.ask,  bestPut.lastPrice)  : 0;
    const callIv = bestCall?.iv ?? 0;
    const putIv  = bestPut?.iv  ?? 0;
    const iv = callIv > 0 && putIv > 0 ? (callIv + putIv) / 2 : callIv || putIv || 0.25;

    return { underlyingPrice: cboe.underlyingPrice, expirationDate: bestExp, dte, putPremium, callPremium, iv };
  } catch {
    return null;
  }
}

// FIC: Attempt Tradier — real greeks + IV, requires TRADIER_API_KEY. (EN)
async function tryFromTradier(
  symbol: string,
  putTarget: number,
  callTarget: number,
  targetDte: number
): Promise<ResolvedOptionContext | null> {
  if (!isTradierConfigured()) return null;
  try {
    interface TradierExpResponse {
      expirations: { date: string | string[] } | null;
    }
    interface TradierContract {
      strike: number;
      bid: number;
      ask: number;
      last: number;
      option_type: "call" | "put";
      implied_volatility?: number;
      greeks?: { smv_vol?: number };
    }
    interface TradierChainResponse {
      options: { option: TradierContract | TradierContract[] } | null;
    }

    const expData = await tradierGet<TradierExpResponse>("/markets/options/expirations", {
      symbol,
      includeAllRoots: "true",
    });
    const raw = expData?.expirations?.date;
    const expirations: string[] = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
    const bestExp = pickBestExpiration(expirations, targetDte);
    if (!bestExp) return null;

    let underlyingPrice = 0;
    try {
      const qData = await tradierGet<{ quotes: { quote: { last?: number } } }>(
        "/markets/quotes",
        { symbols: symbol, greeks: "false" }
      );
      underlyingPrice = qData?.quotes?.quote?.last ?? 0;
    } catch { /* non-fatal */ }

    const chainData = await tradierGet<TradierChainResponse>("/markets/options/chains", {
      symbol,
      expiration: bestExp,
      greeks: "true",
    });
    const rawContracts = chainData?.options?.option;
    const contracts: TradierContract[] = rawContracts
      ? Array.isArray(rawContracts) ? rawContracts : [rawContracts]
      : [];

    const calls = contracts.filter((c) => c.option_type === "call");
    const puts  = contracts.filter((c) => c.option_type === "put");
    const bestCall = closestStrike(calls, callTarget);
    const bestPut  = closestStrike(puts, putTarget);
    if (!bestCall && !bestPut) return null;

    const dte = Math.max(1, Math.round(
      (new Date(`${bestExp}T16:00:00Z`).getTime() - Date.now()) / 86_400_000
    ));
    const callPremium = bestCall ? midOrLast(bestCall.bid, bestCall.ask, bestCall.last) : 0;
    const putPremium  = bestPut  ? midOrLast(bestPut.bid,  bestPut.ask,  bestPut.last)  : 0;
    const callIv = bestCall?.greeks?.smv_vol ?? bestCall?.implied_volatility ?? 0;
    const putIv  = bestPut?.greeks?.smv_vol  ?? bestPut?.implied_volatility  ?? 0;
    const iv = callIv > 0 && putIv > 0 ? (callIv + putIv) / 2 : callIv || putIv || 0.25;

    return { underlyingPrice, expirationDate: bestExp, dte, putPremium, callPremium, iv };
  } catch {
    return null;
  }
}

// FIC: Attempt Yahoo Finance v7 — real bid/ask + IV, no auth required. (EN)
async function tryFromYahoo(
  symbol: string,
  putTarget: number,
  callTarget: number,
  targetDte: number
): Promise<ResolvedOptionContext | null> {
  try {
    const expTimestamps = await fetchYahooExpirations(symbol);
    if (!expTimestamps || expTimestamps.length === 0) return null;

    const expirations = expTimestamps.map((ts) => new Date(ts * 1000).toISOString().slice(0, 10));
    const bestExp = pickBestExpiration(expirations, targetDte);
    if (!bestExp) return null;

    const ts = Math.floor(new Date(`${bestExp}T00:00:00Z`).getTime() / 1000);
    const chainData = await fetchYahooOptionChain(symbol, ts);
    if (!chainData) return null;

    const bestCall = closestStrike(chainData.calls, callTarget);
    const bestPut  = closestStrike(chainData.puts,  putTarget);
    if (!bestCall && !bestPut) return null;

    const dte = Math.max(1, Math.round(
      (new Date(`${bestExp}T16:00:00Z`).getTime() - Date.now()) / 86_400_000
    ));
    const callPremium = bestCall ? midOrLast(bestCall.bid, bestCall.ask, bestCall.lastPrice) : 0;
    const putPremium  = bestPut  ? midOrLast(bestPut.bid,  bestPut.ask,  bestPut.lastPrice)  : 0;
    const callIv = bestCall?.impliedVolatility ?? 0;
    const putIv  = bestPut?.impliedVolatility  ?? 0;
    const iv = callIv > 0 && putIv > 0 ? (callIv + putIv) / 2 : callIv || putIv || 0.25;

    return {
      underlyingPrice: chainData.underlyingPrice,
      expirationDate: bestExp,
      dte,
      putPremium,
      callPremium,
      iv,
    };
  } catch {
    return null;
  }
}

// FIC: Resolve real option market context for coverage analysis — CBOE → Tradier → Yahoo. (EN)
// FIC: Resuelve contexto real del mercado de opciones para análisis de cobertura — CBOE → Tradier → Yahoo. (ES)
// targetDte: preferred days to expiration (default 45 days).
export async function resolveOptionContext(
  symbol: string,
  putStrikeTarget: number,
  callStrikeTarget: number,
  targetDte: number = 45
): Promise<ResolvedOptionContext | null> {
  const cboe = await tryFromCboe(symbol, putStrikeTarget, callStrikeTarget, targetDte);
  if (cboe) return cboe;

  const tradier = await tryFromTradier(symbol, putStrikeTarget, callStrikeTarget, targetDte);
  if (tradier) return tradier;

  return tryFromYahoo(symbol, putStrikeTarget, callStrikeTarget, targetDte);
}
