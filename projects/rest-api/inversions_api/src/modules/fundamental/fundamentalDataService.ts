/**
 * T004-T078: Servicio de integración con fuentes externas de datos fundamentales
 * Implementa abstracción DataSource, caché, rate limiter y fallback chain.
 *
 * T004-T078: External data source integration service
 * Implements DataSource abstraction, caching, rate limiting, and fallback chain.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FundamentalAnalysisData } from "./fundamentalSourceContract";

/**
 * T004a: Interfaz PluggableSource para múltiples proveedores de datos
 */
export interface DataSourceConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  rateLimit: {
    requestsPerMin: number;
    burstAllowed: number;
  };
}

export interface DataSourceResult {
  success: boolean;
  data?: FundamentalAnalysisData;
  error?: string;
  timestamp: string;
  cost?: number;
  costMetric?: string;
}

export interface PluggableSource {
  config: DataSourceConfig;
  fetch(ticker: string, lookbackDays?: number): Promise<DataSourceResult>;
  validate(data: FundamentalAnalysisData): boolean;
  isHealthy(): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Annualized historical volatility from closing prices (newest → oldest). */
function calculateHistoricalVolatility(closePrices: number[], lookbackDays: number): number {
  const prices = closePrices.slice(0, Math.min(lookbackDays + 1, closePrices.length));
  if (prices.length < 2) return 0;
  const logReturns: number[] = [];
  for (let i = 0; i < prices.length - 1; i++) {
    if (prices[i + 1] > 0) logReturns.push(Math.log(prices[i] / prices[i + 1]));
  }
  if (logReturns.length < 2) return 0;
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance =
    logReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (logReturns.length - 1);
  return Math.round(Math.sqrt(variance) * Math.sqrt(252) * 10000) / 100;
}

/**
 * SimFin compact format → column-indexed row lookup.
 * compact = { columns: string[], data: any[][] }
 */
function col(columns: string[], row: any[], name: string): any {
  const idx = columns.indexOf(name);
  return idx >= 0 ? row[idx] : undefined;
}

// ---------------------------------------------------------------------------
// Finviz CSV helpers
// ---------------------------------------------------------------------------

/** Parse a single Finviz CSV line respecting quoted fields. */
function parseFinvizCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

/** Strip % suffix and parse float; returns 0 if not a number. */
function pctToFloat(val: string | undefined): number {
  if (!val) return 0;
  return parseFloat(val.replace("%", "").trim()) || 0;
}

/** Parse float from string; returns 0 if not a number. */
function toFloat(val: string | undefined): number {
  if (!val) return 0;
  return parseFloat(val.trim()) || 0;
}

/**
 * Parse Finviz CSV export into a record keyed by column header.
 * Returns null if the response is HTML (not CSV).
 */
function parseFinvizCsv(raw: string): Record<string, string> | null {
  const lines = raw.trim().split("\n").filter((l) => l.trim());
  if (lines.length < 2 || !lines[0].startsWith('"No."')) return null;
  const headers = parseFinvizCsvLine(lines[0]);
  const values = parseFinvizCsvLine(lines[1]);
  const record: Record<string, string> = {};
  headers.forEach((h, i) => {
    record[h.trim()] = (values[i] ?? "").trim();
  });
  return record;
}

// ---------------------------------------------------------------------------
// Finviz Elite DataSource
// ---------------------------------------------------------------------------

/**
 * T004a: DataSource para Finviz Elite
 *
 * Vistas usadas en paralelo:
 *  - v=111 (Overview) → Company, Sector, Industry, Country, Market Cap, P/E, Price, Volume
 *  - v=120 (Financial) → P/S, P/B, PEG, EPS growth, Sales growth
 *  - v=160 (Financial Highlights) → ROE, ROA, Dividend Yield, Debt/Equity, Margins
 *  - Yahoo chart v8  → historical prices → volatilidad y 52w range
 *
 * Auth: Cookie finvizStockScreenerToken + &auth= query param.
 */
export class FinvizDataSource implements PluggableSource {
  config: DataSourceConfig;
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.FINVIZ_API_KEY ?? "";
    this.config = {
      id: "finviz",
      name: "Finviz Elite",
      baseUrl: "https://elite.finviz.com",
      apiKey: this.apiKey,
      rateLimit: {
        requestsPerMin: 30,
        burstAllowed: 3
      }
    };
  }

  private get reqHeaders(): Record<string, string> {
    return {
      Cookie: `finvizStockScreenerToken=${this.apiKey}`,
      "User-Agent": "Mozilla/5.0 (compatible; inversions-app/1.0)"
    };
  }

