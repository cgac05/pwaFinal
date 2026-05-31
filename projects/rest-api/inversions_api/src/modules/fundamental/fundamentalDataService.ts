// FIC: Real fundamental data service with Yahoo/FMP/SEC sources. (EN)
// FIC: Servicio real de datos fundamentales con fuentes Yahoo/FMP/SEC. (ES)

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FundamentalAnalysisData } from "./fundamentalSourceContract";
import { fetchYahooOhlc } from "../institutional/yahooChartParser";
import { YAHOO_USER_AGENT } from "../institutional/yahooCrumbSession";

type FundamentalFetchResult = {
  success: boolean;
  data?: FundamentalAnalysisData;
  error?: string;
};

type NumberLike = number | { raw?: number; fmt?: string; longFmt?: string } | null | undefined;

interface YahooQuoteSummaryResult {
  price?: {
    longName?: string;
    shortName?: string;
    regularMarketPrice?: NumberLike;
    marketCap?: NumberLike;
    currency?: string;
    quoteSourceName?: string;
  };
  summaryDetail?: {
    dividendYield?: NumberLike;
    trailingPE?: NumberLike;
    beta?: NumberLike;
    fiftyTwoWeekHigh?: NumberLike;
    fiftyTwoWeekLow?: NumberLike;
    priceToSalesTrailing12Months?: NumberLike;
  };
  defaultKeyStatistics?: {
    priceToBook?: NumberLike;
    trailingEps?: NumberLike;
    earningsQuarterlyGrowth?: NumberLike;
  };
  financialData?: {
    returnOnEquity?: NumberLike;
    debtToEquity?: NumberLike;
    totalRevenue?: NumberLike;
    revenueGrowth?: NumberLike;
    currentPrice?: NumberLike;
  };
  assetProfile?: {
    sector?: string;
    industry?: string;
    country?: string;
    fullTimeEmployees?: number;
  };
}

interface FmpProfile {
  symbol?: string;
  companyName?: string;
  price?: number;
  mktCap?: number;
  currency?: string;
  sector?: string;
  industry?: string;
  country?: string;
  beta?: number;
  volAvg?: number;
  lastDiv?: number;
  range?: string;
  fullTimeEmployees?: string;
}

interface FmpRatios {
  peRatioTTM?: number;
  priceToBookRatioTTM?: number;
  priceToSalesRatioTTM?: number;
  returnOnEquityTTM?: number;
  debtEquityRatioTTM?: number;
  dividendYielTTM?: number;
  dividendYieldTTM?: number;
}

interface FmpIncome {
  revenue?: number;
  eps?: number;
}

interface YahooChartSnapshot {
  meta: {
    currency?: string;
    regularMarketPrice?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    longName?: string;
    shortName?: string;
    exchangeName?: string;
  };
  closes: number[];
}

interface SecTickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

interface SecFactUnit {
  form?: string;
  fp?: string;
  fy?: number;
  filed?: string;
  end?: string;
  val?: number;
}

interface SecFacts {
  facts?: {
    "us-gaap"?: Record<string, { units?: Record<string, SecFactUnit[]> }>;
    dei?: Record<string, { units?: Record<string, SecFactUnit[]> }>;
  };
}

interface SecFundamentalSnapshot {
  companyName?: string;
  annualRevenue?: number;
  revenueGrowthPercent?: number;
  eps?: number;
  epsGrowthYoYPercent?: number;
  roe?: number;
  debtToEquity?: number;
  peRatio?: number;
  pbRatio?: number;
  psRatio?: number;
}

const SEC_USER_AGENT =
  process.env.EDGAR_USER_AGENT ?? "InversionsPWA/1.0 contact@example.com";

let secTickerCache: Map<string, SecTickerEntry> | null = null;

function asNumber(value: NumberLike): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && typeof value.raw === "number" && Number.isFinite(value.raw)) {
    return value.raw;
  }
  return undefined;
}

function percentFromRatio(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.abs(value) <= 1 ? value * 100 : value;
}

function parseRange(range: string | undefined): { low?: number; high?: number } {
  if (!range) return {};
  const [low, high] = range.split("-").map((part) => Number(part.trim()));
  return {
    low: Number.isFinite(low) ? low : undefined,
    high: Number.isFinite(high) ? high : undefined,
  };
}

