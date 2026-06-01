import { ExternalLink, ChevronLeft, ChevronRight, CalendarDays, Gauge, Newspaper, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AnalyzedNewsSource, NewsAnalysisAggregate, NewsConfluenceResponse, NewsVerdict } from "../../services/news/newsApi";

interface AnalysisResultProps {
  confluence?: NewsConfluenceResponse | null;
  manualAnalysis?: NewsAnalysisAggregate | null;
  onArticleSelect?: (article: AnalyzedNewsSource) => void;
}

const PROVIDER_NAMES: Record<string, string> = {
  yahooFinance: "Yahoo Finance",
  finnhub: "Finnhub",
  newsapi: "NewsAPI",
  polygon: "Polygon",
  alphaVantage: "Alpha Vantage",
  manual: "Manual",
  url: "URL manual",
  tnmtAnalyzer: "TNMT"
};

const ITEMS_PER_PAGE = 12;

function verdictLabel(verdict: NewsVerdict): string {
  if (verdict === "BUY") return "Compra / Alcista";
  if (verdict === "SELL") return "Venta / Bajista";
  return "Mantener / Neutral";
}

function verdictClass(verdict: NewsVerdict): string {
  if (verdict === "BUY") return "is-buy";
  if (verdict === "SELL") return "is-sell";
  return "is-hold";
}

