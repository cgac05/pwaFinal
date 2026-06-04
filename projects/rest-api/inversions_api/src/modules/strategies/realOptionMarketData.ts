// FIC: Team-03 option input enrichment from real option market data. (EN)
// FIC: Enriquecimiento Team-03 de inputs de opciones con datos reales de mercado. (ES)

import type { OptionAssumptions, OptionDirection, OptionStrategyContract, OptionType } from "./optionsStrategyContract";
import { resolveOptionContext, type ResolvedOptionContext } from "../market/optionChainService";
import { fetchYahooOhlc } from "../institutional/yahooChartParser";

export interface EnrichedOptionContract {
  contract: OptionStrategyContract;
  marketContext: ResolvedOptionContext;
  marketDataUsed: string[];
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function normalizeOptionType(value: unknown): OptionType {
  const normalized = String(value ?? "CALL").toUpperCase();
  if (normalized === "PUT") return "PUT";
  return "CALL";
}

function normalizeDirection(value: unknown): OptionDirection {
  const normalized = String(value ?? "LONG").toUpperCase();
  if (normalized === "SHORT") return "SHORT";
  return "LONG";
}

function daysToExpiration(expirationDate: unknown): number | undefined {
  if (typeof expirationDate !== "string" || !expirationDate) return undefined;
  const expirationTime = new Date(expirationDate).getTime();
  if (!Number.isFinite(expirationTime)) return undefined;
  return Math.max(1, Math.round((expirationTime - Date.now()) / 86_400_000));
}

function targetDte(params: Partial<OptionStrategyContract>): number {
  if (isPositiveNumber(params.daysToExpiration)) return params.daysToExpiration;
  return daysToExpiration(params.expirationDate) ?? 45;
}

function initialStrikeTarget(params: Partial<OptionStrategyContract>, currentPrice?: number): number {
  if (isPositiveNumber(params.strikePrice)) return params.strikePrice;
  if (isPositiveNumber(currentPrice)) return Math.max(1, Math.round(currentPrice / 5) * 5);
  return 100;
}

function premiumForType(context: ResolvedOptionContext, optionType: OptionType): number {
  return optionType === "CALL" ? context.callPremium : context.putPremium;
}

export async function enrichOptionContractWithMarketData(
  params: Partial<OptionStrategyContract>
): Promise<EnrichedOptionContract> {
  const ticker = String(params.ticker ?? "").trim().toUpperCase();
  if (!ticker) throw new Error("ticker is required");

  const optionType = normalizeOptionType(params.optionType);
  const direction = normalizeDirection(params.direction);
  const preferredDte = targetDte(params);
  const firstStrike = initialStrikeTarget(params, params.currentPrice);
  let context = await resolveOptionContext(ticker, firstStrike, firstStrike, preferredDte);
  if (!context) throw new Error(`No real option market data available for ${ticker}`);

  const finalStrike = isPositiveNumber(params.strikePrice)
    ? params.strikePrice
    : initialStrikeTarget(params, context.underlyingPrice);
  if (finalStrike !== firstStrike) {
    context = await resolveOptionContext(ticker, finalStrike, finalStrike, preferredDte) ?? context;
  }

  const marketDataUsed: string[] = [
    "premium",
    "currentPrice",
    "expirationDate",
    "daysToExpiration",
    "impliedVolatility",
  ];
  const premium = premiumForType(context, optionType);
  if (!isPositiveNumber(premium)) {
    throw new Error(`No real ${optionType.toLowerCase()} premium available for ${ticker}`);
  }

  const currentPrice = context.underlyingPrice;
  if (!isPositiveNumber(currentPrice)) {
    throw new Error(`No real underlying price available for ${ticker}`);
  }

  const expirationDate = context.expirationDate;
  const dte = context.dte;

  const assumptions: OptionAssumptions = {
    ...(params.assumptions ?? {}),
    impliedVolatility: context.iv * 100,
  };

  const quantity = isPositiveNumber(params.quantity)
    ? params.quantity
    : isPositiveNumber(params.numberOfContracts)
      ? params.numberOfContracts
      : 1;
  if (!isPositiveNumber(params.quantity) && !isPositiveNumber(params.numberOfContracts)) {
    marketDataUsed.push("quantityDefault:1");
  }

  const availableCapital = isPositiveNumber(params.availableCapital)
    ? params.availableCapital
    : isPositiveNumber(params.capitalAvailable)
      ? params.capitalAvailable
      : Math.max(currentPrice * quantity * 100, premium * quantity * 100);
  if (!isPositiveNumber(params.availableCapital) && !isPositiveNumber(params.capitalAvailable)) {
    marketDataUsed.push("availableCapitalDerived");
  }

  return {
    contract: {
      ticker,
      optionType,
      direction,
      strikePrice: finalStrike,
      currentPrice,
      expirationDate,
      daysToExpiration: dte,
      premium,
      premiumPerContract: premium,
      quantity,
      numberOfContracts: quantity,
      capitalAvailable: availableCapital,
      availableCapital,
      riskTolerance: params.riskTolerance ?? "MEDIUM",
      assumptions,
    },
    marketContext: context,
    marketDataUsed,
  };
}

export async function fetchRealPricePath(ticker: string, count = 60): Promise<number[]> {
  const candles = await fetchYahooOhlc(ticker, "1d");
  const closes = candles
    ?.map((candle) => candle.close)
    .filter((close) => Number.isFinite(close) && close > 0)
    .slice(-count) ?? [];

  if (closes.length < 2) throw new Error(`No real price path available for ${ticker}`);
  return closes;
}
