// FIC: CBOE delayed option chain client — real data, no auth, no registration required. (EN)
// FIC: Cliente de cadena de opciones CBOE con delay — datos reales, sin auth, sin registro. (ES)
// Source: https://cdn.cboe.com/api/global/delayed_quotes/options/{SYMBOL}.json
// Delay: ~15 min. Greeks and IV included. Coverage: US equity/ETF options.

import { normalCdf, estimateOptionPremium } from "../strategies/coverage/coverageTypes";

const CBOE_BASE = "https://cdn.cboe.com/api/global/delayed_quotes/options";
const REQUEST_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — matches CBOE update cadence

// ─── Types ────────────────────────────────────────────────────────────────────

interface CboeRawContract {
  option: string;       // OCC symbol e.g. "SPY260619C00550000"
  bid: number;
  ask: number;
  bid_size: number;
  ask_size: number;
  iv: number;
  open_interest: number;
  volume: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
  last_trade_price: number;
}

interface CboeResponse {
  timestamp: string;
  symbol: string;
  data: {
    current_price: number;
    options: CboeRawContract[];
  };
}

export interface CboeOptionContract {
  contractSymbol: string;
  type: "call" | "put";
  strike: number;
  expiration: string;    // YYYY-MM-DD
  bid: number;
  ask: number;
  lastPrice: number;
  volume: number;
  openInterest: number;
  iv: number;            // from CBOE, or inverse-BS when 0
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface CboeChainData {
  underlyingPrice: number;
  expirations: string[];   // all unique expiration dates in this chain
  contracts: CboeOptionContract[];
  fetchedAt: number;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const cache = new Map<string, CboeChainData>();

// ─── OCC symbol parsing ───────────────────────────────────────────────────────

// FIC: Parse OCC symbol → type, strike, expiration. Format: ROOT + YYMMDD + C/P + strike*1000. (EN)
function parseOcc(symbol: string): { type: "call" | "put"; strike: number; expiration: string } | null {
  const m = symbol.match(/^[A-Z]+(\d{6})([CP])(\d{8})$/);
  if (!m) return null;
  const [, yymmdd, cp, strikeStr] = m;
  return {
    type: cp === "C" ? "call" : "put",
    strike: parseInt(strikeStr, 10) / 1000,
    expiration: `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`,
  };
}

// ─── IV calculation via bisection ─────────────────────────────────────────────

// FIC: Bisection search for IV when CBOE reports 0 — uses mid-price as target. (EN)
// FIC: Búsqueda bisección de IV cuando CBOE reporta 0 — usa mid-price como objetivo. (ES)
function solveIV(
  type: "call" | "put",
  strike: number,
  underlying: number,
  mid: number,
  dte: number
): number {
  if (mid <= 0 || dte <= 0 || underlying <= 0 || strike <= 0) return 0;

  let lo = 0.001;
  let hi = 5.0;  // 500% IV upper bound
  for (let i = 0; i < 50; i++) {
    const guess = (lo + hi) / 2;
    const price = estimateOptionPremium(type, strike, guess, dte, underlying);
    if (price < mid) lo = guess;
    else hi = guess;
    if (hi - lo < 0.0001) break;
  }
  return parseFloat(((lo + hi) / 2).toFixed(4));
}

// ─── Greeks from BS ───────────────────────────────────────────────────────────

// FIC: Compute all 4 standard Greeks using Black-Scholes formulas. (EN)
// FIC: Calcula los 4 Greeks estándar usando fórmulas de Black-Scholes. (ES)
function computeGreeks(
  type: "call" | "put",
  strike: number,
  iv: number,
  dte: number,
  underlying: number
): { delta: number; gamma: number; theta: number; vega: number } {
  if (strike <= 0 || underlying <= 0 || iv <= 0 || dte <= 0) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0 };
  }

  const T = dte / 365;
  const sqrtT = Math.sqrt(T);
  const r = 0.05;
  const d1 = (Math.log(underlying / strike) + (r + 0.5 * iv * iv) * T) / (iv * sqrtT);
  const d2 = d1 - iv * sqrtT;

  // φ(d1) — standard normal PDF
  const phi = Math.exp(-0.5 * d1 * d1) / Math.sqrt(2 * Math.PI);