function annualizedVolatilityFromCloses(closes: number[], lookbackDays: number): number | undefined {
  const window = closes.slice(-Math.max(2, lookbackDays));
  if (window.length < 2) return undefined;

  const returns: number[] = [];
  for (let index = 1; index < window.length; index++) {
    const previous = window[index - 1];
    const current = window[index];
    if (previous > 0 && current > 0) {
      returns.push(Math.log(current / previous));
    }
  }
  if (returns.length < 2) return undefined;

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  return Math.round(Math.sqrt(variance) * Math.sqrt(252) * 10_000) / 100;
}

function latestAnnualFact(
  facts: SecFacts,
  concepts: string[],
  units: string[]
): SecFactUnit | undefined {
  const gaap = facts.facts?.["us-gaap"];
  if (!gaap) return undefined;

  const rows = concepts.flatMap((concept) => {
    const byUnit = gaap[concept]?.units;
    if (!byUnit) return [] as SecFactUnit[];
    return units.flatMap((unit) => byUnit[unit] ?? []);
  });

  return rows
    .filter((row) => typeof row.val === "number" && row.form === "10-K")
    .sort((a, b) => {
      const filed = String(b.filed ?? "").localeCompare(String(a.filed ?? ""));
      if (filed !== 0) return filed;
      return String(b.end ?? "").localeCompare(String(a.end ?? ""));
    })[0];
}

function lastTwoAnnualFacts(
  facts: SecFacts,
  concepts: string[],
  units: string[]
): SecFactUnit[] {
  const gaap = facts.facts?.["us-gaap"];
  if (!gaap) return [];

  const rows = concepts.flatMap((concept) => {
    const byUnit = gaap[concept]?.units;
    if (!byUnit) return [] as SecFactUnit[];
    return units.flatMap((unit) => byUnit[unit] ?? []);
  });

  return rows
    .filter((row) => typeof row.val === "number" && row.form === "10-K")
    .sort((a, b) => String(b.filed ?? "").localeCompare(String(a.filed ?? "")))
    .slice(0, 2);
}

async function getSecTickerMap(): Promise<Map<string, SecTickerEntry> | null> {
  if (secTickerCache) return secTickerCache;

  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), 10_000);
  try {
    const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
      headers: { "User-Agent": SEC_USER_AGENT, Accept: "application/json" },
      signal: ac.signal,
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as Record<string, SecTickerEntry>;
    secTickerCache = new Map(
      Object.values(payload).map((entry) => [entry.ticker.toUpperCase(), entry])
    );
    return secTickerCache;
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}

async function fetchSecFacts(ticker: string): Promise<SecFacts | null> {
  const tickers = await getSecTickerMap();
  const entry = tickers?.get(ticker);
  if (!entry) return null;

  const cik = String(entry.cik_str).padStart(10, "0");
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), 10_000);
  try {
    const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
      headers: { "User-Agent": SEC_USER_AGENT, Accept: "application/json" },
      signal: ac.signal,
    });
    if (!res.ok) return null;
    const facts = (await res.json()) as SecFacts;
    return { ...facts, facts: facts.facts };
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}

