// src/modules/news2/urlAnalysisService.ts
// Noticias 2: servicio TNMT separado de A_NOTICIAS / Team-06.
// No importa dependencias externas; si las fuentes no se pueden leer, responde HOLD con baja confianza.

export interface URLContent {
  url: string;
  title: string;
  content: string;
  source: string;
  fetchedAt: string;
}

export interface SourceAnalysisResult {
  url: string;
  company: string;
  verdict: 'BUY' | 'SELL' | 'HOLD';
  score: number;
  confidence: number;
  reasoning: string;
  keyPoints: string[];
  warnings?: string[];
  timestamp: string;
}

export class URLAnalysisService {
  private readonly MAX_CONTENT_LENGTH = 5000;

  async fetchURLContent(url: string, company: string): Promise<URLContent> {
    const candidateUrls = this.buildCandidateUrls(url, company);
    const errors: string[] = [];

    for (const candidateUrl of candidateUrls) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(candidateUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
            'Cache-Control': 'no-cache',
          },
        });
        clearTimeout(timeoutId);

        if (response.status < 200 || response.status >= 300) {
          throw new Error(`HTTP ${response.status}`);
        }

        const parsed = this.extractRelevantContent(
          candidateUrl,
          await response.text(),
          company
        );

        if (parsed.content.length < 120) {
          throw new Error('contenido insuficiente');
        }

        return {
          url: candidateUrl,
          title: parsed.title,
          content: parsed.content,
          source: new URL(candidateUrl).hostname,
          fetchedAt: new Date().toISOString(),
        };
      } catch (error) {
        clearTimeout(timeoutId);
        errors.push(`${candidateUrl}: ${(error as Error).message}`);
      }
    }

    throw new Error(`Error fetching ${url}. Intentos fallidos: ${errors.join(' | ')}`);
  }

  private buildCandidateUrls(input: string, company: string): string[] {
    const normalizedUrl = input.startsWith('http') ? input : `https://${input}`;
    const baseUrl = new URL(normalizedUrl);
    const companyQuery = encodeURIComponent(company.trim());
    const ticker = this.getTickerForCompany(company);
    const host = baseUrl.hostname.replace(/^www\./, '');

    if (baseUrl.pathname !== '/' || baseUrl.search) {
      return [baseUrl.toString()];
    }

    const candidates = [
      baseUrl.toString(),
      `${baseUrl.origin}/search?q=${companyQuery}`,
      `${baseUrl.origin}/search?query=${companyQuery}`,
      `${baseUrl.origin}/search/?query=${companyQuery}`,
      `${baseUrl.origin}/news/search?q=${companyQuery}`,
    ];

    if (ticker) {
      candidates.push(`${baseUrl.origin}/quote/${ticker}`);
      candidates.push(`${baseUrl.origin}/quote/${ticker}/news`);
    }

    if (host === 'cnbc.com') candidates.unshift(`${baseUrl.origin}/search/?query=${companyQuery}`);
    if (host === 'reuters.com') candidates.unshift(`${baseUrl.origin}/site-search/?query=${companyQuery}`);
    if (host === 'finance.yahoo.com' && ticker) candidates.unshift(`${baseUrl.origin}/quote/${ticker}/news`);
    if (host === 'nasdaq.com' && ticker) {
      candidates.unshift(`${baseUrl.origin}/market-activity/stocks/${ticker.toLowerCase()}/news-headlines`);
    }
    if (host === 'investing.com') candidates.unshift(`${baseUrl.origin}/search/?q=${companyQuery}`);

    return [...new Set(candidates)];
  }

  private extractRelevantContent(url: string, html: string, company: string): { title: string; content: string } {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? this.decodeHtml(titleMatch[1]) : 'Noticia del sitio';
    const companyPatterns = [
      new RegExp(this.escapeRegExp(company), 'gi'),
      new RegExp(this.getTickerPatterns(company), 'gi'),
    ];

    const content = this.decodeHtml(html)
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<nav[^>]*>.*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>.*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 20);
    const relevantSentences = sentences.filter((sentence) =>
      companyPatterns.some((pattern) => pattern.test(sentence))
    );
    const finalContent =
      relevantSentences.length > 0
        ? relevantSentences.slice(0, 12).join('. ')
        : content.substring(0, this.MAX_CONTENT_LENGTH * 2);

    return {
      title,
      content: `URL analizada: ${url}\n${finalContent.substring(0, this.MAX_CONTENT_LENGTH)}`,
    };
  }

  private getTickerPatterns(company: string): string {
    const ticker = this.getTickerForCompany(company);
    return ticker
      ? `(${this.escapeRegExp(company)}|${ticker})`
      : this.escapeRegExp(company);
  }

  private getTickerForCompany(company: string): string | null {
    const tickerMap: { [key: string]: string } = {
      apple: 'AAPL',
      aapl: 'AAPL',
      microsoft: 'MSFT',
      msft: 'MSFT',
      google: 'GOOGL',
      alphabet: 'GOOGL',
      googl: 'GOOGL',
      amazon: 'AMZN',
      amzn: 'AMZN',
      tesla: 'TSLA',
      tsla: 'TSLA',
      meta: 'META',
      facebook: 'META',
      nvidia: 'NVDA',
      nvda: 'NVDA',
      intel: 'INTC',
      amd: 'AMD',
      netflix: 'NFLX',
      spy: 'SPY',
      qqq: 'QQQ',
    };

    return tickerMap[company.trim().toLowerCase()] || null;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private decodeHtml(value: string): string {
    return value
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  async analyzeSourcesForCompany(company: string, urls: string[]): Promise<SourceAnalysisResult> {
    if (!urls || urls.length === 0) throw new Error('Se deben proporcionar al menos una URL');
    if (!company || company.trim().length === 0) throw new Error('Se debe especificar la compania a analizar');

    const results = await Promise.allSettled(urls.map((url) => this.fetchURLContent(url, company.trim())));
    const urlContents = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<URLContent>).value);
    const warnings = results
      .filter((r) => r.status === 'rejected')
      .map((r) => (r as PromiseRejectedResult).reason?.message || String((r as PromiseRejectedResult).reason));

    if (urlContents.length === 0) return this.buildNoContentFallback(company.trim(), urls, warnings);
    return this.buildLocalContentAnalysis(company.trim(), urlContents, warnings);
  }

  private buildNoContentFallback(company: string, urls: string[], warnings: string[]): SourceAnalysisResult {
    const blockedSources = urls.join(', ');

    return {
      url: blockedSources,
      company,
      verdict: 'HOLD',
      score: 0,
      confidence: 0.1,
      reasoning:
        `No se pudo leer contenido verificable de las fuentes configuradas para ${company}. ` +
        'La recomendacion se mantiene en MANTENER con confianza baja para evitar una senal de compra o venta sin evidencia suficiente.',
      keyPoints: [
        'Las fuentes configuradas no entregaron contenido accesible para analizar.',
        'Algunas fuentes financieras bloquean scraping automatizado con respuestas HTTP 403.',
        'Agrega otra fuente accesible como Reuters, CNBC, Yahoo Finance o un enlace directo a una noticia para obtener una senal con mayor confianza.',
      ],
      warnings,
      timestamp: new Date().toISOString(),
    };
  }

  private buildLocalContentAnalysis(company: string, urlContents: URLContent[], warnings: string[]): SourceAnalysisResult {
    const positiveTerms = [
      'beat', 'beats', 'growth', 'gain', 'gains', 'profit', 'profits', 'revenue rose',
      'upgrade', 'outperform', 'bullish', 'strong demand', 'record', 'positive',
      'crecimiento', 'ganancia', 'ganancias', 'sube', 'supera', 'positivo',
    ];
    const negativeTerms = [
      'miss', 'misses', 'loss', 'losses', 'decline', 'drops', 'fell', 'cut',
      'downgrade', 'underperform', 'bearish', 'weak demand', 'lawsuit', 'risk',
      'negative', 'perdida', 'perdidas', 'cae', 'baja', 'riesgo', 'negativo',
    ];

    const combinedContent = urlContents.map((content) => `${content.title} ${content.content}`).join(' ').toLowerCase();
    const positiveCount = this.countTermMatches(combinedContent, positiveTerms);
    const negativeCount = this.countTermMatches(combinedContent, negativeTerms);
    const netScore = positiveCount - negativeCount;
    const score = Math.max(-0.6, Math.min(0.6, netScore / 10));
    const verdict: SourceAnalysisResult['verdict'] = score > 0.3 ? 'BUY' : score < -0.3 ? 'SELL' : 'HOLD';
    const confidence = Math.min(0.55, 0.25 + Math.abs(netScore) * 0.05 + urlContents.length * 0.05);

    return {
      url: urlContents.map((content) => content.url).join(', '),
      company,
      verdict,
      score,
      confidence,
      reasoning:
        `Analisis local para ${company}: se detectaron ${positiveCount} senales positivas y ${negativeCount} senales negativas en las fuentes accesibles. ` +
        'La confianza es limitada porque se usa el motor local de Noticias 2.',
      keyPoints: [
        `${urlContents.length} fuente(s) accesible(s) fueron leidas correctamente.`,
        `Balance textual detectado: ${positiveCount} positivo(s) contra ${negativeCount} negativo(s).`,
        'Noticias 2 corre separado de A_NOTICIAS y no escribe en la tabla de confluencia principal.',
      ],
      warnings: warnings.length > 0 ? warnings : undefined,
      timestamp: new Date().toISOString(),
    };
  }

  private countTermMatches(content: string, terms: string[]): number {
    return terms.reduce((count, term) => {
      const escapedTerm = this.escapeRegExp(term.toLowerCase());
      const matches = content.match(new RegExp(`\\b${escapedTerm}\\b`, 'g'));
      return count + (matches?.length || 0);
    }, 0);
  }

  async validateURL(url: string): Promise<boolean> {
    try {
      const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
      new URL(normalizedUrl);
      console.log(`[Noticias2 ValidateURL] URL valida: ${normalizedUrl}`);
      return true;
    } catch (error) {
      console.error('[Noticias2 ValidateURL] Error:', error);
      return false;
    }
  }
}
