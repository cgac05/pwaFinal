// FIC: Option chain route — merges calls/puts by strike into OptionChainResponse. (EN)
// FIC: Ruta de cadena de opciones — combina calls/puts por strike en OptionChainResponse. (ES)
// Data source: Tradier → Alpaca (existing key) → Yahoo Finance v7 → empty response

import { Router, type Request, type Response } from "express";
import { authContextMiddleware } from "../../middleware/authContext";
import {
  fetchYahooOptionChain,
  fetchYahooExpirations,
  type YahooFullOptionContract,
} from "../../modules/institutional/yahooOptionsParser";
import { isTradierConfigured, tradierGet } from "../../modules/market/tradierClient";
import {
  fetchAlpacaOptionChain,
  isAlpacaOptionsConfigured,
  type AlpacaOptionRow,
} from "../../modules/market/alpacaOptionsClient";
import {
  fetchMarketdataOptionChain,
  isMarketdataConfigured,
} from "../../modules/market/marketdataClient";
import {
  fetchCboeChain,
  filterByExpiration,
} from "../../modules/market/cboeOptionsClient";
import { computeDelta } from "../../modules/strategies/coverage/coverageTypes";

export const optionChainRouter = Router();

const ALLOWED_ROLES = new Set(["analyst", "risk_manager", "trader", "admin"]);

// FIC: Shared response interfaces — used by frontend service and OptionChainTable. (EN)
// FIC: Interfaces de respuesta compartidas — usadas por el servicio frontend y OptionChainTable. (ES)
export interface OptionChainRow {
  strike: number;
  // Calls
  callBid: number;
  callAsk: number;
  callIV: number;
  callDelta: number;
  callVolume: number;
  callOpenInterest: number;
  callLastPrice: number;
  // Puts
  putBid: number;
  putAsk: number;
  putIV: number;
  putDelta: number;
  putVolume: number;
  putOpenInterest: number;
  putLastPrice: number;
}

export interface OptionChainResponse {
  ticker: string;
  underlyingPrice: number;
  expirationDate: string;
  availableExpirations: string[];
  rows: OptionChainRow[];
  greeksAvailable: boolean;
}

// FIC: Convert YYYY-MM-DD string to unix timestamp (seconds, midnight UTC). (EN)
// FIC: Convierte string YYYY-MM-DD a timestamp unix (segundos, medianoche UTC). (ES)
function dateToTimestamp(dateStr: string): number {
  return Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
}