async function fetchFromSec(
  ticker: string,
  currentPrice?: number,
  marketCap?: number
): Promise<SecFundamentalSnapshot | null> {
  const tickers = await getSecTickerMap();
  const entry = tickers?.get(ticker);
  const facts = await fetchSecFacts(ticker);
  if (!facts) return null;

  const revenueRows = lastTwoAnnualFacts(
    facts,
    ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"],
    ["USD"]
  );
  const revenue = revenueRows[0]?.val;
  const previousRevenue = revenueRows[1]?.val;
  const netIncome = latestAnnualFact(facts, ["NetIncomeLoss"], ["USD"])?.val;
  const equity = latestAnnualFact(facts, ["StockholdersEquity"], ["USD"])?.val;
  const longDebt =
    (latestAnnualFact(facts, ["LongTermDebtAndFinanceLeaseObligationsCurrent", "LongTermDebtCurrent"], ["USD"])?.val ?? 0) +
    (latestAnnualFact(facts, ["LongTermDebtAndFinanceLeaseObligationsNoncurrent", "LongTermDebtNoncurrent"], ["USD"])?.val ?? 0);
  const epsRows = lastTwoAnnualFacts(facts, ["EarningsPerShareDiluted"], ["USD/shares"]);
  const eps = epsRows[0]?.val;
  const previousEps = epsRows[1]?.val;

  const derivedMarketCap =
    marketCap ??
    (currentPrice && latestAnnualFact(facts, ["EntityCommonStockSharesOutstanding"], ["shares"])?.val
      ? currentPrice * latestAnnualFact(facts, ["EntityCommonStockSharesOutstanding"], ["shares"])!.val!
      : undefined);

  return {
    companyName: entry?.title,
    annualRevenue: revenue,
    revenueGrowthPercent:
      revenue !== undefined && previousRevenue && previousRevenue !== 0
        ? ((revenue - previousRevenue) / Math.abs(previousRevenue)) * 100
        : undefined,
    eps,
    epsGrowthYoYPercent:
      eps !== undefined && previousEps && previousEps !== 0
        ? ((eps - previousEps) / Math.abs(previousEps)) * 100
        : undefined,
    roe:
      netIncome !== undefined && equity && equity !== 0
        ? (netIncome / equity) * 100
        : undefined,
    debtToEquity: equity && equity !== 0 && longDebt > 0 ? longDebt / equity : undefined,
    peRatio: currentPrice && eps && eps > 0 ? currentPrice / eps : undefined,
    pbRatio: derivedMarketCap && equity && equity > 0 ? derivedMarketCap / equity : undefined,
    psRatio: derivedMarketCap && revenue && revenue > 0 ? derivedMarketCap / revenue : undefined,
  };
}

async function fetchYahooSummary(ticker: string): Promise<YahooQuoteSummaryResult | null> {
  const modules = [
    "price",
    "summaryDetail",
    "defaultKeyStatistics",
    "financialData",
    "assetProfile",
  ].join(",");

  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    const url = `https://${host}/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}`;
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), 10_000);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": YAHOO_USER_AGENT,
          Accept: "application/json",
        },
        signal: ac.signal,
      });
      if (!res.ok) continue;
      const payload = (await res.json()) as {
        quoteSummary?: { result?: YahooQuoteSummaryResult[]; error?: unknown };
      };
      const result = payload.quoteSummary?.result?.[0];
      if (result) return result;
    } catch {
      // try next host
    } finally {
      clearTimeout(tid);
    }
  }
  return null;
}