  const delta = type === "call" ? normalCdf(d1) : normalCdf(d1) - 1;
  const gamma = phi / (underlying * iv * sqrtT);
  const vega  = underlying * phi * sqrtT / 100;  // per 1% IV move

  // Theta (per calendar day, simplified)
  const thetaCall =
    -(underlying * phi * iv) / (2 * sqrtT) -
    r * strike * Math.exp(-r * T) * normalCdf(d2);
  const thetaPut  =
    -(underlying * phi * iv) / (2 * sqrtT) +
    r * strike * Math.exp(-r * T) * normalCdf(-d2);
  const theta = (type === "call" ? thetaCall : thetaPut) / 365;

  return {
    delta: parseFloat(delta.toFixed(4)),
    gamma: parseFloat(gamma.toFixed(6)),
    theta: parseFloat(theta.toFixed(6)),
    vega:  parseFloat(vega.toFixed(4)),
  };
}

// ─── Fetch & parse ────────────────────────────────────────────────────────────

// FIC: Fetch and parse CBOE option chain — cached 5 min, Greeks computed locally when IV=0. (EN)
// FIC: Obtiene y parsea cadena de opciones CBOE — caché 5 min, Greeks calculados localmente cuando IV=0. (ES)
export async function fetchCboeChain(
  symbol: string,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch
): Promise<CboeChainData | null> {

  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;

  const url = `${CBOE_BASE}/${encodeURIComponent(symbol)}.json`;
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetchImpl(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
      signal: ac.signal,
    });

    if (!res.ok) return null;
    const raw = (await res.json()) as CboeResponse;
    const underlying = raw?.data?.current_price ?? 0;
    const rawContracts = raw?.data?.options ?? [];
    if (rawContracts.length === 0) return null;

    const today = new Date();
    const contracts: CboeOptionContract[] = [];
    const expirationSet = new Set<string>();

    for (const c of rawContracts) {
      const parsed = parseOcc(c.option);
      if (!parsed) continue;

      // Skip contracts that expire today or in the past
      if (parsed.expiration <= today.toISOString().slice(0, 10)) continue;

      expirationSet.add(parsed.expiration);

      const dte = Math.max(
        1,
        Math.round((new Date(`${parsed.expiration}T16:00:00Z`).getTime() - Date.now()) / 86_400_000)
      );

      const mid = c.bid > 0 && c.ask > 0 ? (c.bid + c.ask) / 2 : c.last_trade_price;

      // FIC: Use CBOE's IV if available; compute via bisection when 0 (deep ITM/ATM edge cases). (EN)
      // FIC: Usa IV de CBOE si está disponible; calcula por bisección cuando es 0. (ES)
      const iv = c.iv > 0 ? c.iv : solveIV(parsed.type, parsed.strike, underlying, mid, dte);

      // FIC: Use CBOE Greeks when valid; recalculate locally when delta/gamma are exactly 0/1. (EN)
      // FIC: Usa Greeks de CBOE cuando son válidos; recalcula localmente cuando delta/gamma son exactamente 0/1. (ES)
      const needsRecalc = iv > 0 && (c.gamma === 0 && Math.abs(c.delta) !== 1);
      const greeks = needsRecalc
        ? computeGreeks(parsed.type, parsed.strike, iv, dte, underlying)
        : { delta: c.delta, gamma: c.gamma, theta: c.theta, vega: c.vega };

      contracts.push({
        contractSymbol: c.option,
        type:         parsed.type,
        strike:       parsed.strike,
        expiration:   parsed.expiration,
        bid:          c.bid,
        ask:          c.ask,
        lastPrice:    c.last_trade_price,
        volume:       c.volume,
        openInterest: c.open_interest,
        iv,
        ...greeks,
      });
    }

    const expirations = Array.from(expirationSet).sort();
    const result: CboeChainData = { underlyingPrice: underlying, expirations, contracts, fetchedAt: Date.now() };
    cache.set(symbol, result);
    return result;
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}

// FIC: Get contracts filtered to a specific expiration date. (EN)
export function filterByExpiration(chain: CboeChainData, expiration: string): CboeOptionContract[] {
  return chain.contracts.filter((c) => c.expiration === expiration);
}
