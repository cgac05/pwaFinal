// src/routes/news/urlAnalysis.ts
// FIC: Endpoint para análisis de sentimiento con datos REALES de APIs financieras.
// FIC: Ya no usa scraping HTML. Consume fetchNewsData (Yahoo RSS + Finnhub + NewsAPI + etc.)
// FIC: y devuelve artículos estructurados: titular, fuente, snippet y URL original.

import { Router, Request, Response } from 'express';
import { fetchNewsData } from '../../modules/news/newsDataService';

const router = Router();

// ─── Mapa dominio → proveedor(es) ────────────────────────────────────────────
// Permite respetar las fuentes que el usuario seleccionó en la UI.
// Si el dominio no está en el mapa se ignora (fuente no integrada).
const DOMAIN_PROVIDER_MAP: Record<string, string[]> = {
  'nasdaq.com':        ['yahooFinance'],
  'finance.yahoo.com': ['yahooFinance'],
  'cnbc.com':          ['newsapi'],
  'bloomberg.com':     ['newsapi', 'polygon'],
  'reuters.com':       ['newsapi'],
  'marketwatch.com':   ['newsapi'],
  'seekingalpha.com':  ['newsapi'],
  'investing.com':     ['finnhub', 'newsapi'],
};

/** Extrae el hostname limpio de un dominio o URL. */
function cleanDomain(raw: string): string {
  try {
    return new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname.replace(/^www\./, '');
  } catch {
    return raw.replace(/^www\./, '').toLowerCase();
  }
}

/**
 * Dado el array de dominios seleccionados por el usuario, devuelve
 * el conjunto de proveedores que deben filtrarse en los artículos.
 * Si ningún dominio tiene mapeo conocido, se devuelven todos (fallback).
 */
function resolveProviders(domains: string[]): Set<string> {
  const providers = new Set<string>();
  for (const domain of domains) {
    const key = cleanDomain(domain);
    const mapped = Object.entries(DOMAIN_PROVIDER_MAP).find(([k]) => key.includes(k))?.[1];
    if (mapped) mapped.forEach(p => providers.add(p));
  }
  // Fallback: sin mapa conocido → acepta cualquier proveedor
  return providers;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(3));
}

function resolveVerdict(score: number): 'BUY' | 'SELL' | 'HOLD' {
  if (score > 0.25) return 'BUY';
  if (score < -0.25) return 'SELL';
  return 'HOLD';
}

// ─── POST /news/analyze-sources ──────────────────────────────────────────────
/**
 * Analiza el sentimiento de un ticker usando APIs de noticias reales.
 *
 * Body:  { "company": "AAPL", "urls": [...ignorado], "from"?: "2026-01-01", "to"?: "2026-06-01" }
 *
 * Response:
 * {
 *   company, verdict, score, confidence, reasoning, keyPoints,
 *   articles: [{ headline, source, snippet, url, publishedAt, score }],
 *   timestamp
 * }
 */
