/**
 * src/features/news/NewsSourcesAnalyzer.tsx — Módulo Noticias 2
 * Análisis reactivo de sentimiento por ticker con fuentes predeterminadas.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── Fuentes predeterminadas ──────────────────────────────────────────────────
const PREDEFINED_SOURCES = [
  { id: 'nasdaq',       url: 'nasdaq.com',        label: 'Nasdaq',        icon: '📈' },
  { id: 'investing',    url: 'investing.com',      label: 'Investing',     icon: '💹' },
  { id: 'cnbc',         url: 'cnbc.com',           label: 'CNBC',          icon: '📺' },
  { id: 'bloomberg',    url: 'bloomberg.com',      label: 'Bloomberg',     icon: '🏦' },
  { id: 'reuters',      url: 'reuters.com',        label: 'Reuters',       icon: '📰' },
  { id: 'marketwatch',  url: 'marketwatch.com',    label: 'MarketWatch',   icon: '📊' },
  { id: 'yahoo',        url: 'finance.yahoo.com',  label: 'Yahoo Finance', icon: '🔷' },
  { id: 'seekingalpha', url: 'seekingalpha.com',   label: 'Seeking Alpha', icon: '🔍' },
];

const MAX_SOURCES = 5;

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface NewsArticleEvidence {
  headline: string;
  source: string;
  snippet: string;
  url: string;
  publishedAt: string;
  score: number;
  verdict: string;
}

export interface NewsAnalysisResult {
  company: string;
  verdict: 'BUY' | 'SELL' | 'HOLD';
  score: number;
  confidence: number;
  reasoning: string;
  keyPoints: string[];
  articles?: NewsArticleEvidence[];
  /** Nota del backend cuando la fuente seleccionada no tiene API key y se usó fallback */
  sourcesNote?: string | null;
  timestamp: string;
}

export interface NewsSourcesAnalyzerProps {
  selectedSymbol?: string;
  symbol?: string;           // alias compat con NewsSection
  watchlistSymbols?: string[];
  onResult?: (result: NewsAnalysisResult) => void;
  onSendToChat?: () => void; // Punto 1: disparado por el botón explícito
  dateRange?: { from?: string; to?: string };
}

// ─── Colores por veredicto ────────────────────────────────────────────────────
const V = {
  BUY:  { label: 'COMPRAR', bg: '#00c853', soft: 'rgba(0,200,83,0.12)',  text: '#fff', border: '#00c853' },
  SELL: { label: 'VENDER',  bg: '#ff1744', soft: 'rgba(255,23,68,0.12)', text: '#fff', border: '#ff1744' },
  HOLD: { label: 'ESPERAR', bg: '#ffa000', soft: 'rgba(255,160,0,0.12)', text: '#fff', border: '#ffa000' },
};

// ─── Mini ScoreBar ────────────────────────────────────────────────────────────
function ScoreBar({ value }: { value: number }) {
  // value en [-1, 1] → barra centrada en 50%
  const pct = Math.round((value + 1) / 2 * 100);
  const color = value > 0.1 ? '#00c853' : value < -0.1 ? '#ff1744' : '#ffa000';
  return (
    <div style={{ position: 'relative', height: 6, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', left: '50%', top: 0, height: '100%',
        width: `${Math.abs(value) * 50}%`,
        transform: value < 0 ? 'translateX(-100%)' : 'translateX(0)',
        background: color, borderRadius: 3,
        transition: 'width 0.6s ease',
      }} />
    </div>
  );
}

// Punto 1: mapa ID de fuente → proveedor(es) que devuelve el backend.
// Permite filtrar artículos recibidos sin importar qué proveedor los trajo.
const SOURCE_PROVIDER_MAP: Record<string, string[]> = {
  nasdaq:       ['yahooFinance'],
  yahoo:        ['yahooFinance'],
  cnbc:         ['newsapi'],
  bloomberg:    ['newsapi', 'polygon'],
  reuters:      ['newsapi'],
  marketwatch:  ['newsapi'],
  seekingalpha: ['newsapi'],
  investing:    ['finnhub', 'newsapi'],
};

