// src/modules/news/newsAdapter.ts
// Obtiene noticias recientes de Alpaca News API

export interface AlpacaNewsArticle {
  id: number;
  headline: string;
  summary: string;
  author: string;
  created_at: string;
  updated_at: string;
  url: string;
  symbols: string[];
  source: string;
}

export class NewsAdapter {
  private readonly baseUrl = 'https://data.alpaca.markets/v1beta1/news';
  private apiKey: string;
  private apiSecret: string;

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  async getRecentNews(
    symbol: string,
    limit: number = 10
  ): Promise<AlpacaNewsArticle[]> {
    const params = new URLSearchParams({
      symbols: symbol,
      limit: String(limit),
      sort: 'desc',
    });

    const response = await fetch(`${this.baseUrl}?${params}`, {
      method: 'GET',                         // ← único verbo: GET
      headers: {
        'APCA-API-KEY-ID': this.apiKey,
        'APCA-API-SECRET-KEY': this.apiSecret,
      },
    });

    if (!response.ok) {
      throw new Error(`Alpaca News API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.news as AlpacaNewsArticle[];
  }
}