import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, KeyRound, Newspaper, Radio, RefreshCw, ShieldCheck } from "lucide-react";
import { analyzeNewsSources, getNewsConfluence, type NewsAnalysisAggregate, type NewsConfluenceResponse, type NewsDateRange, type NewsProviderStatus, type NewsSourceInput, type AnalyzedNewsSource } from "../../services/news/newsApi";
import { SourceInput } from "./SourceInput";
import { SourceList } from "./SourceList";
import { AnalysisResult } from "./AnalysisResult";
import { NewsDetailModal } from "./NewsDetailModal";
import "../styles/NewsSourcesAnalyzer.css";

interface NewsSourcesAnalyzerProps {
  symbol?: string;
  dateRange?: NewsDateRange;
  onArticleSelect?: (article: AnalyzedNewsSource) => void;
}

function ProviderPill({ provider }: { provider: NewsProviderStatus }) {
  const stateClass = provider.enabled ? (provider.ok ? "is-online" : "is-warning") : "is-offline";
  const rawCount = provider.rawCount ?? provider.count;
  const relevantCount = provider.relevantCount ?? provider.count;
  const stateText = provider.enabled ? (provider.ok ? `${rawCount} recibidas / ${relevantCount} relevantes` : "falló") : "sin key";
  const Icon = provider.enabled ? (provider.ok ? CheckCircle2 : AlertTriangle) : KeyRound;

  return (
    <div className={`tnmt-provider-pill ${stateClass}`} title={provider.message}>
      <div className="tnmt-provider-pill__top">
        <Icon size={15} />
        <span>{provider.label}</span>
      </div>
      <strong>{stateText}</strong>
      <small>{provider.message}</small>
    </div>
  );
}

function ProviderStatusSummary({ providers }: { providers: NewsProviderStatus[] }) {
  const enabled = providers.filter((provider) => provider.enabled).length;
  const ok = providers.filter((provider) => provider.enabled && provider.ok).length;
  const totalRawNews = providers.reduce((sum, provider) => sum + (provider.rawCount ?? provider.count ?? 0), 0);
  const totalRelevantNews = providers.reduce((sum, provider) => sum + (provider.relevantCount ?? provider.count ?? 0), 0);

  return (
    <div className="tnmt-provider-summary">
      <span>APIs configuradas: <strong>{enabled}/{providers.length}</strong></span>
      <span>APIs respondiendo: <strong>{ok}/{providers.length}</strong></span>
      <span>Noticias recibidas (crudas): <strong>{totalRawNews}</strong></span>
      <span>Noticias relevantes: <strong>{totalRelevantNews}</strong></span>
    </div>
  );
}

export function NewsSourcesAnalyzer({ symbol = "SPY", dateRange, onArticleSelect }: NewsSourcesAnalyzerProps) {
  const normalizedSymbol = symbol.trim().toUpperCase() || "SPY";
  const [activeSymbol, setActiveSymbol] = useState(normalizedSymbol);
  const [sources, setSources] = useState<NewsSourceInput[]>([]);
  const [confluence, setConfluence] = useState<NewsConfluenceResponse | null>(null);
  const [manualAnalysis, setManualAnalysis] = useState<NewsAnalysisAggregate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<AnalyzedNewsSource | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setActiveSymbol(normalizedSymbol);
  }, [normalizedSymbol]);

  const canAnalyzeManual = sources.length > 0;

  const loadTickerNews = async () => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const result = await getNewsConfluence(activeSymbol, 100, controller.signal, dateRange);
      setConfluence(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const analyzeManual = async (nextSources = sources) => {
    if (nextSources.length === 0) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeNewsSources(activeSymbol, nextSources, controller.signal);
      setManualAnalysis(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleArticleClick = (article: AnalyzedNewsSource) => {
    setSelectedArticle(article);
    setShowModal(true);
    onArticleSelect?.(article);
  };

  const handleAddSource = (source: NewsSourceInput) => {
    const nextSources = [...sources, source];
    setSources(nextSources);
    void analyzeManual(nextSources);
  };

  useEffect(() => {
    void loadTickerNews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSymbol, dateRange?.from, dateRange?.to]);

  return (
    <section className="tnmt-news-panel" id="noticias-sentimiento">
      <div className="tnmt-news-hero">
        <div className="tnmt-news-hero__copy">
          <div className="tnmt-eyebrow"><Newspaper size={16} /> TEAM-06 · Noticias reales y sentimiento</div>
          <h2>Confluencia de noticias con fuentes externas reales</h2>
          <p>
            El panel muestra de forma visible qué proveedor entregó cada noticia. Consulta Yahoo Finance RSS y, si configuras llaves,
            también Finnhub, NewsAPI, Polygon y Alpha Vantage. El modo demo fue eliminado.
          </p>
          <div className="tnmt-hero-stats">
            <span><Radio size={15} /> Real only</span>
            <span><BarChart3 size={15} /> Señal BUY/HOLD/SELL</span>
            <span><ShieldCheck size={15} /> Evidencia verificable</span>
          </div>
        </div>
        <div className="tnmt-symbol-box">
          <label>Símbolo</label>
          <input value={activeSymbol} onChange={(event) => setActiveSymbol(event.target.value.toUpperCase())} />
          <button type="button" onClick={loadTickerNews} disabled={loading}>
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>
      </div>

      {confluence?.providerStatus && (
        <div className="tnmt-provider-status-block" aria-label="Estado de proveedores de noticias">
          <div className="tnmt-provider-status-block__header">
            <div>
              <strong>Estado real de las APIs de noticias</strong>
              <p>Esto te dice exactamente si Yahoo, Finnhub, NewsAPI, Polygon y Alpha Vantage están entregando datos.</p>
            </div>
            <ProviderStatusSummary providers={confluence.providerStatus} />
          </div>
          <div className="tnmt-provider-grid">
            {confluence.providerStatus.map((provider) => <ProviderPill key={provider.id} provider={provider} />)}
          </div>
        </div>
      )}

      <div className="tnmt-news-actions">
        <button type="button" className="tnmt-primary-button" onClick={loadTickerNews} disabled={loading}>
          Cargar noticias reales del ticker
        </button>
        <button type="button" onClick={() => void analyzeManual()} disabled={!canAnalyzeManual || loading}>
          <ShieldCheck size={16} /> Analizar fuentes pegadas
        </button>
      </div>

      {error && <div className="tnmt-error">{error}</div>}

      <div className="tnmt-news-grid">
        <div className="tnmt-news-column">
          <SourceInput symbol={activeSymbol} onAdd={handleAddSource} />
          <SourceList
            sources={sources}
            onRemove={(id) => setSources((current) => current.filter((source) => (source.id ?? source.url ?? source.title) !== id))}
            onClear={() => {
              setSources([]);
              setManualAnalysis(null);
            }}
          />
        </div>
        <div className="tnmt-news-column tnmt-news-column--results">
          {loading && <div className="tnmt-loading">Consultando APIs reales y calculando sentimiento...</div>}
          <AnalysisResult confluence={confluence} manualAnalysis={manualAnalysis} onArticleSelect={handleArticleClick} />
        </div>
      </div>

      <NewsDetailModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedArticle(null);
        }}
        article={selectedArticle}
      />
    </section>
  );
}
