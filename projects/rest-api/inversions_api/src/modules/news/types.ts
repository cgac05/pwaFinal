export type NewsProviderId =
  | "manual"
  | "url"
  | "yahooFinance"
  | "finnhub"
  | "newsapi"
  | "alphaVantage"
  | "polygon"
  | "tnmtAnalyzer";

export type NewsSentiment = "positive" | "neutral" | "negative";
export type NewsVerdict = "BUY" | "HOLD" | "SELL";

export interface NewsSourceInput {
  id?: string;
  title?: string;
  url?: string;
  text?: string;
  provider?: NewsProviderId | string;
  publishedAt?: string;
  symbol?: string;
}

export interface AnalyzedNewsSource {
  id: string;
  title: string;
  url?: string;
  provider: string;
  publishedAt: string;
  summary: string;
  rawText: string;
  sentiment: NewsSentiment;
  sentimentScore: number;
  confidence: number;
  credibilityScore: number;
  affectedSymbols: string[];
  keywords: string[];
  verdict: NewsVerdict;
  rationale: string;
}

export interface NewsProviderStatus {
  id: NewsProviderId;
  label: string;
  enabled: boolean;
  ok: boolean;
  count: number;
  message: string;
  rawCount?: number;
  relevantCount?: number;
}

export interface NewsAnalysisAggregate {
  symbol: string;
  generatedAt: string;
  totalSources: number;
  sentiment: NewsSentiment;
  sentimentScore: number;
  confidence: number;
  verdict: NewsVerdict;
  buyCount: number;
  holdCount: number;
  sellCount: number;
  sources: AnalyzedNewsSource[];
  highlights: string[];
}

export interface NewsQueryParams {
  symbol: string;
  limit?: number;
  from?: string;
  to?: string;
  /** Deprecated: kept only for compatibility. The real-news mode never creates demo data. */
  includeFallback?: boolean;
}

export interface NewsDataResponse {
  symbol: string;
  generatedAt: string;
  fromCache: boolean;
  articles: AnalyzedNewsSource[];
  providerStatus: NewsProviderStatus[];
  realDataOnly: true;
}

export interface NewsImpactResponse {
  symbol: string;
  generatedAt: string;
  score: number;
  sentiment: NewsSentiment;
  verdict: NewsVerdict;
  confidence: number;
  articles: AnalyzedNewsSource[];
  providerStatus: NewsProviderStatus[];
  realDataOnly: true;
  evidence: Array<{
    sourceId: string;
    verdict: NewsVerdict;
    confidence: number;
    rationale: string;
  }>;
}