async function fetchYahooChartSnapshot(ticker: string): Promise<YahooChartSnapshot | null> {
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y`;
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), 10_000);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": YAHOO_USER_AGENT,
          Accept: "application/json",
        },
        signal: ac.signal,
      });
      if (!res.ok) continue;
      const payload = (await res.json()) as {
        chart?: {
          result?: Array<{
            meta?: YahooChartSnapshot["meta"];
            indicators?: { quote?: Array<{ close?: Array<number | null> }> };
          }>;
          error?: unknown;
        };
      };
      const result = payload.chart?.result?.[0];
      if (!result || payload.chart?.error) continue;
      const closes =
        result.indicators?.quote?.[0]?.close?.filter(
          (close): close is number => typeof close === "number" && Number.isFinite(close)
        ) ?? [];
      if (result.meta && closes.length > 0) {
        return { meta: result.meta, closes };
      }
    } catch {
      // try next host
    } finally {
      clearTimeout(tid);
    }
  }
  return null;
}

async function fetchFromYahoo(ticker: string, lookbackDays: number): Promise<FundamentalAnalysisData | null> {
  const [summary, chartSnapshot, candles] = await Promise.all([
    fetchYahooSummary(ticker),
    fetchYahooChartSnapshot(ticker),
    fetchYahooOhlc(ticker, "1d").catch(() => null),
  ]);

  if (!summary && !chartSnapshot) return null;

  const closes =
    candles?.map((candle) => candle.close).filter((close) => Number.isFinite(close)) ??
    chartSnapshot?.closes ??
    [];
  const latestClose = closes.at(-1);
  const firstClose = closes.length > 1 ? closes[Math.max(0, closes.length - Math.min(closes.length, lookbackDays))] : undefined;
  const currentPrice =
    asNumber(summary?.financialData?.currentPrice) ??
    asNumber(summary?.price?.regularMarketPrice) ??
    chartSnapshot?.meta.regularMarketPrice ??
    latestClose;
  const high52 = asNumber(summary?.summaryDetail?.fiftyTwoWeekHigh) ?? chartSnapshot?.meta.fiftyTwoWeekHigh;
  const low52 = asNumber(summary?.summaryDetail?.fiftyTwoWeekLow) ?? chartSnapshot?.meta.fiftyTwoWeekLow;
  const change52 =
    currentPrice !== undefined && firstClose && firstClose > 0
      ? ((currentPrice - firstClose) / firstClose) * 100
      : undefined;

  if (currentPrice === undefined && asNumber(summary?.price?.marketCap) === undefined) return null;

  const marketCap = asNumber(summary?.price?.marketCap);
  const sec = await fetchFromSec(ticker, currentPrice, marketCap).catch(() => null);

  return {
    companyName:
      summary?.price?.longName ??
      summary?.price?.shortName ??
      sec?.companyName ??
      chartSnapshot?.meta.longName ??
      chartSnapshot?.meta.shortName ??
      ticker,
    metadata: {
      sourceId: `${summary ? "yahoo" : "yahoo_chart"}${sec ? "+sec" : ""}`,
      dataVersion: summary ? "yahoo-quoteSummary-v10" : "yahoo-chart-v8",
      assumptions: { volatilityCalculationMethod: candles ? "historical-log-returns-yahoo-chart" : "unavailable" },
    },
    metrics: {
      priceHistory: {
        currentPrice,
        priceHigh52Week: high52,
        priceLow52Week: low52,
        priceChange52WeekPercent: change52,
      },
      marketCap: { value: marketCap, currency: summary?.price?.currency ?? chartSnapshot?.meta.currency ?? "USD" },
      sector: { sector: summary?.assetProfile?.sector, industry: summary?.assetProfile?.industry },
      financialRatios: {
        peRatio: asNumber(summary?.summaryDetail?.trailingPE) ?? sec?.peRatio,
        pbRatio: asNumber(summary?.defaultKeyStatistics?.priceToBook) ?? sec?.pbRatio,
        psRatio: asNumber(summary?.summaryDetail?.priceToSalesTrailing12Months) ?? sec?.psRatio,
        roe: percentFromRatio(asNumber(summary?.financialData?.returnOnEquity)) ?? sec?.roe,
        debtToEquity: asNumber(summary?.financialData?.debtToEquity) ?? sec?.debtToEquity,
      },
      eps: {
        eps: asNumber(summary?.defaultKeyStatistics?.trailingEps) ?? sec?.eps,
        epsGrowthYoYPercent: percentFromRatio(asNumber(summary?.defaultKeyStatistics?.earningsQuarterlyGrowth)) ?? sec?.epsGrowthYoYPercent,
      },
      dividend: {
        dividendYieldPercent: percentFromRatio(asNumber(summary?.summaryDetail?.dividendYield)),
      },
      volatility: {
        annualizedVolatility: annualizedVolatilityFromCloses(closes, lookbackDays),
        lookbackDays,
      },
      beta: {
        value: asNumber(summary?.summaryDetail?.beta),
        confidenceLevel: asNumber(summary?.summaryDetail?.beta) === undefined ? "unavailable" : "market",
      },
      sales: {
        annualRevenue: asNumber(summary?.financialData?.totalRevenue) ?? sec?.annualRevenue,
        revenueGrowthPercent: percentFromRatio(asNumber(summary?.financialData?.revenueGrowth)) ?? sec?.revenueGrowthPercent,
      },
      employees: { count: summary?.assetProfile?.fullTimeEmployees },
      country: { primaryListing: summary?.assetProfile?.country ?? chartSnapshot?.meta.exchangeName },
    },
  };
}

async function fmpGet<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return null;

  const url = new URL(`https://financialmodelingprep.com/stable/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("apikey", apiKey);

  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}

