// FIC: MarketData.app client — free option chain with IV and Greeks. (EN)
// FIC: Cliente MarketData.app — cadena de opciones gratuita con IV y Greeks. (ES)
// Free tier: https://www.marketdata.app/ — register, get token, add MARKETDATA_API_TOKEN to .env
// Free tier includes: 100 req/day, real bid/ask, IV, delta, gamma, theta, vega

const BASE_URL = "https://api.marketdata.app/v1";
const REQUEST_TIMEOUT_MS = 8_000;

export function isMarketdataConfigured(): boolean {
  return Boolean(process.env.MARKETDATA_API_TOKEN);
}

function mdHeaders(): Record<string, string> {
  return {
    Authorization: `Token ${process.env.MARKETDATA_API_TOKEN ?? ""}`,
    Accept: "application/json",
  };
}

// FIC: MarketData.app returns arrays (columnar format) instead of array-of-objects. (EN)
// FIC: MarketData.app retorna arrays (formato columnar) en lugar de array-de-objetos. (ES)
interface MarketdataChainResponse {
  s: "ok" | "error" | "no_data";
  optionSymbol?: string[];
  underlying?: string[];
  expiration?: number[];    // unix timestamps
  side?: string[];          // "call" | "put"
  strike?: number[];
  bid?: number[];
  ask?: number[];
  mid?: number[];
  last?: number[];
  volume?: number[];
  openInterest?: number[];
  impliedVolatility?: number[];
  delta?: number[];
  gamma?: number[];
  theta?: number[];
  vega?: number[];
  underlyingPrice?: number[];
  errmsg?: string;
}

interface MarketdataExpirationsResponse {
  s: "ok" | "error" | "no_data";
  expirations?: string[];   // YYYY-MM-DD strings
  errmsg?: string;
}

export interface MarketdataOptionRow {
  contractSymbol: string;
  type: "call" | "put";
  strike: number;
  expiration: string;
  bid: number;
  ask: number;
  lastPrice: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface MarketdataChainData {
  rows: MarketdataOptionRow[];
  underlyingPrice: number;
}

// FIC: Fetch option chain with Greeks from MarketData.app for a specific expiration. (EN)
// FIC: Obtiene cadena de opciones con Greeks de MarketData.app para una expiración específica. (ES)
export async function fetchMarketdataOptionChain(
  symbol: string,
  expiration: string
): Promise<MarketdataChainData | null> {
  if (!isMarketdataConfigured()) return null;

  const url = new URL(`${BASE_URL}/options/chain/${encodeURIComponent(symbol)}/`);
  url.searchParams.set("expiration", expiration);

  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), { headers: mdHeaders(), signal: ac.signal });
    if (!res.ok) return null;

    const data = (await res.json()) as MarketdataChainResponse;
    if (data.s !== "ok" || !data.strike) return null;

    const count = data.strike.length;
    const rows: MarketdataOptionRow[] = [];

    for (let i = 0; i < count; i++) {
      const side = data.side?.[i] ?? "";
      const type = side === "call" ? "call" : side === "put" ? "put" : null;
      if (!type) continue;

      rows.push({
        contractSymbol: data.optionSymbol?.[i] ?? "",
        type,
        strike:            data.strike[i]             ?? 0,
        expiration:        data.expiration?.[i]
          ? new Date((data.expiration[i]) * 1000).toISOString().slice(0, 10)
          : expiration,
        bid:               data.bid?.[i]              ?? 0,
        ask:               data.ask?.[i]              ?? 0,
        lastPrice:         data.last?.[i]             ?? data.mid?.[i]  ?? 0,
        volume:            data.volume?.[i]           ?? 0,
        openInterest:      data.openInterest?.[i]     ?? 0,
        impliedVolatility: data.impliedVolatility?.[i] ?? 0,
        delta:             data.delta?.[i]            ?? 0,
        gamma:             data.gamma?.[i]            ?? 0,
        theta:             data.theta?.[i]            ?? 0,
        vega:              data.vega?.[i]             ?? 0,
      });
    }

    const underlyingPrice = data.underlyingPrice?.[0] ?? 0;
    return rows.length > 0 ? { rows, underlyingPrice } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}

// FIC: Fetch available expiration dates from MarketData.app. (EN)
// FIC: Obtiene fechas de expiración disponibles de MarketData.app. (ES)
export async function fetchMarketdataExpirations(symbol: string): Promise<string[] | null> {
  if (!isMarketdataConfigured()) return null;

  const url = `${BASE_URL}/options/expirations/${encodeURIComponent(symbol)}/`;
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, { headers: mdHeaders(), signal: ac.signal });
    if (!res.ok) return null;

    const data = (await res.json()) as MarketdataExpirationsResponse;
    if (data.s !== "ok" || !data.expirations) return null;

    return data.expirations.length > 0 ? data.expirations : null;
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}