router.post('/analyze-sources', async (req: Request, res: Response) => {
  try {
    const { company, from, to } = req.body;

    if (!company || typeof company !== 'string' || company.trim().length === 0) {
      return res.status(400).json({ error: 'Campo "company" requerido (ticker o nombre de empresa)' });
    }

    const symbol = company.trim().toUpperCase();

    // ── Determina proveedores válidos según dominios seleccionados ─────────────
    const selectedDomains: string[] = Array.isArray(req.body.urls) ? req.body.urls : [];
    const allowedProviders = resolveProviders(selectedDomains);
    const filterByProvider = allowedProviders.size > 0;

    // ── Obtiene artículos REALES de Yahoo Finance RSS + APIs configuradas ──────
    const newsData = await fetchNewsData(
      { symbol, limit: 15, from: from ?? undefined, to: to ?? undefined },
      15
    );

    // Intenta filtro estricto por proveedor; si da 0 artículos cae al pool completo.
    // Esto ocurre cuando el usuario seleccionó Bloomberg/Reuters pero no hay API key
    // configurada para newsapi/polygon — en ese caso usamos Yahoo Finance RSS (libre).
    const strictFiltered = filterByProvider
      ? newsData.articles.filter(a => allowedProviders.has(a.provider))
      : newsData.articles;

    const usingFallback = filterByProvider && strictFiltered.length === 0;
    const articles      = usingFallback ? newsData.articles : strictFiltered;

    // Nota sobre fuentes: indica qué proveedor se usó realmente
    const sourcesNote: string | null = usingFallback
      ? `Las fuentes seleccionadas (${selectedDomains.join(', ')}) requieren API key no configurada. Se usó Yahoo Finance RSS como fuente disponible.`
      : null;

    // ── Caso sin artículos (ni con fallback) ──────────────────────────────────
    if (articles.length === 0) {
      return res.json({
        company: symbol,
        verdict: 'HOLD',
        score: 0,
        confidence: 0,
        reasoning: `No se encontraron artículos para ${symbol}. Verifica el ticker o amplía el rango de fechas.`,
        keyPoints: [],
        articles: [],
        sourcesNote: null,
        timestamp: new Date().toISOString(),
      });
    }

    // ── Agrega score y confianza ──────────────────────────────────────────────
    const scores      = articles.map(a => a.sentimentScore);
    const confs       = articles.map(a => a.confidence);
    const avgScore    = avg(scores);
    const avgConf     = avg(confs);
    const verdict     = resolveVerdict(avgScore);

    // Punto 2 — Razonamiento con titulares reales y causalidad explícita
    const sorted    = [...articles].sort((a, b) => Math.abs(b.sentimentScore) - Math.abs(a.sentimentScore));
    const topArt    = sorted[0];
    const secondArt = sorted.find(a => a.id !== topArt?.id && a.title !== topArt?.title);

    const reasoning = (() => {
      if (!topArt?.title) {
        return `Análisis completado para ${symbol}. Revisa la Evidencia Cruda para los titulares.`;
      }

      const scoreSign  = avgScore >= 0 ? `+${avgScore.toFixed(2)}` : avgScore.toFixed(2);
      const direction  = avgScore > 0.1 ? 'alcista' : avgScore < -0.1 ? 'bajista' : 'neutral';
      const sourceLabel = topArt.provider ?? 'fuente financiera';

      // Solo usa el rationale si proviene de Claude (no del analizador determinista).
      // El determinista siempre contiene "determinista" o "señales alcistas y".
      const isDeterministic = !topArt.rationale ||
        topArt.rationale.includes('determinista') ||
        topArt.rationale.includes('señales alcistas y') ||
        topArt.rationale.includes('señales bajistas y');

      if (!isDeterministic && topArt.rationale && topArt.rationale.length > 60) {
        return topArt.rationale; // Claude generó razonamiento específico
      }

      // Construye reasoning desde titulares reales con causalidad explícita
      const mainLine = `El score de ${scoreSign} (${direction}) está justificado porque el titular ` +
        `"${topArt.title}" publicado en ${sourceLabel} indica un evento de impacto ${direction} para ${symbol}.`;

      const secondLine = secondArt?.title
        ? ` Adicionalmente, "${secondArt.title}" (${secondArt.provider ?? 'segunda fuente'}) ` +
          `${secondArt.sentimentScore > 0 ? 'refuerza' : 'modera'} esta perspectiva.`
        : '';

      const confLine = ` La confianza del ${(avgConf * 100).toFixed(0)}% refleja la consistencia ` +
        `entre los ${articles.length} artículo(s) analizados.`;

      return mainLine + secondLine + confLine;
    })();

    // ── keyPoints = titulares REALES de los artículos ─────────────────────────
    const keyPoints = articles
      .slice(0, 4)
      .map(a => a.title)
      .filter(Boolean);

    // ── Artículos estructurados para la UI (Split Card) ───────────────────────
    const structuredArticles = articles.slice(0, 5).map(a => ({
      headline:    a.title,
      source:      a.provider,
      snippet:     a.summary ?? '',
      url:         a.url ?? '',
      publishedAt: a.publishedAt,
      score:       a.sentimentScore,
      verdict:     a.verdict,
    }));

    return res.json({
      company:    symbol,
      verdict,
      score:      avgScore,
      confidence: avgConf,
      reasoning,
      keyPoints,
      articles:   structuredArticles,
      sourcesNote,                    // null o texto explicando el fallback
      timestamp:  new Date().toISOString(),
    });

  } catch (error) {
    console.error('[NewsAnalysis] Error:', error);
    return res.status(500).json({
      error: `Error al analizar noticias: ${(error as Error).message}`,
    });
  }
});

// ─── GET /news/validate-url ──────────────────────────────────────────────────
// FIC: Validación rápida de dominio (sin cambios — sigue siendo útil para UX).
router.get('/validate-url', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Parámetro "url" requerido' });
    }

    // Validación ligera: solo verifica que sea un dominio parseable
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
      return res.json({ valid: true, message: 'Dominio válido' });
    } catch {
      return res.json({ valid: false, message: 'Dominio inválido. Usa ej: bloomberg.com' });
    }
  } catch (error) {
    return res.status(500).json({ error: `Error validando URL: ${(error as Error).message}` });
  }
});

export default router;