// ─── Componente principal ─────────────────────────────────────────────────────
export const NewsSourcesAnalyzer: React.FC<NewsSourcesAnalyzerProps> = ({
  selectedSymbol: selectedSymbolProp,
  symbol,
  watchlistSymbols,
  onResult,
  onSendToChat,
  dateRange,
}) => {
  const selectedSymbol = selectedSymbolProp ?? symbol;

  const [selectedIds, setSelectedIds] = useState<string[]>(['nasdaq', 'investing', 'cnbc']);
  const [state, setState] = useState<{
    loading: boolean; error: string | null;
    result: NewsAnalysisResult | null; analyzedSymbol: string | null;
  }>({ loading: false, error: null, result: null, analyzedSymbol: null });
  // Bug 3 — controla el texto del botón: false = "Analizar", true = "Re-analizar"
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  // Ref para detectar cambios reales de ticker (evita reset en primer render)
  const prevSymbolRef = useRef<string | undefined>(undefined);

  const activeSources = PREDEFINED_SOURCES.filter(s => selectedIds.includes(s.id));

  // Punto 3 — Reset completo cuando cambia el ticker (estado limpio, sin auto-análisis)
  useEffect(() => {
    if (prevSymbolRef.current === undefined) {
      prevSymbolRef.current = selectedSymbol;
      return;
    }
    if (prevSymbolRef.current === selectedSymbol) return;
    prevSymbolRef.current = selectedSymbol;

    abortRef.current?.abort();
    setSelectedIds(['nasdaq', 'investing', 'cnbc']);
    setState({ loading: false, error: null, result: null, analyzedSymbol: null });
    setHasAnalyzed(false); // Bug 3 — vuelve a "Analizar" para el nuevo ticker
  }, [selectedSymbol]);

  // Limpieza al desmontar
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // ─── Análisis (SOLO se dispara manualmente desde el botón) ───────────────────
  const runAnalysis = useCallback(async (sym: string) => {
    if (!sym || activeSources.length === 0) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setState({ loading: true, error: null, result: null, analyzedSymbol: sym });
    let analysisResult: NewsAnalysisResult | null = null;
    try {
      const body: Record<string, unknown> = {
        company: sym,
        urls: activeSources.map(s => s.url),
      };
      if (dateRange?.from) body.from = dateRange.from;
      if (dateRange?.to)   body.to   = dateRange.to;

      const res = await fetch('/api/news/analyze-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? `Error ${res.status}`);
      }
      analysisResult = await res.json() as NewsAnalysisResult;
      setState({ loading: false, error: null, result: analysisResult, analyzedSymbol: sym });
      setHasAnalyzed(true);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setState(prev => ({ ...prev, loading: false, error: (err as Error).message }));
    }
    // onResult va FUERA del try: si el callback del padre lanza no afecta al componente
    if (analysisResult) {
      try { onResult?.(analysisResult); } catch { /* padre puede fallar sin romper el componente */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSources, dateRange, onResult, selectedIds]);

  // Punto 3 — toggles de fuente: solo actualizan estado, NO disparan fetch
  const toggleSource = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < MAX_SOURCES ? [...prev, id] : prev
    );
  };

  // Punto 3 — limpiar todas las fuentes seleccionadas
  const clearSources = () => setSelectedIds([]);

  const vm    = state.result ? V[state.result.verdict] : null;
  const other = (watchlistSymbols ?? []).filter(s => s !== selectedSymbol);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      fontFamily: 'var(--font-family)',
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: 'var(--color-surface-raised)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-accent)' }}>
              NOTICIAS 2
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>·</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Análisis de sentimiento en tiempo real
            </span>
          </div>
          {/* Otros tickers */}
          {other.length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: '0.67rem', color: 'var(--color-text-muted)' }}>Watchlist:</span>
              {other.map(s => (
                <span key={s} style={{
                  padding: '1px 7px', borderRadius: 'var(--radius-pill)',
                  background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                  fontSize: '0.67rem', color: 'var(--color-text-muted)',
                }}>{s}</span>
              ))}
            </div>
          )}
        </div>

        {/* Badge ticker activo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 16px', borderRadius: 'var(--radius-pill)',
          background: state.loading ? 'rgba(255,160,0,0.12)' : 'var(--color-accent-subtle)',
          border: `1px solid ${state.loading ? '#ffa000' : 'var(--color-accent)'}`,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: state.loading ? '#ffa000' : 'var(--color-accent)',
            display: 'inline-block',
            animation: state.loading ? 'pulse 1s infinite' : 'none',
          }} />
          <span style={{ fontWeight: 800, fontSize: '1rem', color: state.loading ? '#ffa000' : 'var(--color-accent)', letterSpacing: '0.04em' }}>
            {selectedSymbol ?? '—'}
          </span>
          {state.loading && <span style={{ fontSize: '0.7rem', color: '#ffa000' }}>analizando…</span>}
          {!selectedSymbol && <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>selecciona un ticker</span>}
        </div>
      </div>

      {/* ══ BODY ════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0 }}>

        {/* ── Columna izquierda: fuentes ── */}
        <div style={{
          borderRight: '1px solid var(--color-border-subtle)',
          padding: '16px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>
                Fuentes activas ({selectedIds.length}/{MAX_SOURCES})
              </p>
              {selectedIds.length > 0 && (
                <button
                  onClick={clearSources}
                  style={{
                    background: 'none', border: '1px solid var(--color-border)',
                    borderRadius: 6, padding: '2px 8px', cursor: 'pointer',
                    fontSize: '0.65rem', color: 'var(--color-text-muted)',
                    transition: 'color 0.15s',
                  }}
                  title="Deseleccionar todas las fuentes"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Cards de fuentes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PREDEFINED_SOURCES.map(src => {
                const active   = selectedIds.includes(src.id);
                const disabled = !active && selectedIds.length >= MAX_SOURCES;
                return (
                  <button
                    key={src.id}
                    onClick={() => !disabled && toggleSource(src.id)}
                    disabled={disabled}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.35 : 1,
                      background: active ? 'var(--color-accent-subtle)' : 'var(--color-bg)',
                      border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      transition: 'all 0.15s ease', textAlign: 'left', width: '100%',
                    }}
                  >
                    <span style={{ fontSize: '1rem', flexShrink: 0 }}>{src.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.78rem', fontWeight: active ? 700 : 400,
                        color: active ? 'var(--color-accent)' : 'var(--color-text)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {src.label}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)' }}>{src.url}</div>
                    </div>
                    {active && (
                      <span style={{
                        width: 18, height: 18, borderRadius: '50%',
                        background: 'var(--color-accent)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.6rem', fontWeight: 800, flexShrink: 0,
                      }}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedIds.length >= MAX_SOURCES && (
              <p style={{ margin: '8px 0 0', fontSize: '0.68rem', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
                ⚠ Máximo {MAX_SOURCES} fuentes
              </p>
            )}
          </div>

          {/* Bug 3 — botón dinámico: "Analizar" en primera vez, "Re-analizar" en subsecuentes */}
          <button
            onClick={() => { if (selectedSymbol) runAnalysis(selectedSymbol); }}
            disabled={state.loading || !selectedSymbol || activeSources.length === 0}
            style={{
              marginTop: 'auto', padding: '9px 16px', borderRadius: 8,
              background: state.loading ? 'var(--color-border)' : 'var(--color-accent)',
              color: '#fff', border: 'none', cursor: state.loading ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: '0.8rem', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            {state.loading ? '⏳ Analizando…' : hasAnalyzed ? '🔄 Re-analizar' : '🔍 Analizar'}
          </button>

          {!selectedSymbol && (
            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textAlign: 'center', fontStyle: 'italic' }}>
              Haz clic en un ticker del panel lateral
            </p>
          )}
        </div>

        {/* ── Columna derecha: resultado ── */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Vacío */}
          {!state.loading && !state.result && !state.error && (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: 200, color: 'var(--color-text-muted)', fontSize: '0.82rem', textAlign: 'center',
              flexDirection: 'column', gap: 8,
            }}>
              <span style={{ fontSize: '2rem' }}>📡</span>
              <span>{selectedSymbol ? `Preparando análisis para ${selectedSymbol}…` : 'Selecciona un ticker en la watchlist'}</span>
            </div>
          )}

          {/* Loading */}
          {state.loading && (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: 200, flexDirection: 'column', gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                border: '3px solid var(--color-border)',
                borderTop: '3px solid var(--color-accent)',
                animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                Consultando {activeSources.length} fuentes para <strong style={{ color: 'var(--color-accent)' }}>{state.analyzedSymbol}</strong>…
              </span>
            </div>
          )}

          {/* Error */}
          {state.error && !state.loading && (
            <div style={{
              padding: '12px 16px', borderRadius: 10,
              background: 'rgba(255,23,68,0.08)', border: '1px solid #ff1744',
              color: '#ff6b6b', fontSize: '0.82rem', display: 'flex', gap: 8,
            }}>
              <span>⚠</span><span>{state.error}</span>
            </div>
          )}

          {/* ─── Split Card: Razonamiento IA + Evidencia Cruda ─────────── */}
          {state.result && !state.loading && vm && (() => {
            const r = state.result!;
            return (
              <>
                {/* Nota de fuente alternativa cuando la seleccionada no tiene API key */}
                {r.sourcesNote && (
                  <div style={{
                    padding: '8px 12px', borderRadius: 8, marginBottom: 8,
                    background: 'rgba(255,160,0,0.1)', border: '1px solid #ffa00066',
                    fontSize: '0.72rem', color: '#ffa000', display: 'flex', gap: 8,
                  }}>
                    <span>⚠</span>
                    <span>{r.sourcesNote}</span>
                  </div>
                )}

                {/* ── Header veredicto ─────────────────────────────────── */}
                <div style={{
                  borderRadius: 12, overflow: 'hidden',
                  border: `1.5px solid ${vm.border}`, background: vm.soft, marginBottom: 12,
                }}>
                  <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{r.company}</div>
                      {dateRange?.from && (
                        <div style={{ fontSize: '0.67rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                          📅 {dateRange.from} → {dateRange.to ?? 'hoy'}
                        </div>
                      )}
                    </div>
                    <span style={{ padding: '6px 18px', borderRadius: 'var(--radius-pill)', background: vm.bg, color: '#fff', fontWeight: 900, fontSize: '0.95rem' }}>
                      {vm.label}
                    </span>
                  </div>
                  <div style={{ padding: '10px 18px', borderTop: `1px solid ${vm.border}33`, background: 'var(--color-surface-raised)', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {[
                      { label: 'Score',     value: ((r.score ?? 0) >= 0 ? '+' : '') + (r.score ?? 0).toFixed(2),         color: vm.bg },
                      { label: 'Confianza', value: `${((r.confidence ?? 0) * 100).toFixed(0)}%`,                  color: 'var(--color-text)' },
                      { label: 'Artículos', value: `${r.articles?.length ?? 0}`,                           color: 'var(--color-accent)' },
                    ].map(m => (
                      <div key={m.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.2rem', color: m.color }}>{m.value}</div>
                        <div style={{ fontSize: '0.63rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)' }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '8px 18px', background: 'var(--color-surface-raised)', borderTop: `1px solid ${vm.border}22` }}>
                    <div style={{ fontSize: '0.63rem', color: 'var(--color-text-muted)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Bajista</span><span>Neutral</span><span>Alcista</span>
                    </div>
                    <ScoreBar value={r.score ?? 0} />
                  </div>
                </div>

                {/* ── SPLIT CARD: Evidencia izquierda → Razonamiento derecha ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>

                  {/* Col 1 — Evidencia Cruda (causa) */}
                  <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--color-surface-raised)', border: `1px solid ${vm.border}44`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: vm.bg, display: 'flex', alignItems: 'center', gap: 5 }}>
                      📰 Evidencia Cruda
                    </div>

                    {(!r.articles || r.articles.length === 0) ? (
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        Sin artículos reales disponibles. Yahoo Finance RSS puede estar limitado para este ticker.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 280 }}>
                        {r.articles.slice(0, 4).map((art, i) => {
                          const artScore  = art.score      != null ? Number(art.score)      : 0;
                          const artColor  = artScore > 0.1 ? '#00c853' : artScore < -0.1 ? '#ff1744' : '#ffa000';
                          return (
                            <div key={i} style={{
                              padding: '8px 10px', borderRadius: 8,
                              background: 'var(--color-bg)',
                              border: `1px solid ${artColor}44`,
                            }}>
                              {/* Titular */}
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.4, marginBottom: 4 }}>
                                {art.headline}
                              </div>
                              {/* Fuente + fecha */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <span style={{ padding: '1px 6px', borderRadius: 4, background: artColor + '22', color: artColor, fontSize: '0.63rem', fontWeight: 700 }}>
                                  {art.source}
                                </span>
                                <span style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)' }}>
                                  {art.publishedAt ? new Date(art.publishedAt).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) : '—'}
                                </span>
                                <span style={{ marginLeft: 'auto', fontSize: '0.62rem', fontWeight: 700, color: artColor }}>
                                  {artScore >= 0 ? '+' : ''}{artScore.toFixed(2)}
                                </span>
                              </div>
                              {/* Snippet */}
                              {art.snippet && (
                                <p style={{ margin: '0 0 6px', fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                                  {art.snippet.slice(0, 120)}{art.snippet.length > 120 ? '…' : ''}
                                </p>
                              )}
                              {/* Enlace */}
                              {art.url && (
                                <a
                                  href={art.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    fontSize: '0.68rem', color: 'var(--color-accent)',
                                    textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3,
                                  }}
                                >
                                  Leer artículo original ↗
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Col 2 — Razonamiento IA (efecto) */}
                  <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      🧠 Razonamiento IA
                    </div>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.65, flex: 1 }}>
                      {r.reasoning || 'Sin razonamiento disponible.'}
                    </p>
                  </div>
                </div>

                {/* ── Botón enviar al Chat ─────────────────────────────── */}
                {onSendToChat && (
                  <button
                    onClick={onSendToChat}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      width: '100%', padding: '11px 20px', borderRadius: 10,
                      background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                      color: '#fff', border: 'none', cursor: 'pointer',
                      fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.03em',
                      boxShadow: '0 4px 14px rgba(79,70,229,0.35)', transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    💬 Enviar análisis al Chat IA
                  </button>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Animaciones */}
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  );
};
