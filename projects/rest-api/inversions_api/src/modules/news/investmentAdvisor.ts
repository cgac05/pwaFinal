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
import { NEWS_DISCLAIMER, type InvestmentVerdict, type NewsOutlook, type SentimentResult } from "./types";

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

// FIC: Verdict mapping from the doc — low confidence holds, otherwise score-based.
// FIC: Mapeo de veredicto del documento — baja confianza mantiene, si no se basa en el score.
export function resolveVerdict(sentiment: SentimentResult): NewsOutlook {
  if (sentiment.confidence < 0.4) return "HOLD";
  if (sentiment.score > 0.3) return "BUY";
  if (sentiment.score < -0.3) return "SELL";
  return "HOLD";
}
