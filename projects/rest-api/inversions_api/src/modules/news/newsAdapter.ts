// FIC: News adapter — fetches recent articles from Alpaca News API with a deterministic demo fallback.
// FIC: Adaptador de noticias — obtiene articulos recientes de Alpaca News API con respaldo demo determinista.
//
// FIC: Replica el patron de market/quotes.ts: si faltan credenciales o la API falla, degrada a datos
// FIC: demo deterministas (sembrados por simbolo) para que CI y el modo demo sigan funcionando sin red.

import type { NewsArticle } from "./types";

// FIC: Raw Alpaca article shape (subset used here).
// FIC: Forma cruda del articulo de Alpaca (subconjunto usado aqui).
interface AlpacaNewsArticle {
  id: number;
  headline: string;
  summary: string;
  author: string;
  source: string;
  url: string;
  symbols: string[];
  created_at: string;
}

const ALPACA_NEWS_URL = "https://data.alpaca.markets/v1beta1/news";
const DEFAULT_TIMEOUT_MS = 8000;

export interface NewsAdapterOptions {
  apiKey?: string;
  apiSecret?: string;
  timeoutMs?: number;
  // FIC: fetch inyectable para tests.
  fetchImpl?: typeof fetch;
}

export class NewsAdapter {
  private apiKey?: string;
  private apiSecret?: string;
  private timeoutMs: number;
  private fetchImpl: typeof fetch;

  constructor(opts: NewsAdapterOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.ALPACA_API_KEY ?? process.env.ALPACA_API_KEY_PAPER;
    this.apiSecret = opts.apiSecret ?? process.env.ALPACA_API_SECRET ?? process.env.ALPACA_SECRET_KEY_PAPER;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  // FIC: Returns up to `limit` recent articles for a symbol. Never throws — degrades to demo data.
  // FIC: Devuelve hasta `limit` articulos recientes de un simbolo. Nunca lanza — degrada a datos demo.
  async getRecentNews(symbol: string, limit = 10): Promise<NewsArticle[]> {
    const sym = symbol.toUpperCase();
    if (!this.apiKey || !this.apiSecret) {
      return demoNewsForSymbol(sym, limit);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const url = `${ALPACA_NEWS_URL}?symbols=${encodeURIComponent(sym)}&limit=${limit}&sort=desc`;
      const res = await this.fetchImpl(url, {
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.apiSecret
        },
        signal: controller.signal
      });
      if (!res.ok) return demoNewsForSymbol(sym, limit);
      const data = (await res.json()) as { news?: AlpacaNewsArticle[] };
      const raw = Array.isArray(data.news) ? data.news : [];
      if (raw.length === 0) return demoNewsForSymbol(sym, limit);
      return raw.slice(0, limit).map(normalizeArticle);
    } catch {
      // FIC: Timeout / red / parseo — degradar a demo determinista.
      return demoNewsForSymbol(sym, limit);
    } finally {
      clearTimeout(timer);
    }
  }
}

function normalizeArticle(a: AlpacaNewsArticle): NewsArticle {
  return {
    id: String(a.id),
    headline: a.headline ?? "",
    summary: a.summary ?? "",
    author: a.author ?? "",
    source: a.source ?? "",
    url: a.url ?? "",
    symbols: Array.isArray(a.symbols) ? a.symbols : [],
    createdAt: a.created_at ?? new Date().toISOString()
  };
}

// FIC: Deterministic demo headlines seeded by symbol so tests and demo mode are reproducible.
// FIC: Titulares demo deterministas sembrados por simbolo para que tests y modo demo sean reproducibles.
const DEMO_TEMPLATES = [
  { tone: "pos", headline: "{S} supera expectativas de ganancias en el ultimo trimestre", source: "Reuters" },
  { tone: "pos", headline: "Analistas elevan el precio objetivo de {S} tras solidos resultados", source: "Bloomberg" },
  { tone: "neg", headline: "{S} enfrenta presion por aumento de costos y competencia", source: "CNBC" },
  { tone: "neu", headline: "{S} mantiene su guia anual sin cambios significativos", source: "MarketWatch" },
  { tone: "pos", headline: "Fuerte demanda impulsa los ingresos de {S}", source: "Yahoo Finance" },
  { tone: "neg", headline: "Reguladores abren revision sobre practicas de {S}", source: "SEC EDGAR" }
];

export function demoNewsForSymbol(symbol: string, limit = 10): NewsArticle[] {
  const seed = symbol.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const count = Math.min(limit, DEMO_TEMPLATES.length);
  const out: NewsArticle[] = [];
  for (let i = 0; i < count; i++) {
    const tpl = DEMO_TEMPLATES[(seed + i) % DEMO_TEMPLATES.length];
    out.push({
      id: `demo-${symbol}-${i}`,
      headline: tpl.headline.replace("{S}", symbol),
      summary: `Resumen demo determinista para ${symbol} (${tpl.tone}).`,
      author: "Demo Wire",
      source: tpl.source,
      url: `https://example.com/news/${symbol.toLowerCase()}/${i}`,
      symbols: [symbol],
      createdAt: new Date(Date.UTC(2026, 4, 29, 12, i)).toISOString()
    });
  }
  return out;
}
