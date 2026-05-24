// src/modules/news/investmentAdvisor.ts
// Orquesta todo y produce el veredicto final

import { NewsAdapter } from './newsAdapter';
import { SentimentService } from './sentimentService';
import type { SentimentResult } from './sentimentService';

export interface InvestmentVerdict {
  symbol: string;
  verdict: 'BUY' | 'SELL' | 'HOLD';
  sentiment: SentimentResult;
  newsCount: number;
  generatedAt: string;
}

export class InvestmentAdvisor {
  private newsAdapter: NewsAdapter;
  private sentimentService: SentimentService;

  constructor(alpacaApiKey: string, alpacaApiSecret: string) {
    this.newsAdapter = new NewsAdapter(alpacaApiKey, alpacaApiSecret);
    this.sentimentService = new SentimentService();
  }

  async evaluate(symbol: string): Promise<InvestmentVerdict> {
    // 1. Obtener noticias recientes
    const articles = await this.newsAdapter.getRecentNews(symbol, 10);

    // 2. Analizar sentimiento con Claude
    const sentiment = await this.sentimentService.analyzeNewsSentiment(symbol, articles);

    // 3. Traducir sentimiento a veredicto accionable
    const verdict = this.resolveVerdict(sentiment);

    return {
      symbol,
      verdict,
      sentiment,
      newsCount: articles.length,
      generatedAt: new Date().toISOString(),
    };
  }

  private resolveVerdict(
    sentiment: SentimentResult
  ): 'BUY' | 'SELL' | 'HOLD' {
    const { score, confidence } = sentiment;

    // Si la confianza es baja, no arriesgamos
    if (confidence < 0.4) return 'HOLD';

    if (score > 0.3) return 'BUY';
    if (score < -0.3) return 'SELL';
    return 'HOLD';
  }
}