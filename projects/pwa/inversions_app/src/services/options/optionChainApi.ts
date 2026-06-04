// FIC: Option chain service — calls /api/options/chain and /api/options/expirations. (EN)
// FIC: Servicio de cadena de opciones — llama a /api/options/chain y /api/options/expirations. (ES)

import { getAuthHeaders } from "../signals/signalApi";

export interface OptionChainRow {
  strike: number;
  callBid: number;
  callAsk: number;
  callIV: number;
  callDelta: number;
  callVolume: number;
  callOpenInterest: number;
  callLastPrice: number;
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
  unavailableReason?: string;
}

export interface ExpirationsResponse {
  symbol: string;
  expirations: string[];
  source?: "yahoo" | "tradier" | "synthetic";
}

export async function fetchOptionChain(
  symbol: string,
  expiration: string
): Promise<OptionChainResponse> {
  const res = await fetch(
    `/api/options/chain?symbol=${encodeURIComponent(symbol)}&expiration=${encodeURIComponent(expiration)}`,
    { headers: getAuthHeaders() }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { code?: string };
    throw new Error(body.code ?? `OPTIONS_CHAIN_ERROR_${res.status}`);
  }
  return res.json() as Promise<OptionChainResponse>;
}

export async function fetchExpirations(symbol: string): Promise<ExpirationsResponse> {
  const res = await fetch(
    `/api/options/expirations?symbol=${encodeURIComponent(symbol)}`,
    { headers: getAuthHeaders() }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { code?: string };
    throw new Error(body.code ?? `EXPIRATIONS_ERROR_${res.status}`);
  }
  return res.json() as Promise<ExpirationsResponse>;
}
