// FIC: Orchestrator — fetches news, analyzes sentiment, and produces an EXPLANATORY verdict.
// FIC: Orquestador — obtiene noticias, analiza sentimiento y produce un veredicto EXPLICATIVO.
//
// FIC: Constitucion: la IA es confirmador, no decisor. El veredicto BUY/SELL/HOLD es una señal
// FIC: informativa para que un humano decida; SIEMPRE se acompaña del disclaimer constitucional.

import { NewsAdapter } from "./newsAdapter";
import {
  createSentimentAnalyzerForRuntime,
  type NewsSentimentAnalyzer
} from "./sentimentService";
import { NEWS_DISCLAIMER, type InvestmentVerdict, type NewsOutlook, type SentimentResult, type NewsRecommendationSummary } from "./types";

export interface InvestmentAdvisorDeps {
  adapter?: NewsAdapter;
  analyzer?: NewsSentimentAnalyzer;
  maxNews?: number;
}

export class InvestmentAdvisor {
  private adapter: NewsAdapter;
  private analyzer: NewsSentimentAnalyzer;
  private maxNews: number;

  constructor(deps: InvestmentAdvisorDeps = {}) {
    this.adapter = deps.adapter ?? new NewsAdapter();
    this.analyzer = deps.analyzer ?? createSentimentAnalyzerForRuntime();
    this.maxNews = deps.maxNews ?? 10;
  }

  // FIC: Evaluate a symbol end-to-end and return a structured, explanatory verdict.
  // FIC: Evalua un simbolo de extremo a extremo y devuelve un veredicto estructurado y explicativo.
  async evaluate(symbol: string): Promise<InvestmentVerdict> {
    const sym = symbol.toUpperCase();
    const articles = await this.adapter.getRecentNews(sym, this.maxNews);
    const sentiment = await this.analyzer.analyzeNewsSentiment(sym, articles);

    return {
      symbol: sym,
      verdict: resolveVerdict(sentiment),
      sentiment,
      newsCount: articles.length,
      disclaimer: NEWS_DISCLAIMER,
      ia_revisada: true,
      generatedAt: new Date().toISOString()
    };
  }
}

export function buildInvestmentAdvice(input: {
  symbol: string;
  verdict: NewsOutlook;
  confidence: number;
  score?: number;
  articles?: Array<{ title?: string; confidence?: number }>;
  recommendationSummary?: NewsRecommendationSummary;
}): {
  symbol: string;
  verdict: NewsOutlook;
  confidence: number;
  action: string;
  summary: string;
  riskNote: string;
  checklist: string[];
} {
  const recommendation = input.recommendationSummary?.recommendation;
  const action = recommendation === "CALL"
    ? "Sesgo CALL: considerar estrategia alcista con riesgo limitado"
    : recommendation === "PUT"
      ? "Sesgo PUT: considerar cobertura o estrategia bajista con riesgo limitado"
      : "Sesgo HOLD: mantener neutralidad y esperar confirmación";
  const summary = input.recommendationSummary?.summary
    ?? `${input.symbol} presenta un veredicto ${input.verdict} con confianza ${(input.confidence * 100).toFixed(0)}%.`;
  const riskNote = input.recommendationSummary?.riskNote
    ?? (input.confidence < 0.5 ? "La confianza es moderada o baja; revisar noticias adicionales antes de actuar." : "La confianza es relativamente alta, pero sigue siendo un análisis explicativo.");
  const checklist = [
    input.recommendationSummary?.strategyHint ?? "Comparar la recomendación de noticias con la estrategia seleccionada",
    "Verificar la noticia original y su fecha",
    "Comparar con la tendencia técnica",
    "Confirmar si el movimiento ya fue descontado por el mercado"
  ];

  return {
    symbol: input.symbol,
    verdict: input.verdict,
    confidence: input.confidence,
    action,
    summary,
    riskNote,
    checklist
  };
}

// FIC: Verdict mapping from the doc — low confidence holds, otherwise score-based.
// FIC: Mapeo de veredicto del documento — baja confianza mantiene, si no se basa en el score.
export function resolveVerdict(sentiment: SentimentResult): NewsOutlook {
  if (sentiment.confidence < 0.4) return "HOLD";
  if (sentiment.score > 0.3) return "BUY";
  if (sentiment.score < -0.3) return "SELL";
  return "HOLD";
}