async function fetchFromFmp(ticker: string, lookbackDays: number): Promise<FundamentalAnalysisData | null> {
  const [profileRows, ratioRows, incomeRows] = await Promise.all([
    fmpGet<FmpProfile[]>("profile", { symbol: ticker }),
    fmpGet<FmpRatios[]>("ratios-ttm", { symbol: ticker }),
    fmpGet<FmpIncome[]>("income-statement", { symbol: ticker, limit: "2" }),
  ]);

  const profile = Array.isArray(profileRows) ? profileRows[0] : undefined;
  if (!profile) return null;

  const ratios = Array.isArray(ratioRows) ? ratioRows[0] : undefined;
  const latestIncome = Array.isArray(incomeRows) ? incomeRows[0] : undefined;
  const previousIncome = Array.isArray(incomeRows) ? incomeRows[1] : undefined;
  const range = parseRange(profile.range);
  const revenueGrowth =
    latestIncome?.revenue && previousIncome?.revenue
      ? ((latestIncome.revenue - previousIncome.revenue) / Math.abs(previousIncome.revenue)) * 100
      : undefined;

  return {
    companyName: profile.companyName ?? ticker,
    metadata: {
      sourceId: "fmp",
      dataVersion: "fmp-stable",
      assumptions: { volatilityCalculationMethod: "fmp-profile-beta-no-history" },
    },
    metrics: {
      priceHistory: {
        currentPrice: profile.price,
        priceHigh52Week: range.high,
        priceLow52Week: range.low,
        priceChange52WeekPercent:
          range.low && profile.price ? ((profile.price - range.low) / range.low) * 100 : undefined,
      },
      marketCap: { value: profile.mktCap, currency: profile.currency ?? "USD" },
      sector: { sector: profile.sector, industry: profile.industry },
      financialRatios: {
        peRatio: ratios?.peRatioTTM,
        pbRatio: ratios?.priceToBookRatioTTM,
        psRatio: ratios?.priceToSalesRatioTTM,
        roe: percentFromRatio(ratios?.returnOnEquityTTM),
        debtToEquity: ratios?.debtEquityRatioTTM,
      },
      eps: { eps: latestIncome?.eps, epsGrowthYoYPercent: undefined },
      dividend: { dividendYieldPercent: percentFromRatio(ratios?.dividendYieldTTM ?? ratios?.dividendYielTTM) },
      volatility: { annualizedVolatility: undefined, lookbackDays },
      beta: { value: profile.beta, confidenceLevel: profile.beta === undefined ? "unavailable" : "market" },
      sales: { annualRevenue: latestIncome?.revenue, revenueGrowthPercent: revenueGrowth },
      employees: {
        count: profile.fullTimeEmployees ? Number(profile.fullTimeEmployees.replace(/[^\d]/g, "")) : undefined,
      },
      country: { primaryListing: profile.country },
    },
  };
}

export class FundamentalDataService {
  constructor(private supabaseClient: SupabaseClient) {}

  async fetch(ticker: string, lookbackDays: number, sourceId?: string): Promise<FundamentalFetchResult> {
    const symbol = ticker.trim().toUpperCase();
    if (!symbol) return { success: false, error: "ticker_required" };

    if (sourceId?.toLowerCase() === "mock") {
      return { success: false, error: "mock_source_disabled" };
    }

    const requested = sourceId?.toLowerCase();
    const sources =
      requested === "fmp"
        ? [() => fetchFromFmp(symbol, lookbackDays), () => fetchFromYahoo(symbol, lookbackDays)]
        : requested === "yahoo"
          ? [() => fetchFromYahoo(symbol, lookbackDays)]
          : [() => fetchFromYahoo(symbol, lookbackDays), () => fetchFromFmp(symbol, lookbackDays)];

    const errors: string[] = [];
    for (const source of sources) {
      try {
        const data = await source();
        if (data) return { success: true, data };
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    return {
      success: false,
      error:
        errors.length > 0
          ? `real_fundamental_sources_failed: ${errors.join("; ")}`
          : "real_fundamental_sources_unavailable",
    };
  }
}
