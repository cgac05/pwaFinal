// FIC: Alpaca options client — real bid/ask data using existing ALPACA_API_KEY. (EN)
// FIC: Cliente de opciones Alpaca — datos reales de bid/ask usando ALPACA_API_KEY existente. (ES)
// Endpoint: https://data.alpaca.markets/v2/options/snapshots/{symbol}
// Greeks: not provided by Alpaca snapshots — delta computed locally via Black-Scholes.

const ALPACA_DATA_BASE = "https://data.alpaca.markets";
const REQUEST_TIMEOUT_MS = 8_000;

export function isAlpacaOptionsConfigured(): boolean {
  return Boolean(process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY);
}

function alpacaHeaders(): Record<string, string> {
  return {
    "APCA-API-KEY-ID":     process.env.ALPACA_API_KEY    ?? "",
    "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET_KEY ?? "",
    Accept: "application/json",
  };
}

// FIC: Alpaca snapshot shape — latestQuote has ask (ap) and bid (bp). (EN)
interface AlpacaSnapshot {
  latestQuote?: { ap?: number; bp?: number; as?: number; bs?: number };
  latestTrade?: { p?: number; s?: number };
  dailyBar?: { v?: number };
}

// FIC: Parse OCC contract symbol → strike, type, expiration. (EN)
// FIC: Parsea símbolo de contrato OCC → strike, tipo, expiración. (ES)
// OCC format: underlying(1-6 chars) + YYMMDD(6) + C/P(1) + strike*1000 zero-padded to 8 digits
function parseOccSymbol(symbol: string): { type: "call" | "put"; strike: number; expiration: string } | null {
  const match = symbol.match(/^[A-Z]+(\d{6})([CP])(\d{8})$/);
  if (!match) return null;
  const [, yymmdd, cp, strikeStr] = match;
  return {
    type: cp === "C" ? "call" : "put",
    strike: parseInt(strikeStr, 10) / 1000,
    expiration: `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`,
  };
}

export interface AlpacaOptionRow {
  contractSymbol: string;
  type: "call" | "put";
  strike: number;
  expiration: string;
  bid: number;
  ask: number;
  lastPrice: number;
  volume: number;
}

// FIC: Fetch option snapshots for a specific expiration from Alpaca data API. (EN)
// FIC: Obtiene snapshots de opciones para una expiración específica de la API de datos de Alpaca. (ES)
export async function fetchAlpacaOptionChain(
  symbol: string,
  expiration: string
): Promise<AlpacaOptionRow[] | null> {
  if (!isAlpacaOptionsConfigured()) return null;

  const url = new URL(`${ALPACA_DATA_BASE}/v2/options/snapshots/${encodeURIComponent(symbol)}`);
  url.searchParams.set("expiration_date", expiration);
  url.searchParams.set("feed", "indicative");
  url.searchParams.set("limit", "1000");

  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      headers: alpacaHeaders(),
      signal: ac.signal,
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      snapshots?: Record<string, AlpacaSnapshot>;
      next_page_token?: string | null;
    };

    const snapshots = data?.snapshots;
    if (!snapshots || Object.keys(snapshots).length === 0) return null;

    const rows: AlpacaOptionRow[] = [];
    for (const [contractSymbol, snap] of Object.entries(snapshots)) {
      const parsed = parseOccSymbol(contractSymbol);
      if (!parsed) continue;

      rows.push({
        contractSymbol,
        type:       parsed.type,
        strike:     parsed.strike,
        expiration: parsed.expiration,
        bid:        snap.latestQuote?.bp ?? 0,
        ask:        snap.latestQuote?.ap ?? 0,
        lastPrice:  snap.latestTrade?.p  ?? 0,
        volume:     snap.dailyBar?.v     ?? 0,
      });
    }

    return rows.length > 0 ? rows : null;
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}

// FIC: Fetch available expiration dates by scanning option contracts for a symbol. (EN)
// FIC: Obtiene fechas de expiración disponibles escaneando contratos de opciones de un símbolo. (ES)
export async function fetchAlpacaExpirations(symbol: string): Promise<string[] | null> {
  if (!isAlpacaOptionsConfigured()) return null;

  const url = new URL(`${ALPACA_DATA_BASE}/v2/options/contracts`);
  url.searchParams.set("underlying_symbols", symbol);
  url.searchParams.set("status", "active");
  url.searchParams.set("limit", "500");

  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      headers: alpacaHeaders(),
      signal: ac.signal,
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      option_contracts?: Array<{ expiration_date?: string }>;
    };

    const contracts = data?.option_contracts;
    if (!contracts || contracts.length === 0) return null;

    const dates = Array.from(
      new Set(contracts.map((c) => c.expiration_date).filter(Boolean) as string[])
    ).sort();

    return dates.length > 0 ? dates : null;
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}
