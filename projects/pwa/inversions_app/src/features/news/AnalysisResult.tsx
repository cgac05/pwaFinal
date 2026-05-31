import { ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { AnalyzedNewsSource, NewsAnalysisAggregate, NewsConfluenceResponse, NewsVerdict } from "../../services/news/newsApi";

interface AnalysisResultProps {
  confluence?: NewsConfluenceResponse | null;
  manualAnalysis?: NewsAnalysisAggregate | null;
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

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
}

function PaginationControls({ currentPage, totalPages, onPrevious, onNext }: PaginationControlsProps) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "12px",
      padding: "16px 0",
      borderTop: "1px solid var(--color-border-subtle)",
      marginTop: "12px"
    }}>
      <button
        type="button"
        onClick={onPrevious}
        disabled={currentPage === 0}
        style={{
          background: currentPage === 0 ? "var(--color-surface)" : "var(--color-accent)",
          color: currentPage === 0 ? "var(--color-text-muted)" : "#fff",
          border: "none",
          borderRadius: "var(--radius-sm)",
          padding: "8px 12px",
          cursor: currentPage === 0 ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "0.875rem",
          fontWeight: 500,
          opacity: currentPage === 0 ? 0.5 : 1,
        }}
      >
        <ChevronLeft size={16} /> Anterior
      </button>
      
      <span style={{
        fontSize: "0.875rem",
        color: "var(--color-text-muted)",
        fontWeight: 500
      }}>
        Página {currentPage + 1} de {totalPages}
      </span>

      <button
        type="button"
        onClick={onNext}
        disabled={currentPage === totalPages - 1}
        style={{
          background: currentPage === totalPages - 1 ? "var(--color-surface)" : "var(--color-accent)",
          color: currentPage === totalPages - 1 ? "var(--color-text-muted)" : "#fff",
          border: "none",
          borderRadius: "var(--radius-sm)",
          padding: "8px 12px",
          cursor: currentPage === totalPages - 1 ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "0.875rem",
          fontWeight: 500,
          opacity: currentPage === totalPages - 1 ? 0.5 : 1,
        }}
      >
        Siguiente <ChevronRight size={16} />
      </button>
    </div>
  );
}

function SourceCard({ source }: { source: AnalyzedNewsSource }) {
  return (
    <article className="tnmt-article-card">
      <div className="tnmt-article-card__top">
        <div className="tnmt-article-badges">
          <span className={`tnmt-verdict ${verdictClass(source.verdict)}`}>{source.verdict}</span>
          <span className={`tnmt-provider-badge ${providerClass(source.provider)}`}>Fuente: {providerName(source.provider)}</span>
        </div>
        <span className="tnmt-confidence-label">{Math.round(source.confidence * 100)}% confianza</span>
      </div>
      <div className="tnmt-article-meta">
        <span>{formatDate(source.publishedAt)}</span>
        {source.url ? <span>URL verificable</span> : <span>Sin URL directa</span>}
      </div>
      <h4>{source.title}</h4>
      <p>{source.summary}</p>
      <div className="tnmt-tags">
        <span>Sentimiento: {source.sentiment}</span>
        <span>Credibilidad: {Math.round(source.credibilityScore * 100)}%</span>
        {source.affectedSymbols.map((symbol) => <span key={symbol}>{symbol}</span>)}
      </div>
      {source.url && (
        <a className="tnmt-source-link" href={source.url} target="_blank" rel="noreferrer">
          Abrir noticia real <ExternalLink size={14} />
        </a>
      )}
    </article>
  );
}

