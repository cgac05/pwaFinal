export type NewsSentiment = "positive" | "neutral" | "negative";
export type NewsVerdict = "BUY" | "HOLD" | "SELL";

export interface NewsSourceInput {
  id?: string;
  title?: string;
  url?: string;
  text?: string;
  provider?: string;
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
  id: string;
  label: string;
  enabled: boolean;
  ok: boolean;
  count: number;
  message: string;
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

export interface NewsConfluenceResponse {
  symbol: string;
  generatedAt: string;
  score: number;
  sentiment: NewsSentiment;
  verdict: NewsVerdict;
  confidence: number;
  articles: AnalyzedNewsSource[];
  providerStatus: NewsProviderStatus[];
  realDataOnly: true;
  evidence: Array<{ sourceId: string; verdict: NewsVerdict; confidence: number; rationale: string }>;
  recommendation?: {
    symbol: string;
    verdict: NewsVerdict;
    confidence: number;
    action: string;
    summary: string;
    riskNote: string;
    checklist: string[];
  };
}

export interface NewsDateRange {
  from?: string;
  to?: string;
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "message" in payload ? String((payload as { message?: unknown }).message) : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

export async function getNewsConfluence(symbol: string, limit = 8, signal?: AbortSignal, dateRange?: NewsDateRange): Promise<NewsConfluenceResponse> {
  const params = new URLSearchParams({ symbol: symbol.trim().toUpperCase(), limit: String(limit) });
  if (dateRange?.from) params.set("from", dateRange.from);
  if (dateRange?.to) params.set("to", dateRange.to);
  const response = await fetch(`/api/news/confluence?${params.toString()}`, { signal });
  return readJson<NewsConfluenceResponse>(response);
}

export async function analyzeNewsSources(symbol: string, sources: NewsSourceInput[], signal?: AbortSignal): Promise<NewsAnalysisAggregate> {
  const response = await fetch("/api/news/analyze-sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol: symbol.trim().toUpperCase(), sources }),
    signal
  });
  return readJson<NewsAnalysisAggregate>(response);
}

export async function analyzeSingleSource(symbol: string, source: NewsSourceInput, signal?: AbortSignal): Promise<AnalyzedNewsSource> {
  const response = await fetch("/api/news/analyze-source", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol: symbol.trim().toUpperCase(), source }),
    signal
  });
  return readJson<AnalyzedNewsSource>(response);
}
