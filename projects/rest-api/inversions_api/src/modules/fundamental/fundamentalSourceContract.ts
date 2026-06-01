// FIC: Contract types for Fundamental Analysis

export interface FundamentalAnalysisData {
  companyName: string;
  metadata: {
    sourceId: string;
    dataVersion: string;
    assumptions?: {
      volatilityCalculationMethod?: string;
    };
  };
  metrics: {
    priceHistory?: {
      currentPrice?: number;
      priceHigh52Week?: number;
      priceLow52Week?: number;
      priceChange52WeekPercent?: number;
    };
    marketCap?: {
      value?: number;
      currency?: string;
    };
    sector?: {
      sector?: string;
      industry?: string;
    };
    financialRatios?: {
      peRatio?: number;
      pbRatio?: number;
      psRatio?: number;
      roe?: number;
      debtToEquity?: number;
    };
    eps?: {
      eps?: number;
      epsGrowthYoYPercent?: number;
    };
    dividend?: {
      dividendYieldPercent?: number;
    };
    volatility?: {
      annualizedVolatility?: number;
      lookbackDays?: number;
    };
    beta?: {
      value?: number;
      confidenceLevel?: string;
    };
    sales?: {
      annualRevenue?: number;
      revenueGrowthPercent?: number;
    };
    employees?: {
      count?: number;
    };
    country?: {
      primaryListing?: string;
    };
  };
}
