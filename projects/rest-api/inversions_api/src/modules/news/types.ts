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