  private async exportView(view: number, ticker: string): Promise<Record<string, string> | null> {
    try {
      const url = `${this.config.baseUrl}/export.ashx?v=${view}&t=${ticker}&auth=${this.apiKey}`;
      const res = await fetch(url, {
        headers: this.reqHeaders,
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) return null;
      const text = await res.text();
      return parseFinvizCsv(text);
    } catch {
      return null;
    }
  }

  private async fetchYahooCloses(ticker: string, rangeParam: string): Promise<number[]> {
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${rangeParam}&interval=1d&includeAdjustedClose=true`,
        { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) return [];
      const json = await res.json() as any;
      const adj: number[] =
        json?.chart?.result?.[0]?.indicators?.adjclose?.[0]?.adjclose?.filter((v: any) => v != null) ?? [];
      return [...adj].reverse(); // newest first
    } catch {
      return [];
    }
  }

  async fetch(ticker: string, lookbackDays: number = 252): Promise<DataSourceResult> {
    const sym = ticker.toUpperCase();
    console.log(`[FinvizDataSource] Fetching ${sym}`);

    const rangeParam = lookbackDays > 365 ? "2y" : "1y";

    const [overviewRes, financialRes, highlightsRes, closesRes] = await Promise.allSettled([
      this.exportView(111, sym),   // Company, Sector, Industry, Country, Market Cap, P/E, Price
      this.exportView(120, sym),   // P/S, P/B, PEG, EPS/Sales growth
      this.exportView(160, sym),   // ROE, ROA, Div Yield, Debt/Eq, Margins
      this.fetchYahooCloses(sym, rangeParam)
    ]);

    const ov = overviewRes.status === "fulfilled" ? overviewRes.value : null;
    const fin = financialRes.status === "fulfilled" ? financialRes.value : null;
    const hi = highlightsRes.status === "fulfilled" ? highlightsRes.value : null;
    const closes = closesRes.status === "fulfilled" ? closesRes.value : [];

    if (!ov && !fin && !hi) {
      return {
        success: false,
        error: `Finviz returned no data for ${sym}`,
        timestamp: new Date().toISOString()
      };
    }

    const now = new Date().toISOString();

    // Price & market data
    const currentPrice = toFloat(ov?.["Price"] ?? fin?.["Price"]);
    const marketCapM = toFloat(ov?.["Market Cap"] ?? fin?.["Market Cap"] ?? hi?.["Market Cap"]);
    const marketCap = marketCapM * 1_000_000; // Finviz reports in millions
    const volume = toFloat(ov?.["Volume"] ?? fin?.["Volume"]);

    // 52w range + avg volume from historical prices
    const prices252 = closes.slice(0, Math.min(252, closes.length));
    const price52High = prices252.length ? Math.max(...prices252) : currentPrice;
    const price52Low = prices252.length ? Math.min(...prices252) : currentPrice;
    const priceYearAgo = prices252[prices252.length - 1] ?? currentPrice;
    const change52wPct =
      priceYearAgo > 0
        ? Math.round(((currentPrice - priceYearAgo) / priceYearAgo) * 10000) / 100
        : 0;
    const annualVol = calculateHistoricalVolatility(closes, lookbackDays);

    // Financial ratios
    const peRatio = toFloat(ov?.["P/E"] ?? fin?.["P/E"]);
    const psRatio = toFloat(fin?.["P/S"]);
    const pbRatio = toFloat(fin?.["P/B"]);
    const roe = pctToFloat(hi?.["Return on Equity"]);
    const roa = pctToFloat(hi?.["Return on Assets"]);
    const grossMargin = pctToFloat(hi?.["Gross Margin"]);
    const operatingMargin = pctToFloat(hi?.["Operating Margin"]);
    const netMargin = pctToFloat(hi?.["Profit Margin"]);
    const debtToEquity = toFloat(hi?.["Total Debt/Equity"]);
    const divYieldPct = pctToFloat(hi?.["Dividend Yield"]);

    // EPS (derived: Price / P/E)
    const epsTTM = peRatio > 0 && currentPrice > 0 ? Math.round((currentPrice / peRatio) * 100) / 100 : 0;

    // Sales
    const salesGrowth5Y = pctToFloat(fin?.["Sales Growth Past 5 Years"]);

    // Sector/Industry
    const sector = ov?.["Sector"] ?? "";
    const industry = ov?.["Industry"] ?? "";
    const country = ov?.["Country"] ?? "";
    const companyName = ov?.["Company"] ?? sym;

    const populatedSections = [currentPrice, marketCap, peRatio, roe, divYieldPct, sector, annualVol].filter(Boolean).length;
    const completenessPercent = Math.round((populatedSections / 7) * 100);

    const data: FundamentalAnalysisData = {
      ticker: sym,
      companyName,
      metrics: {
        ...(marketCap > 0 ? { marketCap: { value: marketCap, currency: "USD", timestamp: now } } : {}),
        ...(salesGrowth5Y
          ? {
              sales: {
                annualRevenue: 0,
                quarterlyRevenue: 0,
                revenueGrowthPercent: salesGrowth5Y,
                timestamp: now
              }
            }
          : {}),
        priceHistory: {
          currentPrice,
          priceChange52WeekPercent: change52wPct,
          priceHigh52Week: price52High,
          priceLow52Week: price52Low,
          avgVolume10Day: volume,
          timestamp: now
        },
        volatility: {
          annualizedVolatility: annualVol,
          lookbackDays,
          calculationMethod: "historical_log_returns",
          timestamp: now
        },
        financialRatios: {
          roe,
          peRatio,
          pbRatio,
          psRatio,
          debtToEquity,
          timestamp: now
        },
        ...(epsTTM > 0 ? { eps: { eps: epsTTM, epsGrowthYoYPercent: 0, timestamp: now } } : {}),
        ...(divYieldPct > 0
          ? {
              dividend: {
                annualDividendPerShare: currentPrice > 0 ? Math.round(currentPrice * (divYieldPct / 100) * 100) / 100 : 0,
                dividendYieldPercent: divYieldPct,
                payoutRatio: 0,
                lastPaymentDate: now.split("T")[0],
                exDividendDate: now.split("T")[0],
                timestamp: now
              }
            }
          : {}),
        ...(sector ? { sector: { sector, industry, subIndustry: industry, timestamp: now } } : {}),
        ...(country ? { country: { isoCode: country, primaryListing: "NASDAQ", timestamp: now } } : {})
      },
      metadata: {
        sourceId: "finviz",
        fetchTimestamp: now,
        dataVersion: "elite_v1",
        assumptions: {
          volatilityCalculationMethod: "historical_log_returns",
          lookbackPeriod: lookbackDays,
          riskFreeRate: 4.5,
          marketIndexBench: "SPX"
        },
        quality: {
          completenessPercent,
          lastValidation: now
        }
      },
      auditTrail: {
        createdAt: now,
        lastUpdated: now
      }
    };

    return { success: true, data, timestamp: now, cost: 3, costMetric: "api_calls" };
  }

  validate(data: FundamentalAnalysisData): boolean {
    return !!(data.ticker && data.metrics.priceHistory && data.metadata.sourceId === "finviz");
  }

  async isHealthy(): Promise<boolean> {
    try {
      const rec = await this.exportView(111, "AAPL");
      return rec !== null && "Price" in rec;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// SimFin v3 DataSource
// ---------------------------------------------------------------------------

/**
 * SimFin API v3 compact response shape.
 * Each endpoint returns an array of companies.
 */
interface SimFinCompact {
  ticker: string;
  simId?: number;
  columns: string[];
  data: any[][];
}

/**
 * T004a: DataSource para SimFin v3
 *
 * Endpoints usados (en paralelo):
 *  - /companies/prices/compact   → precio, volumen, dividendo histórico
 *  - /companies/statements/compact?statement=pl  → income statement (revenue, EPS)
 *  - /companies/statements/compact?statement=bs  → balance sheet (equity, debt)
 *  - /companies/derived/compact  → PE, PB, PS, dividend yield, payout, ROE
 */
export class SimFinDataSource implements PluggableSource {
  config: DataSourceConfig;
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.SIMFIN_API_KEY ?? "";
    this.config = {
      id: "simfin",
      name: "SimFin",
      baseUrl: "https://backend.simfin.com/api/v3",
      apiKey: this.apiKey,
      rateLimit: {
        requestsPerMin: 50,
        burstAllowed: 5
      }
    };
  }

  private get headers(): Record<string, string> {
    return { Authorization: this.apiKey };
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T | null> {
    try {
      const qs = params ? "?" + new URLSearchParams(params) : "";
      const res = await fetch(`${this.config.baseUrl}${path}${qs}`, {
        headers: this.headers
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        console.warn(`[SimFinDataSource] ${path} → ${res.status}: ${msg.slice(0, 120)}`);
        return null;
      }
      return (await res.json()) as T;
    } catch (e) {
      console.warn(`[SimFinDataSource] fetch error ${path}:`, e);
      return null;
    }
  }

  async fetch(ticker: string, lookbackDays: number = 252): Promise<DataSourceResult> {
    const sym = ticker.toUpperCase();
    console.log(`[SimFinDataSource] Fetching ${sym} (lookback: ${lookbackDays}d)`);

    // Calculate date range for price history
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (lookbackDays + 20));
    const start = startDate.toISOString().split("T")[0];
    const end = endDate.toISOString().split("T")[0];

    const [pricesRes, plRes, bsRes, derivedRes] = await Promise.allSettled([
      this.get<SimFinCompact[]>("/companies/prices/compact", {
        ticker: sym,
        start,
        end,
        ratios: "true"
      }),
      this.get<SimFinCompact[]>("/companies/statements/compact", {
        ticker: sym,
        statement: "pl",
        period: "TTM"
      }),
      this.get<SimFinCompact[]>("/companies/statements/compact", {
        ticker: sym,
        statement: "bs",
        period: "TTM"
      }),
      this.get<SimFinCompact[]>("/companies/derived/compact", {
        ticker: sym,
        period: "TTM"
      })
    ]);

    const priceBlock = pricesRes.status === "fulfilled" ? pricesRes.value?.[0] : undefined;
    const plBlock = plRes.status === "fulfilled" ? plRes.value?.[0] : undefined;
    const bsBlock = bsRes.status === "fulfilled" ? bsRes.value?.[0] : undefined;
    const derivedBlock = derivedRes.status === "fulfilled" ? derivedRes.value?.[0] : undefined;

    if (!priceBlock?.data?.length) {
      return {
        success: false,
        error: `SimFin returned no price data for ${sym}. Verify email confirmation on simfin.com.`,
        timestamp: new Date().toISOString()
      };
    }

    const now = new Date().toISOString();
    const pCols = priceBlock.columns;
    const pRows = priceBlock.data; // newest first

    // Price fields
    const latestRow = pRows[0];
    const currentPrice: number = col(pCols, latestRow, "Adj. Close") ?? col(pCols, latestRow, "Close") ?? 0;
    const closePrices: number[] = pRows
      .map((r) => (col(pCols, r, "Adj. Close") ?? col(pCols, r, "Close")) as number)
      .filter((v) => v > 0);

    const avgVol10 =
      pRows
        .slice(0, 10)
        .map((r) => (col(pCols, r, "Volume") as number) ?? 0)
        .reduce((a, b) => a + b, 0) / Math.min(10, pRows.length);

    const prices252 = closePrices.slice(0, Math.min(252, closePrices.length));
    const price52High = prices252.length ? Math.max(...prices252) : currentPrice;
    const price52Low = prices252.length ? Math.min(...prices252) : currentPrice;
    const priceYearAgo = prices252[prices252.length - 1] ?? currentPrice;
    const change52wPct =
      priceYearAgo > 0
        ? Math.round(((currentPrice - priceYearAgo) / priceYearAgo) * 10000) / 100
        : 0;

    const annualVol = calculateHistoricalVolatility(closePrices, lookbackDays);

    // Income statement fields
    const plRow = plBlock?.data?.[0];
    const plCols = plBlock?.columns ?? [];
    const revenue: number | undefined = plRow ? col(plCols, plRow, "Revenue") : undefined;
    const epsDiluted: number | undefined = plRow ? col(plCols, plRow, "EPS Diluted") ?? col(plCols, plRow, "EPS (Diluted)") : undefined;
    const netIncome: number | undefined = plRow ? col(plCols, plRow, "Net Income") ?? col(plCols, plRow, "Net Income (Common)") : undefined;
    const shares: number | undefined = plRow ? col(plCols, plRow, "Shares (Diluted)") ?? col(plCols, plRow, "Shares (Basic)") : undefined;
    const plCurrency: string = plRow ? col(plCols, plRow, "Currency") ?? "USD" : "USD";

    // Balance sheet for debt/equity
    const bsRow = bsBlock?.data?.[0];
    const bsCols = bsBlock?.columns ?? [];
    const totalEquity: number | undefined = bsRow ? col(bsCols, bsRow, "Total Equity") : undefined;
    const totalLiabilities: number | undefined = bsRow ? col(bsCols, bsRow, "Total Liabilities") : undefined;
    const debtToEquity: number =
      totalEquity && totalLiabilities && totalEquity > 0
        ? Math.round((totalLiabilities / totalEquity) * 100) / 100
        : 0;

    // Market cap from shares × price
    const marketCap: number | undefined =
      shares && currentPrice > 0 ? shares * currentPrice : undefined;

    // Derived metrics (PE, PB, PS, ROE, dividend yield, payout)
    const dRow = derivedBlock?.data?.[0];
    const dCols = derivedBlock?.columns ?? [];
    const peRatio: number = dRow ? col(dCols, dRow, "P/E") ?? col(dCols, dRow, "Price to Earnings") ?? 0 : 0;
    const pbRatio: number = dRow ? col(dCols, dRow, "P/Book") ?? col(dCols, dRow, "Price to Book Value") ?? 0 : 0;
    const psRatio: number = dRow ? col(dCols, dRow, "P/Sales") ?? col(dCols, dRow, "Price to Sales") ?? 0 : 0;
    const roe: number = dRow ? (col(dCols, dRow, "Return on Equity") ?? 0) * 100 : 0;
    const divYield: number = dRow
      ? (col(dCols, dRow, "Dividend Yield") ?? col(dCols, dRow, "Dividend Yield %") ?? 0) * 100
      : 0;
    const payoutRatio: number = dRow ? col(dCols, dRow, "Payout Ratio(%)") ?? col(dCols, dRow, "Payout Ratio") ?? 0 : 0;
    const divPerShare: number = dRow ? col(dCols, dRow, "Div./Share") ?? col(dCols, dRow, "Dividend Per Share") ?? 0 : 0;

    // Dividend date from price data (last non-zero dividend row)
    const lastDivRow = pRows.find((r) => {
      const d = col(pCols, r, "Dividend");
      return d && d > 0;
    });
    const lastDivDate: string = lastDivRow
      ? (col(pCols, lastDivRow, "Date") as string) ?? now.split("T")[0]
      : now.split("T")[0];

    const populatedCount = [
      currentPrice,
      annualVol,
      revenue,
      epsDiluted,
      marketCap,
      peRatio || undefined,
      roe || undefined
    ].filter(Boolean).length;
    const completenessPercent = Math.round((populatedCount / 7) * 100);

    const data: FundamentalAnalysisData = {
      ticker: sym,
      companyName: sym,
      metrics: {
        ...(marketCap
          ? {
              marketCap: {
                value: marketCap,
                currency: plCurrency,
                timestamp: now
              }
            }
          : {}),
        ...(revenue !== undefined
          ? {
              sales: {
                annualRevenue: revenue,
                quarterlyRevenue: revenue / 4,
                revenueGrowthPercent: 0,
                timestamp: now
              }
            }
          : {}),
        priceHistory: {
          currentPrice,
          priceChange52WeekPercent: change52wPct,
          priceHigh52Week: price52High,
          priceLow52Week: price52Low,
          avgVolume10Day: avgVol10,
          timestamp: now
        },
        volatility: {
          annualizedVolatility: annualVol,
          lookbackDays,
          calculationMethod: "historical_log_returns",
          timestamp: now
        },
        ...(peRatio || pbRatio || psRatio || debtToEquity
          ? {
              financialRatios: {
                roe,
                peRatio,
                pbRatio,
                psRatio,
                debtToEquity,
                timestamp: now
              }
            }
          : {}),
        ...(epsDiluted !== undefined
          ? {
              eps: {
                eps: epsDiluted,
                epsGrowthYoYPercent: 0,
                timestamp: now
              }
            }
          : {}),
        ...(divPerShare || divYield
          ? {
              dividend: {
                annualDividendPerShare: divPerShare,
                dividendYieldPercent: divYield,
                payoutRatio,
                lastPaymentDate: lastDivDate,
                exDividendDate: lastDivDate,
                timestamp: now
              }
            }
          : {})
      },
      metadata: {
        sourceId: "simfin",
        fetchTimestamp: now,
        dataVersion: "v3",
        assumptions: {
          volatilityCalculationMethod: "historical_log_returns",
          lookbackPeriod: lookbackDays,
          riskFreeRate: 4.5,
          marketIndexBench: "SPX"
        },
        quality: {
          completenessPercent,
          lastValidation: now
        }
      }
    };

    return {
      success: true,
      data,
      timestamp: now,
      cost: 4,
      costMetric: "api_calls"
    };
  }

  validate(data: FundamentalAnalysisData): boolean {
    return !!(data.ticker && data.metrics.priceHistory && data.metadata.sourceId === "simfin");
  }

  async isHealthy(): Promise<boolean> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const d = yesterday.toISOString().split("T")[0];
      const res = await fetch(
        `${this.config.baseUrl}/companies/prices/compact?ticker=AAPL&start=${d}&end=${d}`,
        { headers: this.headers }
      );
      return res.ok;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Yahoo Finance fallback (no API key required)
// ---------------------------------------------------------------------------

interface YahooChartResult {
  chart: {
    result?: Array<{
      meta: {
        regularMarketPrice: number;
        regularMarketVolume: number;
        fiftyTwoWeekHigh: number;
        fiftyTwoWeekLow: number;
        currency: string;
        longName?: string;
        shortName?: string;
        exchangeName?: string;
      };
      timestamp: number[];
      indicators: {
        adjclose?: Array<{ adjclose: number[] }>;
        quote: Array<{ close: number[]; volume: number[] }>;
      };
    }>;
    error?: { code: string; description: string };
  };
}

/**
 * T004a: DataSource para Yahoo Finance (sin API key — fallback gratuito)
 * Usa solo el endpoint v8/chart que no requiere crumb/cookie.
 * Provee: precio actual, 52w high/low, volumen, nombre, volatilidad calculada.
 * Ratios (PE, ROE, etc.) no disponibles en tier gratuito desde 2024.
 */
export class YahooFinanceDataSource implements PluggableSource {
  config: DataSourceConfig;

  constructor() {
    this.config = {
      id: "yahoo_finance",
      name: "Yahoo Finance",
      baseUrl: "https://query1.finance.yahoo.com",
      rateLimit: {
        requestsPerMin: 30,
        burstAllowed: 3
      }
    };
  }

  private get headers(): Record<string, string> {
    return {
      "User-Agent": "Mozilla/5.0 (compatible; inversions-app/1.0)",
      Accept: "application/json"
    };
  }

  async fetch(ticker: string, lookbackDays: number = 252): Promise<DataSourceResult> {
    const sym = ticker.toUpperCase();
    console.log(`[YahooFinanceDataSource] Fetching ${sym}`);

    const rangeParam = lookbackDays > 365 ? "2y" : "1y";

    let chart: YahooChartResult | null = null;
    try {
      const res = await fetch(
        `${this.config.baseUrl}/v8/finance/chart/${sym}?range=${rangeParam}&interval=1d&includeAdjustedClose=true`,
        { headers: this.headers }
      );
      if (res.ok) chart = (await res.json()) as YahooChartResult;
    } catch {
      // handled below
    }

    const chartResult = chart?.chart?.result?.[0];
    if (!chartResult) {
      return {
        success: false,
        error: `Yahoo Finance returned no data for ${sym}`,
        timestamp: new Date().toISOString()
      };
    }

    const now = new Date().toISOString();
    const meta = chartResult.meta;

    const adjCloses: number[] =
      chartResult.indicators.adjclose?.[0]?.adjclose?.filter((v) => v != null) ??
      chartResult.indicators.quote[0]?.close?.filter((v) => v != null) ??
      [];
    // Yahoo returns oldest first — reverse for newest-first
    const closePrices = [...adjCloses].reverse();
    const volumes: number[] = [...(chartResult.indicators.quote[0]?.volume ?? [])].reverse();

    const currentPrice = meta.regularMarketPrice;
    const price52High = meta.fiftyTwoWeekHigh;
    const price52Low = meta.fiftyTwoWeekLow;
    const avgVol10 =
      volumes.slice(0, 10).reduce((a, b) => a + (b ?? 0), 0) / Math.min(10, volumes.length || 1);
    const priceYearAgo = closePrices[Math.min(251, closePrices.length - 1)] ?? currentPrice;
    const change52wPct =
      priceYearAgo > 0
        ? Math.round(((currentPrice - priceYearAgo) / priceYearAgo) * 10000) / 100
        : 0;
    const annualVol = calculateHistoricalVolatility(closePrices, lookbackDays);

    const data: FundamentalAnalysisData = {
      ticker: sym,
      companyName: meta.longName ?? meta.shortName ?? sym,
      metrics: {
        priceHistory: {
          currentPrice,
          priceChange52WeekPercent: change52wPct,
          priceHigh52Week: price52High,
          priceLow52Week: price52Low,
          avgVolume10Day: avgVol10,
          timestamp: now
        },
        volatility: {
          annualizedVolatility: annualVol,
          lookbackDays,
          calculationMethod: "historical_log_returns",
          timestamp: now
        }
      },
      metadata: {
        sourceId: "yahoo_finance",
        fetchTimestamp: now,
        dataVersion: "v8",
        assumptions: {
          volatilityCalculationMethod: "historical_log_returns",
          lookbackPeriod: lookbackDays,
          riskFreeRate: 4.5,
          marketIndexBench: "SPX"
        },
        quality: {
          completenessPercent: 40,
          lastValidation: now
        }
      }
    };

    return { success: true, data, timestamp: now, cost: 0, costMetric: "free" };
  }

  validate(data: FundamentalAnalysisData): boolean {
    return !!(data.ticker && data.metrics.priceHistory && data.metadata.sourceId === "yahoo_finance");
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(
        `${this.config.baseUrl}/v8/finance/chart/AAPL?range=1d&interval=1d`,
        { headers: this.headers }
      );
      return res.ok;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Financial Modeling Prep (FMP) DataSource
// ---------------------------------------------------------------------------

/**
 * DataSource para Financial Modeling Prep (FMP) usando endpoints /stable/
 * Endpoints:
 *  - /stable/profile           → precio, marketCap, beta, sector, divYield, 52w range
 *  - /stable/key-metrics-ttm   → ROE, PE, PB, PS y métricas de valuación
 *  - /stable/ratios-ttm        → márgenes (gross, operating, net)
 *  - /stable/historical-price-eod/light → precios históricos para volatilidad
 */
export class FMPDataSource implements PluggableSource {
  config: DataSourceConfig;
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.FMP_API_KEY ?? "";
    this.config = {
      id: "fmp",
      name: "Financial Modeling Prep",
      baseUrl: "https://financialmodelingprep.com",
      apiKey: this.apiKey,
      rateLimit: {
        requestsPerMin: 60,
        burstAllowed: 5
      }
    };
  }

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
    try {
      const qs = new URLSearchParams({ ...params, apikey: this.apiKey });
      const res = await fetch(`${this.config.baseUrl}${path}?${qs}`, {
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  async fetch(ticker: string, lookbackDays: number = 252): Promise<DataSourceResult> {
    const sym = ticker.toUpperCase();
    console.log(`[FMPDataSource] Fetching ${sym}`);

    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - (lookbackDays + 20) * 86_400_000).toISOString().split("T")[0];

    const [profileRes, metricsRes, ratiosRes, histRes] = await Promise.allSettled([
      this.get<any[]>("/stable/profile", { symbol: sym }),
      this.get<any[]>("/stable/key-metrics-ttm", { symbol: sym }),
      this.get<any[]>("/stable/ratios-ttm", { symbol: sym }),
      this.get<any[]>("/stable/historical-price-eod/light", { symbol: sym, from: startDate, to: endDate })
    ]);

    const profile = profileRes.status === "fulfilled" ? profileRes.value?.[0] : null;
    const metrics = metricsRes.status === "fulfilled" ? metricsRes.value?.[0] : null;
    const ratios = ratiosRes.status === "fulfilled" ? ratiosRes.value?.[0] : null;
    const hist: Array<{ date: string; price: number }> =
      histRes.status === "fulfilled" ? (histRes.value ?? []) : [];

    if (!profile) {
      return { success: false, error: `FMP returned no data for ${sym}`, timestamp: new Date().toISOString() };
    }

    const now = new Date().toISOString();
    const currentPrice: number = profile.price ?? 0;

    // Build price array (FMP returns newest first)
    const closePrices: number[] = hist.map((h) => h.price).filter((p) => p > 0);
    const prices252 = closePrices.slice(0, Math.min(252, closePrices.length));
    const price52High: number = profile.range ? parseFloat(String(profile.range).split("-")[1]) || currentPrice : currentPrice;
    const price52Low: number = profile.range ? parseFloat(String(profile.range).split("-")[0]) || currentPrice : currentPrice;
    const priceYearAgo = prices252[prices252.length - 1] ?? currentPrice;
    const change52wPct = priceYearAgo > 0
      ? Math.round(((currentPrice - priceYearAgo) / priceYearAgo) * 10000) / 100
      : 0;
    const annualVol = calculateHistoricalVolatility(closePrices, lookbackDays);

    const marketCap: number = profile.marketCap ?? 0;
    const beta: number = profile.beta ?? 0;
    const divYield: number = metrics?.dividendYieldPercentageTTM ?? (profile.lastDividend && currentPrice > 0
      ? Math.round((profile.lastDividend / currentPrice) * 10000) / 100
      : 0);

    const peRatio: number = metrics?.peRatioTTM ?? 0;
    const pbRatio: number = metrics?.pbRatioTTM ?? 0;
    const psRatio: number = metrics?.priceToSalesRatioTTM ?? 0;
    const roe: number = metrics?.roeTTM ? Math.round(metrics.roeTTM * 10000) / 100 : 0;
    const debtToEquity: number = metrics?.debtToEquityTTM ?? 0;
    const netMarginPct: number = ratios?.netProfitMarginTTM ? Math.round(ratios.netProfitMarginTTM * 10000) / 100 : 0;
    const grossMarginPct: number = ratios?.grossProfitMarginTTM ? Math.round(ratios.grossProfitMarginTTM * 10000) / 100 : 0;
    const operatingMarginPct: number = ratios?.operatingProfitMarginTTM ? Math.round(ratios.operatingProfitMarginTTM * 10000) / 100 : 0;

    const sector: string = profile.sector ?? "";
    const industry: string = profile.industry ?? "";
    const country: string = profile.country ?? "";
    const companyName: string = profile.companyName ?? sym;

    const populatedCount = [currentPrice, marketCap, peRatio, roe, beta, sector, annualVol].filter(Boolean).length;
    const completenessPercent = Math.round((populatedCount / 7) * 100);

    const data: FundamentalAnalysisData = {
      ticker: sym,
      companyName,
      metrics: {
        ...(marketCap > 0 ? { marketCap: { value: marketCap, currency: "USD", timestamp: now } } : {}),
        priceHistory: {
          currentPrice,
          priceChange52WeekPercent: change52wPct,
          priceHigh52Week: price52High,
          priceLow52Week: price52Low,
          avgVolume10Day: profile.averageVolume ?? profile.volume ?? 0,
          timestamp: now
        },
        volatility: {
          annualizedVolatility: annualVol,
          lookbackDays,
          calculationMethod: "historical_log_returns",
          timestamp: now
        },
        financialRatios: {
          roe,
          peRatio,
          pbRatio,
          psRatio,
          debtToEquity,
          timestamp: now
        },
        ...(beta > 0 ? { beta: { value: beta, confidenceLevel: "HIGH", calculationMethod: "provider", timestamp: now } } : {}),
        ...(divYield > 0 ? {
          dividend: {
            annualDividendPerShare: profile.lastDividend ?? 0,
            dividendYieldPercent: divYield,
            payoutRatio: 0,
            lastPaymentDate: now.split("T")[0],
            exDividendDate: now.split("T")[0],
            timestamp: now
          }
        } : {}),
        ...(sector ? { sector: { sector, industry, subIndustry: industry, timestamp: now } } : {}),
        ...(country ? { country: { isoCode: country, primaryListing: profile.exchange ?? "NASDAQ", timestamp: now } } : {})
      },
      metadata: {
        sourceId: "fmp",
        fetchTimestamp: now,
        dataVersion: "stable_v1",
        assumptions: {
          volatilityCalculationMethod: "historical_log_returns",
          lookbackPeriod: lookbackDays,
          riskFreeRate: 4.5,
          marketIndexBench: "SPX"
        },
        quality: {
          completenessPercent,
          lastValidation: now
        }
      },
      auditTrail: { createdAt: now, lastUpdated: now }
    };

    return { success: true, data, timestamp: now, cost: 3, costMetric: "api_calls" };
  }

  validate(data: FundamentalAnalysisData): boolean {
    return !!(data.ticker && data.metrics.priceHistory && data.metadata.sourceId === "fmp");
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await this.get<any[]>("/stable/profile", { symbol: "AAPL" });
      return Array.isArray(res) && res.length > 0 && "price" in res[0];
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Finnhub DataSource
// ---------------------------------------------------------------------------

/**
 * DataSource para Finnhub
 * Endpoints:
 *  - /api/v1/stock/profile2        → companyName, country, industry, marketCap
 *  - /api/v1/stock/metric?metric=all → beta, 52w high/low, ROE, PE, márgenes
 *  - /api/v1/quote                 → precio actual, volumen
 *  - /api/v1/stock/candle          → precios históricos para volatilidad
 */
export class FinnhubDataSource implements PluggableSource {
  config: DataSourceConfig;
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.FINNHUB_API_KEY ?? "";
    this.config = {
      id: "finnhub",
      name: "Finnhub",
      baseUrl: "https://finnhub.io",
      apiKey: this.apiKey,
      rateLimit: {
        requestsPerMin: 60,
        burstAllowed: 5
      }
    };
  }

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
    try {
      const qs = new URLSearchParams({ ...params, token: this.apiKey });
      const res = await fetch(`${this.config.baseUrl}${path}?${qs}`, {
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  async fetch(ticker: string, lookbackDays: number = 252): Promise<DataSourceResult> {
    const sym = ticker.toUpperCase();
    console.log(`[FinnhubDataSource] Fetching ${sym}`);

    const toUnix = Math.floor(Date.now() / 1000);
    const fromUnix = toUnix - (lookbackDays + 20) * 86400;

    const [profileRes, metricsRes, quoteRes, candleRes] = await Promise.allSettled([
      this.get<any>("/api/v1/stock/profile2", { symbol: sym }),
      this.get<any>("/api/v1/stock/metric", { symbol: sym, metric: "all" }),
      this.get<any>("/api/v1/quote", { symbol: sym }),
      this.get<any>("/api/v1/stock/candle", {
        symbol: sym,
        resolution: "D",
        from: String(fromUnix),
        to: String(toUnix)
      })
    ]);

    const profile = profileRes.status === "fulfilled" ? profileRes.value : null;
    const metricsData = metricsRes.status === "fulfilled" ? metricsRes.value?.metric : null;
    const quote = quoteRes.status === "fulfilled" ? quoteRes.value : null;
    const candle = candleRes.status === "fulfilled" ? candleRes.value : null;

    if (!quote?.c) {
      return { success: false, error: `Finnhub returned no quote for ${sym}`, timestamp: new Date().toISOString() };
    }

    const now = new Date().toISOString();
    const currentPrice: number = quote.c ?? 0;

    // Build close prices from candle data (newest first)
    const closePrices: number[] = Array.isArray(candle?.c)
      ? [...candle.c].reverse().filter((v: number) => v > 0)
      : [];
    const annualVol = calculateHistoricalVolatility(closePrices, lookbackDays);

    const price52High: number = metricsData?.["52WeekHigh"] ?? currentPrice;
    const price52Low: number = metricsData?.["52WeekLow"] ?? currentPrice;
    const change52wPct: number = metricsData?.["52WeekPriceReturnDaily"] ?? 0;

    const marketCap: number = profile?.marketCapitalization ? profile.marketCapitalization * 1_000_000 : 0;
    const beta: number = metricsData?.beta ?? 0;

    const peRatio: number = metricsData?.peNormalizedAnnual ?? metricsData?.peTTM ?? 0;
    const pbRatio: number = metricsData?.pbAnnual ?? metricsData?.pbQuarterly ?? 0;
    const psRatio: number = metricsData?.psAnnual ?? metricsData?.psTTM ?? 0;
    const roe: number = metricsData?.roeRfy ? Math.round(metricsData.roeRfy * 100) / 100 : 0;
    const netMarginPct: number = metricsData?.netProfitMarginAnnual ?? metricsData?.netProfitMarginTTM ?? 0;

    const divYield: number = metricsData?.dividendYieldIndicatedAnnual
      ? Math.round(metricsData.dividendYieldIndicatedAnnual * 10000) / 100
      : 0;

    const sector: string = profile?.finnhubIndustry ?? "";
    const companyName: string = profile?.name ?? sym;
    const country: string = profile?.country ?? "";

    const populatedCount = [currentPrice, marketCap, peRatio || undefined, roe || undefined, beta || undefined, sector, annualVol].filter(Boolean).length;
    const completenessPercent = Math.round((populatedCount / 7) * 100);

    const data: FundamentalAnalysisData = {
      ticker: sym,
      companyName,
      metrics: {
        ...(marketCap > 0 ? { marketCap: { value: marketCap, currency: "USD", timestamp: now } } : {}),
        priceHistory: {
          currentPrice,
          priceChange52WeekPercent: change52wPct,
          priceHigh52Week: price52High,
          priceLow52Week: price52Low,
          avgVolume10Day: metricsData?.["10DayAverageTradingVolume"] ? metricsData["10DayAverageTradingVolume"] * 1_000_000 : 0,
          timestamp: now
        },
        volatility: {
          annualizedVolatility: annualVol > 0 ? annualVol : (metricsData?.["3MonthADReturnStd"] ?? 0),
          lookbackDays,
          calculationMethod: "historical_log_returns",
          timestamp: now
        },
        financialRatios: {
          roe,
          peRatio,
          pbRatio,
          psRatio,
          debtToEquity: metricsData?.totalDebt2TotalEquityAnnual ?? metricsData?.totalDebt2TotalEquityQuarterly ?? 0,
          timestamp: now
        },
        ...(beta > 0 ? { beta: { value: beta, confidenceLevel: "HIGH", calculationMethod: "provider", timestamp: now } } : {}),
        ...(divYield > 0 ? {
          dividend: {
            annualDividendPerShare: metricsData?.dividendPerShareAnnual ?? 0,
            dividendYieldPercent: divYield,
            payoutRatio: 0,
            lastPaymentDate: now.split("T")[0],
            exDividendDate: now.split("T")[0],
            timestamp: now
          }
        } : {}),
        ...(sector ? { sector: { sector, industry: sector, subIndustry: sector, timestamp: now } } : {}),
        ...(country ? { country: { isoCode: country, primaryListing: profile?.exchange ?? "NASDAQ", timestamp: now } } : {})
      },
      metadata: {
        sourceId: "finnhub",
        fetchTimestamp: now,
        dataVersion: "v1",
        assumptions: {
          volatilityCalculationMethod: "historical_log_returns",
          lookbackPeriod: lookbackDays,
          riskFreeRate: 4.5,
          marketIndexBench: "SPX"
        },
        quality: {
          completenessPercent,
          lastValidation: now
        }
      },
      auditTrail: { createdAt: now, lastUpdated: now }
    };

    return { success: true, data, timestamp: now, cost: 2, costMetric: "api_calls" };
  }

  validate(data: FundamentalAnalysisData): boolean {
    return !!(data.ticker && data.metrics.priceHistory && data.metadata.sourceId === "finnhub");
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await this.get<any>("/api/v1/quote", { symbol: "AAPL" });
      return res !== null && typeof res.c === "number";
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// FundamentalDataService
// ---------------------------------------------------------------------------

export interface CacheEntry {
  data: FundamentalAnalysisData;
  timestamp: string;
  ttlSeconds: number;
}

export class FundamentalDataService {
  private sources: PluggableSource[];
  private supabaseClient?: SupabaseClient;
  private requestTimestamps: Map<string, number[]> = new Map();

  constructor(supabaseClient?: SupabaseClient) {
    this.supabaseClient = supabaseClient;

    // Priority: FMP → Finnhub → SimFin → Finviz → Yahoo Finance
    this.sources = [
      new FMPDataSource(process.env.FMP_API_KEY),
      new FinnhubDataSource(process.env.FINNHUB_API_KEY),
      new SimFinDataSource(process.env.SIMFIN_API_KEY),
      new FinvizDataSource(process.env.FINVIZ_API_KEY),
      new YahooFinanceDataSource()
    ];

    console.log(`[FundamentalDataService] Initialized with ${this.sources.length} data sources`);
  }

  /**
   * T004c: Rate limiter por fuente
   */
  private async checkRateLimit(sourceId: string, maxRequests: number): Promise<boolean> {
    const now = Date.now();
    const windowMs = 60 * 1000;
    const key = `rate_limit:${sourceId}`;
    const timestamps = this.requestTimestamps.get(key) ?? [];
    const recent = timestamps.filter((ts) => now - ts < windowMs);

    if (recent.length >= maxRequests) {
      const backoffMs = Math.min(1000 * Math.pow(2, recent.length - maxRequests + 1), 30000);
      console.warn(`[FundamentalDataService] Rate limit ${sourceId}. Backoff: ${backoffMs}ms`);
      return false;
    }

    recent.push(now);
    this.requestTimestamps.set(key, recent);
    return true;
  }

  /**
   * T004b: Caché Supabase con TTL (precio 5min, ratios 1h)
   */
  private async getFromCache(ticker: string): Promise<CacheEntry | null> {
    if (!this.supabaseClient) return null;

    try {
      const { data, error } = await this.supabaseClient
        .from("fundamental_data_cache")
        .select("*")
        .eq("ticker", ticker)
        .single();

      if (error || !data) return null;

      const cachedData = data as any;
      const age = (Date.now() - new Date(cachedData.cached_at).getTime()) / 1000;
      const ttlSeconds = cachedData.data.metrics?.priceHistory ? 300 : 3600;

      if (age > ttlSeconds) {
        console.log(`[FundamentalDataService] Cache expired for ${ticker} (age: ${age}s)`);
        return null;
      }

      return { data: cachedData.data, timestamp: cachedData.cached_at, ttlSeconds };
    } catch (error) {
      console.warn(`[FundamentalDataService] Cache fetch error for ${ticker}:`, error);
      return null;
    }
  }

  /**
   * T004d: Fallback chain with optional source selection.
   * If sourceId is provided, only that source is tried (no fallback, no cache bypass).
   */
  async fetch(ticker: string, lookbackDays: number = 252, sourceId?: string): Promise<DataSourceResult> {
    console.log(`[FundamentalDataService] Fetching ${ticker}${sourceId ? ` via ${sourceId}` : ""}...`);

    // If a specific source is requested, use it directly (skip cache)
    if (sourceId) {
      const source = this.sources.find((s) => s.config.id === sourceId);
      if (!source) {
        return { success: false, error: `Unknown source: ${sourceId}`, timestamp: new Date().toISOString() };
      }
      const result = await source.fetch(ticker, lookbackDays);
      if (result.success && result.data && this.supabaseClient) {
        await this.cacheData(ticker, result.data);
      }
      return result;
    }

    const cachedEntry = await this.getFromCache(ticker);
    if (cachedEntry) {
      console.log(`[FundamentalDataService] Cache HIT for ${ticker}`);
      return {
        success: true,
        data: cachedEntry.data,
        timestamp: new Date().toISOString(),
        cost: 0,
        costMetric: "cache"
      };
    }

    for (const source of this.sources) {
      const canProceed = await this.checkRateLimit(
        source.config.id,
        source.config.rateLimit.requestsPerMin
      );
      if (!canProceed) continue;

      const fetchStart = Date.now();
      const result = await source.fetch(ticker, lookbackDays);
      const fetchDuration = Date.now() - fetchStart;

      console.log(
        `[FundamentalDataService] ${source.config.id}: ${result.success ? "OK" : "FAIL"} (${fetchDuration}ms)`
      );

      if (result.success && result.data) {
        if (this.supabaseClient) await this.cacheData(ticker, result.data);

        await this.auditLog({
          action: "data_fetched",
          ticker,
          source: source.config.id,
          success: true,
          durationMs: fetchDuration,
          cost: result.cost ?? 0,
          costMetric: result.costMetric ?? "unknown"
        });

        return result;
      }
    }

    console.log(`[FundamentalDataService] All sources failed. Attempting stale cache...`);
    const staleEntry = await this.getStaleCache(ticker);

    if (staleEntry) {
      await this.auditLog({
        action: "stale_cache_served",
        ticker,
        source: "cache",
        success: true,
        ageSeconds: Math.floor((Date.now() - new Date(staleEntry.timestamp).getTime()) / 1000)
      });

      return {
        success: true,
        data: staleEntry.data,
        timestamp: new Date().toISOString(),
        cost: 0,
        costMetric: "stale_cache"
      };
    }

    return {
      success: false,
      error: `All data sources failed for ${ticker} and no cache available`,
      timestamp: new Date().toISOString()
    };
  }

  private async cacheData(ticker: string, data: FundamentalAnalysisData): Promise<void> {
    if (!this.supabaseClient) return;
    try {
      await this.supabaseClient.from("fundamental_data_cache").upsert({
        ticker,
        data,
        cached_at: new Date().toISOString()
      });
    } catch (error) {
      console.warn(`[FundamentalDataService] Cache write error for ${ticker}:`, error);
    }
  }

  private async getStaleCache(ticker: string): Promise<CacheEntry | null> {
    if (!this.supabaseClient) return null;
    try {
      const { data, error } = await this.supabaseClient
        .from("fundamental_data_cache")
        .select("*")
        .eq("ticker", ticker)
        .single();

      if (error || !data) return null;
      return {
        data: data.data as FundamentalAnalysisData,
        timestamp: data.cached_at,
        ttlSeconds: -1
      };
    } catch (error) {
      console.warn(`[FundamentalDataService] Stale cache fetch error:`, error);
      return null;
    }
  }

  /** T004e: Auditoría */
  private async auditLog(entry: Record<string, any>): Promise<void> {
    if (!this.supabaseClient) {
      console.log("[FundamentalDataService] Audit:", entry);
      return;
    }
    try {
      await this.supabaseClient.from("audit_trail").insert({
        action: entry.action,
        details: entry,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn("[FundamentalDataService] Audit log error:", error);
    }
  }

  async getSourceHealth(): Promise<Array<{ sourceId: string; healthy: boolean }>> {
    return Promise.all(
      this.sources.map(async (source) => ({
        sourceId: source.config.id,
        healthy: await source.isHealthy()
      }))
    );
  }
}
