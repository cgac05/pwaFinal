import type { AnalyzedNewsSource, NewsSentiment, NewsVerdict } from "./types";

export type NewsOptionRecommendation = "CALL" | "PUT" | "HOLD";

interface BuildNewsRecommendationSummaryInput {
  symbol: string;
  articles: AnalyzedNewsSource[];
  score: number;
  sentiment: NewsSentiment;
  verdict: NewsVerdict;
  confidence: number;
}

export interface NewsRecommendationSummary {
  symbol: string;
  recommendation: NewsOptionRecommendation;
  verdict: NewsVerdict;
  sentiment: NewsSentiment;
  confidence: number;
  score: number;
  summary: string;
  reasoning: string;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  keyDrivers: string[];
  topBullish: string[];
  topBearish: string[];
  topNeutral: string[];
  riskNote: string;
  strategyHint: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

function signalFromVerdict(verdict: NewsVerdict): NewsOptionRecommendation {
  if (verdict === "BUY") return "CALL";
  if (verdict === "SELL") return "PUT";
  return "HOLD";
}

function articleWeight(article: AnalyzedNewsSource): number {
  return clamp(article.confidence, 0, 1) * clamp(article.credibilityScore, 0, 1);
}

function impact(article: AnalyzedNewsSource): number {
  const direction = article.verdict === "BUY" ? 1 : article.verdict === "SELL" ? -1 : 0;
  return direction * articleWeight(article);
}

function cleanText(value: string | undefined, fallback: string): string {
  return (value ?? "").replace(/\s+/g, " ").trim() || fallback;
}

function headlineList(articles: AnalyzedNewsSource[], fallback: string): string[] {
  return articles
    .slice(0, 3)
    .map((article) => cleanText(article.title, fallback))
    .filter(Boolean);
}

function topByDirection(articles: AnalyzedNewsSource[], verdict: NewsVerdict): AnalyzedNewsSource[] {
  return articles
    .filter((article) => article.verdict === verdict)
    .sort((a, b) => Math.abs(impact(b)) - Math.abs(impact(a)) || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

function dominantProvider(articles: AnalyzedNewsSource[]): string {
  const counts = new Map<string, number>();
  articles.forEach((article) => counts.set(article.provider, (counts.get(article.provider) ?? 0) + 1));
  const [provider] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["fuentes reales", 0];
  return provider;
}

function strategyHint(recommendation: NewsOptionRecommendation): string {
  if (recommendation === "CALL") {
    return "La lectura de noticias favorece estrategias alcistas como Bull Call Spread o Bull Put Spread, siempre que los indicadores técnicos confirmen.";
  }
  if (recommendation === "PUT") {
    return "La lectura de noticias favorece estrategias bajistas como Bear Put Spread o Bear Call Spread, siempre que el análisis técnico confirme debilidad.";
  }
  return "La lectura de noticias no da dirección clara; conviene mantener HOLD o evaluar estrategias neutrales como Iron Condor/Calendar Spread.";
}

function riskNote(recommendation: NewsOptionRecommendation, confidence: number, total: number): string {
  if (total === 0) return "No se encontraron noticias suficientes en el rango seleccionado; no conviene usar noticias como confirmación principal.";
  if (confidence < 0.45) return "La confianza agregada es baja; la recomendación debe tomarse como señal débil y requiere confirmación técnica.";
  if (recommendation === "HOLD") return "El sentimiento está mixto o neutral; evitar estrategias direccionales agresivas hasta tener mejor confirmación.";
  return "La señal es explicativa, no una orden ejecutable; validar precio, volatilidad, soportes/resistencias y riesgo máximo antes de simular.";
}

export function buildNewsRecommendationSummary(input: BuildNewsRecommendationSummaryInput): NewsRecommendationSummary {
  const { symbol, articles, score, sentiment, verdict, confidence } = input;
  const recommendation = signalFromVerdict(verdict);
  const bullish = topByDirection(articles, "BUY");
  const bearish = topByDirection(articles, "SELL");
  const neutral = topByDirection(articles, "HOLD");
  const total = articles.length;
  const bullishCount = bullish.length;
  const bearishCount = bearish.length;
  const neutralCount = neutral.length;
  const weightedImpact = articles.reduce((sum, article) => sum + impact(article), 0);
  const avgImpact = total ? weightedImpact / total : 0;
  const provider = dominantProvider(articles);
  const topArticles = [...articles]
    .sort((a, b) => Math.abs(impact(b)) - Math.abs(impact(a)))
    .slice(0, 3);

  const directionText = recommendation === "CALL"
    ? "sesgo alcista"
    : recommendation === "PUT"
      ? "sesgo bajista"
      : "sesgo neutral";

  const summary = total === 0
    ? `${symbol} no tiene noticias reales suficientes dentro del rango seleccionado para generar una recomendación direccional.`
    : `Se analizaron ${total} noticias relevantes de ${symbol}. El balance ponderado muestra ${directionText}: ${bullishCount} alcistas, ${bearishCount} bajistas y ${neutralCount} neutrales. La fuente con mayor presencia fue ${provider}.`;

  const reasoning = total === 0
    ? "Sin evidencia noticiosa suficiente, el sistema mantiene HOLD para evitar una señal artificial."
    : `La recomendación ${recommendation} sale de combinar dirección de cada noticia, confianza del análisis y credibilidad de la fuente. El impacto promedio fue ${round3(avgImpact)} y el score final quedó en ${round3(score)}.`;

  const keyDrivers = topArticles.length > 0
    ? topArticles.map((article) => `${article.verdict}: ${cleanText(article.title, "Noticia relevante")} · peso ${round3(articleWeight(article))}`)
    : ["Sin drivers noticiosos suficientes en la ventana seleccionada."];

  return {
    symbol,
    recommendation,
    verdict,
    sentiment,
    confidence: round3(confidence),
    score: round3(score),
    summary,
    reasoning,
    bullishCount,
    bearishCount,
    neutralCount,
    keyDrivers,
    topBullish: headlineList(bullish, "Noticia alcista relevante"),
    topBearish: headlineList(bearish, "Noticia bajista relevante"),
    topNeutral: headlineList(neutral, "Noticia neutral relevante"),
    riskNote: riskNote(recommendation, confidence, total),
    strategyHint: strategyHint(recommendation),
  };
}