// FIC: Convert unix timestamp (seconds) to YYYY-MM-DD string. (EN)
// FIC: Convierte timestamp unix (segundos) a string YYYY-MM-DD. (ES)
function timestampToDate(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

// FIC: Build empty row for a strike that has no matching call or put. (EN)
function emptyRow(strike: number): OptionChainRow {
  return { strike, callBid: 0, callAsk: 0, callIV: 0, callDelta: 0, callVolume: 0, callOpenInterest: 0, callLastPrice: 0, putBid: 0, putAsk: 0, putIV: 0, putDelta: 0, putVolume: 0, putOpenInterest: 0, putLastPrice: 0 };
}

// FIC: Merge Yahoo calls/puts by strike — delta is 0 (greeksAvailable: false). (EN)
// FIC: Combina calls/puts de Yahoo por strike — delta es 0 (greeksAvailable: false). (ES)
function mergeByStrike(
  calls: YahooFullOptionContract[],
  puts: YahooFullOptionContract[]
): OptionChainRow[] {
  const callMap = new Map(calls.map((c) => [c.strike, c]));
  const putMap  = new Map(puts.map((p)  => [p.strike, p]));
  const strikes = Array.from(new Set([...callMap.keys(), ...putMap.keys()])).sort((a, b) => a - b);

  return strikes.map((strike) => {
    const row = emptyRow(strike);
    const c = callMap.get(strike);
    const p = putMap.get(strike);
    if (c) {
      row.callBid = c.bid; row.callAsk = c.ask; row.callIV = c.impliedVolatility;
      row.callVolume = c.volume; row.callOpenInterest = c.openInterest; row.callLastPrice = c.lastPrice;
    }
    if (p) {
      row.putBid = p.bid; row.putAsk = p.ask; row.putIV = p.impliedVolatility;
      row.putVolume = p.volume; row.putOpenInterest = p.openInterest; row.putLastPrice = p.lastPrice;
    }
    return row;
  });
}

// FIC: Tradier option shape for chain endpoint. (EN)
interface TradierOptionContract {
  strike: number;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  open_interest: number;
  implied_volatility: number;
  option_type: "call" | "put";
  greeks?: { delta?: number; smv_vol?: number };
}

interface TradierChainResponse {
  options: { option: TradierOptionContract | TradierOptionContract[] } | null;
}

// FIC: Merge Tradier options by strike — delta and IV come from greeks field. (EN)
// FIC: Combina opciones Tradier por strike — delta e IV vienen del campo greeks. (ES)
function mergeTradierByStrike(contracts: TradierOptionContract[]): OptionChainRow[] {
  const callMap = new Map<number, TradierOptionContract>();
  const putMap  = new Map<number, TradierOptionContract>();
  for (const c of contracts) {
    if (c.option_type === "call") callMap.set(c.strike, c);
    else putMap.set(c.strike, c);
  }
  const strikes = Array.from(new Set([...callMap.keys(), ...putMap.keys()])).sort((a, b) => a - b);

  return strikes.map((strike) => {
    const row = emptyRow(strike);
    const c = callMap.get(strike);
    const p = putMap.get(strike);
    if (c) {
      row.callBid = c.bid; row.callAsk = c.ask;
      row.callIV = c.greeks?.smv_vol ?? c.implied_volatility ?? 0;
      row.callDelta = c.greeks?.delta ?? 0;
      row.callVolume = c.volume; row.callOpenInterest = c.open_interest; row.callLastPrice = c.last;
    }
    if (p) {
      row.putBid = p.bid; row.putAsk = p.ask;
      row.putIV = p.greeks?.smv_vol ?? p.implied_volatility ?? 0;
      row.putDelta = p.greeks?.delta ?? 0;
      row.putVolume = p.volume; row.putOpenInterest = p.open_interest; row.putLastPrice = p.last;
    }
    return row;
  });
}

// FIC: Merge Alpaca rows by strike — delta computed locally via Black-Scholes (greeksAvailable: false). (EN)
// FIC: Combina rows de Alpaca por strike — delta calculada localmente via Black-Scholes (greeksAvailable: false). (ES)
function mergeAlpacaByStrike(
  rows: AlpacaOptionRow[],
  underlyingPrice: number,
  dte: number
): OptionChainRow[] {
  const callMap = new Map<number, AlpacaOptionRow>();
  const putMap  = new Map<number, AlpacaOptionRow>();
  for (const r of rows) {
    if (r.type === "call") callMap.set(r.strike, r);
    else                   putMap.set(r.strike, r);
  }
  const strikes = Array.from(new Set([...callMap.keys(), ...putMap.keys()])).sort((a, b) => a - b);

  return strikes.map((strike) => {
    const row = emptyRow(strike);
    const c = callMap.get(strike);
    const p = putMap.get(strike);
    // FIC: Use a rough IV estimate (20%) solely for delta calc — no real IV available from Alpaca snapshots. (EN)
    const roughIv = 0.20;
    if (c) {
      row.callBid = c.bid; row.callAsk = c.ask; row.callLastPrice = c.lastPrice;
      row.callVolume = c.volume;
      row.callDelta = underlyingPrice > 0 ? computeDelta("call", strike, roughIv, dte, underlyingPrice) : 0;
    }
    if (p) {
      row.putBid = p.bid; row.putAsk = p.ask; row.putLastPrice = p.lastPrice;
      row.putVolume = p.volume;
      row.putDelta = underlyingPrice > 0 ? computeDelta("put", strike, roughIv, dte, underlyingPrice) : 0;
    }
    return row;
  });
}

optionChainRouter.get(
  "/chain",
  authContextMiddleware,
  async (req: Request, res: Response) => {
    const role = req.authContext?.role ?? "";
    if (!ALLOWED_ROLES.has(role)) {
      res.status(403).json({ code: "FORBIDDEN_ROLE" });
      return;
    }

    const symbol     = typeof req.query.symbol     === "string" ? req.query.symbol.trim().toUpperCase()     : "";
    const expiration = typeof req.query.expiration === "string" ? req.query.expiration.trim() : "";

    if (!symbol) {
      res.status(400).json({ code: "INVALID_SYMBOL", message: "symbol query param is required" });
      return;
    }
    if (!expiration || !/^\d{4}-\d{2}-\d{2}$/.test(expiration)) {
      res.status(400).json({ code: "INVALID_EXPIRATION", message: "expiration must be YYYY-MM-DD" });
      return;
    }

    // FIC: Tradier path — greeksAvailable: true. (EN)
    if (isTradierConfigured()) {
      try {
        const data = await tradierGet<TradierChainResponse>("/markets/options/chains", {
          symbol,
          expiration,
          greeks: "true",
        });

        const raw = data?.options?.option;
        const contracts: TradierOptionContract[] = raw
          ? Array.isArray(raw) ? raw : [raw]
          : [];

        // Fetch all expirations for the response
        let availableExpirations: string[] = [];
        try {
          const expData = await tradierGet<{ expirations: { date: string | string[] } | null }>(
            "/markets/options/expirations",
            { symbol, includeAllRoots: "true" }
          );
          const dates = expData?.expirations?.date;
          availableExpirations = dates
            ? Array.isArray(dates) ? dates : [dates]
            : [];
        } catch { /* non-fatal */ }

        // Get underlying price from a simple quote
        let underlyingPrice = 0;
        try {
          const qData = await tradierGet<{ quotes: { quote: { last?: number } } }>(
            "/markets/quotes",
            { symbols: symbol, greeks: "false" }
          );
          underlyingPrice = qData?.quotes?.quote?.last ?? 0;
        } catch { /* non-fatal */ }

        const rows = mergeTradierByStrike(contracts);
        const response: OptionChainResponse = {
          ticker: symbol, underlyingPrice, expirationDate: expiration,
          availableExpirations, rows, greeksAvailable: true,
        };
        res.status(200).json(response);
        return;
      } catch {
        res.status(502).json({ code: "TRADIER_UNAVAILABLE" });
        return;
      }
    }

    // FIC: Source 2 — CBOE delayed quotes (free, no auth, real bid/ask + IV + Greeks ~15min). (EN)
    // FIC: Fuente 2 — Cotizaciones diferidas CBOE (gratuito, sin auth, bid/ask + IV + Greeks ~15min). (ES)
    {
      const cboeChain = await fetchCboeChain(symbol);
      if (cboeChain) {
        const filtered = filterByExpiration(cboeChain, expiration);
        if (filtered.length > 0) {
          const callMap = new Map(filtered.filter(c => c.type === "call").map(c => [c.strike, c]));
          const putMap  = new Map(filtered.filter(c => c.type === "put").map(c => [c.strike, c]));
          const strikes = Array.from(new Set([...callMap.keys(), ...putMap.keys()])).sort((a, b) => a - b);

          const rows: OptionChainRow[] = strikes.map((strike) => {
            const row = emptyRow(strike);
            const c = callMap.get(strike);
            const p = putMap.get(strike);
            if (c) {
              row.callBid = c.bid; row.callAsk = c.ask; row.callIV = c.iv;
              row.callDelta = c.delta; row.callVolume = c.volume;
              row.callOpenInterest = c.openInterest; row.callLastPrice = c.lastPrice;
            }
            if (p) {
              row.putBid = p.bid; row.putAsk = p.ask; row.putIV = p.iv;
              row.putDelta = p.delta; row.putVolume = p.volume;
              row.putOpenInterest = p.openInterest; row.putLastPrice = p.lastPrice;
            }
            return row;
          });

          const response: OptionChainResponse = {
            ticker: symbol,
            underlyingPrice: cboeChain.underlyingPrice,
            expirationDate: expiration,
            availableExpirations: cboeChain.expirations,
            rows,
            greeksAvailable: true,
          };
          res.status(200).json(response);
          return;
        }
      }
    }

    // FIC: Source 3 — MarketData.app (free tier, real bid/ask + IV + Greeks). (EN)
    // FIC: Fuente 2 — MarketData.app (tier gratuito, bid/ask real + IV + Greeks). (ES)
    // Register free at https://www.marketdata.app/ → add MARKETDATA_API_TOKEN to .env
    if (isMarketdataConfigured()) {
      const mdData = await fetchMarketdataOptionChain(symbol, expiration);
      if (mdData && mdData.rows.length > 0) {
        const callMap = new Map<number, (typeof mdData.rows)[0]>();
        const putMap  = new Map<number, (typeof mdData.rows)[0]>();
        for (const r of mdData.rows) {
          if (r.type === "call") callMap.set(r.strike, r);
          else putMap.set(r.strike, r);
        }
        const strikes = Array.from(new Set([...callMap.keys(), ...putMap.keys()])).sort((a, b) => a - b);
        const rows: OptionChainRow[] = strikes.map((strike) => {
          const row = emptyRow(strike);
          const c = callMap.get(strike);
          const p = putMap.get(strike);
          if (c) {
            row.callBid = c.bid; row.callAsk = c.ask; row.callIV = c.impliedVolatility;
            row.callDelta = c.delta; row.callVolume = c.volume;
            row.callOpenInterest = c.openInterest; row.callLastPrice = c.lastPrice;
          }
          if (p) {
            row.putBid = p.bid; row.putAsk = p.ask; row.putIV = p.impliedVolatility;
            row.putDelta = p.delta; row.putVolume = p.volume;
            row.putOpenInterest = p.openInterest; row.putLastPrice = p.lastPrice;
          }
          return row;
        });
        const response: OptionChainResponse = {
          ticker: symbol, underlyingPrice: mdData.underlyingPrice,
          expirationDate: expiration, availableExpirations: [],
          rows, greeksAvailable: true,
        };
        res.status(200).json(response);
        return;
      }
    }

    // FIC: Source 3 — Alpaca options snapshots (uses existing ALPACA_API_KEY, real bid/ask). (EN)
    // FIC: Fuente 2 — snapshots de opciones Alpaca (usa ALPACA_API_KEY existente, bid/ask reales). (ES)
    if (isAlpacaOptionsConfigured()) {
      const alpacaRows = await fetchAlpacaOptionChain(symbol, expiration);
      if (alpacaRows && alpacaRows.length > 0) {
        // Get underlying price for delta calculation
        let underlyingPrice = 0;
        try {
          const qRes = await fetch(
            `https://data.alpaca.markets/v2/stocks/${symbol}/quotes/latest`,
            { headers: {
                "APCA-API-KEY-ID":     process.env.ALPACA_API_KEY    ?? "",
                "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET_KEY ?? "",
                Accept: "application/json",
              }
            }
          );
          if (qRes.ok) {
            const qData = (await qRes.json()) as { quote?: { ap?: number; bp?: number } };
            const ap = qData?.quote?.ap ?? 0;
            const bp = qData?.quote?.bp ?? 0;
            underlyingPrice = ap > 0 && bp > 0 ? (ap + bp) / 2 : ap || bp;
          }
        } catch { /* use 0 */ }

        // Days to expiration for local delta calc
        const msToExp = new Date(`${expiration}T16:00:00Z`).getTime() - Date.now();
        const dte = Math.max(1, Math.round(msToExp / 86_400_000));

        const rows = mergeAlpacaByStrike(alpacaRows, underlyingPrice, dte);
        const response: OptionChainResponse = {
          ticker: symbol,
          underlyingPrice,
          expirationDate: expiration,
          availableExpirations: [],
          rows,
          greeksAvailable: false,
        };
        res.status(200).json(response);
        return;
      }
    }

    // FIC: Source 3 — Yahoo Finance path — greeksAvailable: false (delta defaults to 0). (EN)
    // FIC: Fuente 3 — path Yahoo Finance — greeksAvailable: false (delta por defecto 0). (ES)
    // TODO: replace Yahoo with tradierClient when TRADIER_API_KEY is available
    const expirationTs = dateToTimestamp(expiration);
    const chainData = await fetchYahooOptionChain(symbol, expirationTs);

    // FIC: Yahoo blocked in WSL/server-side — return empty chain with informative message instead of 502. (EN)
    // FIC: Yahoo bloqueado en WSL/server-side — retorna cadena vacía con mensaje informativo en lugar de 502. (ES)
    if (!chainData) {
      const emptyResponse: OptionChainResponse & { unavailableReason?: string } = {
        ticker: symbol,
        underlyingPrice: 0,
        expirationDate: expiration,
        availableExpirations: [],
        rows: [],
        greeksAvailable: false,
        unavailableReason: "YAHOO_BLOCKED",
      };
      res.status(200).json(emptyResponse);
      return;
    }

    const rows = mergeByStrike(chainData.calls, chainData.puts);
    const availableExpirations = chainData.expirationDates.map(timestampToDate);

    const response: OptionChainResponse = {
      ticker: symbol,
      underlyingPrice: chainData.underlyingPrice,
      expirationDate: expiration,
      availableExpirations,
      rows,
      greeksAvailable: false,
    };

    res.status(200).json(response);
  }
);