function ProviderBreakdown({ articles }: { articles: AnalyzedNewsSource[] }) {
  const counts = articles.reduce<Record<string, number>>((acc, article) => {
    acc[article.provider] = (acc[article.provider] ?? 0) + 1;
    return acc;
  }, {});

  const entries = Object.entries(counts);
  if (entries.length === 0) return null;

  return (
    <div className="tnmt-provider-breakdown">
      <strong>Noticias mostradas por proveedor:</strong>
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

export function AnalysisResult({ confluence, manualAnalysis }: AnalysisResultProps) {
  const [currentPageConfluence, setCurrentPageConfluence] = useState(0);
  const [currentPageManual, setCurrentPageManual] = useState(0);
  
  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
    setCurrentPageConfluence(0);
  }, [confluence?.generatedAt, confluence?.symbol, confluence?.articles.length]);

  useEffect(() => {
    setCurrentPageManual(0);
  }, [manualAnalysis?.generatedAt, manualAnalysis?.symbol, manualAnalysis?.sources.length]);

  if (!confluence && !manualAnalysis) {
    return <p className="tnmt-empty">Carga noticias reales del ticker o pega fuentes propias para ver resultados.</p>;
  }

  const noRealNews = confluence && confluence.articles.length === 0;

  // Ordenar y paginar artículos de confluencia (por confianza, mayor primero)
  const sortedConfluenceArticles = confluence?.articles 
    ? [...confluence.articles].sort((a, b) => b.confidence - a.confidence)
    : [];
  
  const confluencePages = Math.ceil(sortedConfluenceArticles.length / ITEMS_PER_PAGE);
  const confluenceStartIdx = currentPageConfluence * ITEMS_PER_PAGE;
  const confluenceEndIdx = confluenceStartIdx + ITEMS_PER_PAGE;
  const confluencePageItems = sortedConfluenceArticles.slice(confluenceStartIdx, confluenceEndIdx);

  // Ordenar y paginar artículos manuales (por confianza, mayor primero)
  const sortedManualArticles = manualAnalysis?.sources
    ? [...manualAnalysis.sources].sort((a, b) => b.confidence - a.confidence)
    : [];
  
  const manualPages = Math.ceil(sortedManualArticles.length / ITEMS_PER_PAGE);
  const manualStartIdx = currentPageManual * ITEMS_PER_PAGE;
  const manualEndIdx = manualStartIdx + ITEMS_PER_PAGE;
  const manualPageItems = sortedManualArticles.slice(manualStartIdx, manualEndIdx);

  return (
    <div className="tnmt-results">
      {confluence && (
        <section className="tnmt-result-block tnmt-result-block--featured">
          <div className="tnmt-result-header">
            <div>
              <p className="tnmt-eyebrow">Confluencia por noticias reales</p>
              <h3>{confluence.symbol} · {verdictLabel(confluence.verdict)}</h3>
            </div>
            <span className={`tnmt-score ${verdictClass(confluence.verdict)}`}>{Math.round((confluence.score + 1) * 50)}/100</span>
          </div>
          <p className="tnmt-advice">{confluence.recommendation?.summary ?? "Señal generada desde noticias y sentimiento TNMT."}</p>
          <div className="tnmt-mini-grid">
            <span>Sentimiento: <strong>{confluence.sentiment}</strong></span>
            <span>Confianza: <strong>{Math.round(confluence.confidence * 100)}%</strong></span>
            <span>Fuentes reales: <strong>{confluence.articles.length}</strong></span>
            <span>Modo: <strong>{confluence.realDataOnly ? "100% real" : "mixto"}</strong></span>
          </div>
          <ProviderBreakdown articles={confluence.articles} />

          {noRealNews ? (
            <div className="tnmt-no-data">
              <strong>No se encontraron noticias reales para este ticker.</strong>
              <p>Agrega llaves de Finnhub, NewsAPI, Polygon o Alpha Vantage en el .env para ampliar la cobertura. No se generaron noticias demo.</p>
            </div>
          ) : (
            <>
              <div className="tnmt-articles-grid">
                {confluencePageItems.map((article) => <SourceCard key={article.id} source={article} />)}
              </div>
              {confluencePages > 1 && (
                <PaginationControls
                  currentPage={currentPageConfluence}
                  totalPages={confluencePages}
                  onPrevious={() => setCurrentPageConfluence((p) => Math.max(0, p - 1))}
                  onNext={() => setCurrentPageConfluence((p) => Math.min(confluencePages - 1, p + 1))}
                />
              )}
            </>
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
            <span className={`tnmt-score ${verdictClass(manualAnalysis.verdict)}`}>{Math.round((manualAnalysis.sentimentScore + 1) * 50)}/100</span>
          </div>
          <div className="tnmt-mini-grid">
            <span>BUY: <strong>{manualAnalysis.buyCount}</strong></span>
            <span>HOLD: <strong>{manualAnalysis.holdCount}</strong></span>
            <span>SELL: <strong>{manualAnalysis.sellCount}</strong></span>
          </div>
          <ProviderBreakdown articles={manualAnalysis.sources} />
          <div className="tnmt-articles-grid">
            {manualPageItems.map((source) => <SourceCard key={source.id} source={source} />)}
          </div>
          {manualPages > 1 && (
            <PaginationControls
              currentPage={currentPageManual}
              totalPages={manualPages}
              onPrevious={() => setCurrentPageManual((p) => Math.max(0, p - 1))}
              onNext={() => setCurrentPageManual((p) => Math.min(manualPages - 1, p + 1))}
            />
          )}
        </section>
      )}
    </div>
  );
}
