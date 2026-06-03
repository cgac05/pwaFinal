// FIC: Shared types for the news sentiment analysis module (Feature 006).
// FIC: Tipos compartidos del modulo de analisis de sentimiento de noticias (Feature 006).

// FIC: Constitutional disclaimer — every news verdict is explanatory, never an executable order.
// FIC: Disclaimer constitucional — todo veredicto de noticias es explicativo, nunca una orden ejecutable.
export const NEWS_DISCLAIMER =
  "este analisis de noticias es informativo y no constituye orden ni recomendacion ejecutable";

// FIC: Normalized news article (independent of the upstream provider shape).
// FIC: Articulo de noticias normalizado (independiente de la forma del proveedor de origen).
export interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  author: string;
  source: string;
  url: string;
  symbols: string[];
  createdAt: string;
}

// FIC: Sentiment label aligned with the doc contract (BULLISH/BEARISH/NEUTRAL).
// FIC: Etiqueta de sentimiento alineada con el contrato del documento.
export type SentimentLabel = "BULLISH" | "BEARISH" | "NEUTRAL";

// FIC: Structured sentiment output consumed by the orchestrator and persisted for audit.
// FIC: Salida de sentimiento estructurada que consume el orquestador y se persiste para auditoria.
export interface SentimentResult {
  score: number; // FIC: -1.0 (muy negativo) a +1.0 (muy positivo).
  label: SentimentLabel;
  confidence: number; // FIC: 0.0 a 1.0.
  reasoning: string;
  keyFactors: string[];
  // FIC: degraded=true cuando se usa el analizador determinista de respaldo (sin LLM/red).
  degraded?: boolean;
}

// FIC: Explanatory outlook — NOT an order. The human remains the decision-maker (constitution).
// FIC: Perspectiva explicativa — NO es una orden. El humano sigue siendo quien decide (constitucion).
export type NewsOutlook = "BUY" | "SELL" | "HOLD";

// FIC: Final verdict returned by GET /api/news/sentiment/:symbol.
// FIC: Veredicto final devuelto por GET /api/news/sentiment/:symbol.
export interface InvestmentVerdict {
  symbol: string;
  verdict: NewsOutlook;
  sentiment: SentimentResult;
  newsCount: number;
  // FIC: Disclaimer y bandera de revision IA, requeridos por la constitucion.
  disclaimer: string;
  ia_revisada: boolean;
  generatedAt: string;
}

// FIC: Result of analyzing a single custom URL source.
// FIC: Resultado de analizar una fuente URL personalizada.
export interface SourceAnalysisResult {
  url: string;
  company: string;
  verdict: NewsOutlook;
  score: number;
  confidence: number;
  reasoning: string;
  keyPoints: string[];
  warnings?: string[];
  disclaimer: string;
  timestamp: string;
}

// FIC: Alias used by the ultrafic news impact engine — maps 1:1 to NewsOutlook.
export type NewsVerdict = "BUY" | "SELL" | "HOLD";

// FIC: Supported news provider identifiers.
export type NewsProviderId =
  | "manual"
  | "url"
  | "yahooFinance"
  | "finnhub"
  | "newsapi"
  | "alphaVantage"
  | "polygon"
  | "tnmtAnalyzer";

// FIC: Raw news item from any provider before sentiment analysis.
export interface NewsSourceInput {
  id: string;
  title?: string;
  text?: string;
  url?: string;
  provider: NewsProviderId;
  publishedAt?: string;
  symbol?: string;
}

// FIC: Per-provider health status included in NewsDataResponse.
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

// FIC: Query parameters accepted by fetchNewsData.
export interface NewsQueryParams {
  symbol: string;
  limit?: number;
  from?: string;
  to?: string;
  includeFallback?: boolean;
}

// FIC: Full response returned by fetchNewsData — articles + provider diagnostics.
export interface NewsDataResponse {
  symbol: string;
  generatedAt: string;
  fromCache: boolean;
  articles: AnalyzedNewsSource[];
  providerStatus: NewsProviderStatus[];
  realDataOnly: boolean;
}

// FIC: Individual analyzed news article produced by the news data service.
export interface AnalyzedNewsSource {
  id: string;
  url?: string;
  title: string;
  summary?: string;
  rationale?: string;
  verdict: NewsVerdict;
  sentimentScore: number;
  confidence: number;
  credibilityScore: number;
  provider: string;
  publishedAt: string;
}

// FIC: Aggregate response returned by evaluateNewsImpact.
export interface NewsImpactResponse {
  symbol: string;
  generatedAt: string;
  score: number;
  sentiment: "positive" | "negative" | "neutral";
  verdict: NewsVerdict;
  confidence: number;
  articles: AnalyzedNewsSource[];
  providerStatus?: unknown;
  realDataOnly: boolean;
  evidence: Array<{ sourceId: string; verdict: NewsVerdict; confidence: number; rationale?: string }>;
}