function providerClass(provider: string): string {
  return `provider-${provider.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;
}

function providerName(provider: string): string {
  return PROVIDER_NAMES[provider] ?? provider;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return date.toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function scoreAsPercent(score: number): number {
  return Math.max(0, Math.min(100, Math.round((score + 1) * 50)));
}

function confidencePct(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function sortArticles(articles: AnalyzedNewsSource[]): AnalyzedNewsSource[] {
  return [...articles].sort((a, b) => {
    const dateDiff = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    if (Number.isFinite(dateDiff) && dateDiff !== 0) return dateDiff;
    return b.confidence - a.confidence;
  });
}

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
}

function PaginationControls({ currentPage, totalPages, onPrevious, onNext }: PaginationControlsProps) {
  return (
    <div className="tnmt-pagination">
      <button type="button" onClick={onPrevious} disabled={currentPage === 0}>
        <ChevronLeft size={16} /> Anterior
      </button>
      <span>Página {currentPage + 1} de {totalPages}</span>
      <button type="button" onClick={onNext} disabled={currentPage === totalPages - 1}>
        Siguiente <ChevronRight size={16} />
      </button>
    </div>
  );
}

function SignalMeter({ value, verdict }: { value: number; verdict: NewsVerdict }) {
  const percent = confidencePct(value);
  return (
    <div className="tnmt-signal-meter" aria-label={`Confianza ${percent}%`}>
      <span className={`tnmt-signal-meter__fill ${verdictClass(verdict)}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

function SourceCard({ source, index, onSelect }: { source: AnalyzedNewsSource; index: number; onSelect?: (article: AnalyzedNewsSource) => void }) {
  return (
    <article
      className={`tnmt-article-card ${verdictClass(source.verdict)}`}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={() => onSelect?.(source)}
      onKeyDown={(event) => {
        if (!onSelect) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(source);
        }
      }}
    >
      <div className="tnmt-article-card__top">
        <span className="tnmt-article-rank">#{String(index + 1).padStart(2, "0")}</span>
        <div className="tnmt-article-badges">
          <span className={`tnmt-verdict ${verdictClass(source.verdict)}`}>{source.verdict}</span>
          <span className={`tnmt-provider-badge ${providerClass(source.provider)}`}>{providerName(source.provider)}</span>
        </div>
      </div>

      <h4 title={source.title}>{source.title}</h4>
      <p>{source.summary || source.rationale || "Sin resumen disponible."}</p>

      <div className="tnmt-article-meta-grid">
        <span><CalendarDays size={13} /> {formatDate(source.publishedAt)}</span>
        <span><Gauge size={13} /> {confidencePct(source.confidence)}% confianza</span>
        <span><ShieldCheck size={13} /> {confidencePct(source.credibilityScore)}% credibilidad</span>
      </div>

      <SignalMeter value={source.confidence} verdict={source.verdict} />

      <div className="tnmt-tags">
        <span>Sentimiento: {source.sentiment}</span>
        {source.affectedSymbols.map((symbol) => <span key={symbol}>{symbol}</span>)}
      </div>

      {source.url && (
        <a className="tnmt-source-link" href={source.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
          Abrir noticia real <ExternalLink size={14} />
        </a>
      )}
    </article>
  );
}

function ProviderBreakdown({ articles }: { articles: AnalyzedNewsSource[] }) {
  const entries = Object.entries(articles.reduce<Record<string, number>>((acc, article) => {
    acc[article.provider] = (acc[article.provider] ?? 0) + 1;
    return acc;
  }, {}));

  if (entries.length === 0) return null;

  return (
    <div className="tnmt-provider-breakdown">
      <strong>Distribución visible por proveedor</strong>
      <div>
        {entries.map(([provider, count]) => (
          <span key={provider} className={`tnmt-provider-badge ${providerClass(provider)}`}>
            {providerName(provider)}: {count}
          </span>
        ))}
      </div>
    </div>
  );
}

function ArticlesCollection({
  title,
  subtitle,
  articles,
  currentPage,
  onPageChange,
  onArticleSelect
}: {
  title: string;
  subtitle: string;
  articles: AnalyzedNewsSource[];
  currentPage: number;
  onPageChange: (page: number) => void;
  onArticleSelect?: (article: AnalyzedNewsSource) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(articles.length / ITEMS_PER_PAGE));
  const startIdx = currentPage * ITEMS_PER_PAGE;
  const pageItems = articles.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  const shownFrom = articles.length === 0 ? 0 : startIdx + 1;
  const shownTo = Math.min(startIdx + pageItems.length, articles.length);

  return (
    <section className="tnmt-news-collection">
      <div className="tnmt-news-collection__header">
        <div>
          <p className="tnmt-eyebrow"><Newspaper size={15} /> Noticias encontradas</p>
          <h4>{title}</h4>
          <span>{subtitle}</span>
        </div>
        <div className="tnmt-news-collection__count">
          <strong>{articles.length}</strong>
          <span>noticias finales</span>
        </div>
      </div>

      <div className="tnmt-news-collection__range">
        Mostrando {shownFrom}-{shownTo} de {articles.length}. Cada tarjeta corresponde a una noticia real después de filtrar y quitar duplicados.
      </div>

      <div className="tnmt-articles-grid">
        {pageItems.map((article, index) => (
          <SourceCard key={article.id} source={article} index={startIdx + index} onSelect={onArticleSelect} />
        ))}
      </div>

      {totalPages > 1 && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPrevious={() => onPageChange(Math.max(0, currentPage - 1))}
          onNext={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
        />
      )}
    </section>
  );
}

export function AnalysisResult({ confluence, manualAnalysis, onArticleSelect }: AnalysisResultProps) {
  const [currentPageConfluence, setCurrentPageConfluence] = useState(0);
  const [currentPageManual, setCurrentPageManual] = useState(0);

  useEffect(() => {
    setCurrentPageConfluence(0);
  }, [confluence?.generatedAt, confluence?.symbol, confluence?.articles.length]);

  useEffect(() => {
    setCurrentPageManual(0);
  }, [manualAnalysis?.generatedAt, manualAnalysis?.symbol, manualAnalysis?.sources.length]);

  const sortedConfluenceArticles = useMemo(() => sortArticles(confluence?.articles ?? []), [confluence?.articles]);
  const sortedManualArticles = useMemo(() => sortArticles(manualAnalysis?.sources ?? []), [manualAnalysis?.sources]);

  if (!confluence && !manualAnalysis) {
    return <p className="tnmt-empty">Carga noticias reales del ticker o pega fuentes propias para ver resultados.</p>;
  }

  const noRealNews = confluence && confluence.articles.length === 0;

  return (
    <div className="tnmt-results">
      {confluence && (
        <section className="tnmt-result-block tnmt-result-block--featured">
          <div className="tnmt-result-header">
            <div>
              <p className="tnmt-eyebrow">Confluencia por noticias reales</p>
              <h3>{confluence.symbol} · {verdictLabel(confluence.verdict)}</h3>
              <span className="tnmt-result-timestamp">Actualizado: {formatDateTime(confluence.generatedAt)}</span>
            </div>
            <span className={`tnmt-score ${verdictClass(confluence.verdict)}`}>{scoreAsPercent(confluence.score)}/100</span>
          </div>

          <p className="tnmt-advice">{confluence.recommendation?.summary ?? "Señal generada desde noticias y sentimiento TNMT."}</p>

          <div className="tnmt-mini-grid">
            <span>Sentimiento <strong>{confluence.sentiment}</strong></span>
            <span>Confianza <strong>{confidencePct(confluence.confidence)}%</strong></span>
            <span>Noticias finales <strong>{confluence.articles.length}</strong></span>
            <span>Modo <strong>{confluence.realDataOnly ? "100% real" : "mixto"}</strong></span>
          </div>

          <ProviderBreakdown articles={confluence.articles} />

          {noRealNews ? (
            <div className="tnmt-no-data">
              <strong>No se encontraron noticias reales para este ticker.</strong>
              <p>Agrega llaves de Finnhub, NewsAPI, Polygon o Alpha Vantage en el .env para ampliar la cobertura. No se generaron noticias demo.</p>
            </div>
          ) : (
            <ArticlesCollection
              title={`Todas las noticias de ${confluence.symbol}`}
              subtitle="Ordenadas por fecha; da clic en cualquier tarjeta para abrir el detalle del análisis."
              articles={sortedConfluenceArticles}
              currentPage={currentPageConfluence}
              onPageChange={setCurrentPageConfluence}
              onArticleSelect={onArticleSelect}
            />
          )}
        </section>
      )}

      {manualAnalysis && (
        <section className="tnmt-result-block">
          <div className="tnmt-result-header">
            <div>
              <p className="tnmt-eyebrow">Análisis manual de fuentes</p>
              <h3>{manualAnalysis.symbol} · {verdictLabel(manualAnalysis.verdict)}</h3>
            </div>
            <span className={`tnmt-score ${verdictClass(manualAnalysis.verdict)}`}>{scoreAsPercent(manualAnalysis.sentimentScore)}/100</span>
          </div>

          <div className="tnmt-mini-grid">
            <span>BUY <strong>{manualAnalysis.buyCount}</strong></span>
            <span>HOLD <strong>{manualAnalysis.holdCount}</strong></span>
            <span>SELL <strong>{manualAnalysis.sellCount}</strong></span>
          </div>

          <ProviderBreakdown articles={manualAnalysis.sources} />
          <ArticlesCollection
            title={`Fuentes manuales de ${manualAnalysis.symbol}`}
            subtitle="Fuentes pegadas por el usuario y analizadas con el mismo motor de sentimiento."
            articles={sortedManualArticles}
            currentPage={currentPageManual}
            onPageChange={setCurrentPageManual}
            onArticleSelect={onArticleSelect}
          />
        </section>
      )}
    </div>
  );
}
