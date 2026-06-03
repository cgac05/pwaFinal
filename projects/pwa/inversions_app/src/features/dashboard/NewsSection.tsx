import { useEffect, useState } from "react";
import { ExternalLink, Newspaper, Sparkles } from "lucide-react";
import { getRelevantNews, type NewsCanonicalPayload, type NewsDateRange, type RelevantNewsItem } from "../../services/news/newsApi";
import { NewsSourcesAnalyzer } from "../news/NewsSourcesAnalyzer";

type Props = {
  symbol: string;
  dateRange?: NewsDateRange;
};

const sentimentStyles: Record<NonNullable<RelevantNewsItem["sentiment"]>, { label: string; color: string; bg: string }> = {
  bullish: { label: "Alcista", color: "var(--color-buy)", bg: "rgba(0, 168, 126, 0.10)" },
  bearish: { label: "Bajista", color: "var(--color-sell)", bg: "rgba(211, 63, 63, 0.10)" },
  neutral: { label: "Neutral", color: "var(--color-hold)", bg: "rgba(236, 126, 0, 0.10)" },
};

function formatPublishedAt(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "Reciente";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function NewsCard({ item }: { item: RelevantNewsItem }) {
  const sentiment = item.sentiment ?? "neutral";
  const palette = sentimentStyles[sentiment];

  return (
    <article
      className="card"
      style={{
        padding: "var(--space-md)",
        display: "grid",
        gap: "var(--space-sm)",
        borderLeft: `3px solid ${palette.color}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-sm)" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <h3 style={{ margin: 0, fontSize: "var(--font-size-base)", lineHeight: 1.25 }}>{item.headline}</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: palette.color,
                background: palette.bg,
                border: `1px solid ${palette.color}33`,
                borderRadius: "var(--radius-pill)",
                padding: "2px 8px",
              }}
            >
              {palette.label}
            </span>
            {item.source && (
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{item.source}</span>
            )}
            {item.symbol && (
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{item.symbol}</span>
            )}
          </div>
        </div>
        <div style={{ flexShrink: 0, color: "var(--color-text-muted)" }}>
          <Newspaper size={16} />
        </div>
      </div>

      {item.summary && <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", lineHeight: 1.5 }}>{item.summary}</p>}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}>
        <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>{formatPublishedAt(item.publishedAt)}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          {typeof item.relevanceScore === "number" && (
            <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", display: "flex", alignItems: "center", gap: 4 }}>
              <Sparkles size={12} />
              Relevancia {Math.round(item.relevanceScore * 100)}%
            </span>
          )}
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--color-accent)", fontSize: "var(--font-size-xs)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              Abrir <ExternalLink size={12} />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function NewsSection({ symbol, dateRange }: Props) {
  const [items, setItems] = useState<RelevantNewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("demo");
  const [canonical, setCanonical] = useState<NewsCanonicalPayload | null>(null);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    getRelevantNews(symbol, 4)
      .then((response) => {
        if (!active) return;
        setItems(response.items);
        setSource(response.source);
        setCanonical(response.canonical ?? null);
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        setError(fetchError instanceof Error ? fetchError.message : "No se pudieron cargar las noticias.");
        setItems([]);
        setCanonical(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [symbol]);

  return (
    <section className="card" style={{ padding: "var(--space-lg)", display: "grid", gap: "var(--space-md)", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-md)", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <Newspaper size={18} color="var(--color-accent)" />
            <h2 style={{ margin: 0, fontSize: "var(--font-size-lg)" }}>Noticias relevantes</h2>
          </div>
          <p style={{ margin: "0.4rem 0 0", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
            Últimos titulares vinculados a {symbol.toUpperCase()} con salida canónica para el core de IA.
          </p>
        </div>
        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-pill)", padding: "2px 10px" }}>
          {source === "supabase" ? "Datos reales" : "Vista de respaldo"}
        </span>
      </div>

      {loading && (
        <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
          Cargando noticias...
        </p>
      )}

      {error && !loading && (
        <p style={{ margin: 0, color: "var(--color-sell)", fontSize: "var(--font-size-sm)" }}>
          {error}
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
          No se encontraron noticias para este ticker en el archivo local.
        </p>
      )}

      {!loading && !error && canonical && (
        <div style={{ display: "grid", gap: "0.65rem", padding: "var(--space-md)", border: "1px solid rgba(73, 79, 223, 0.45)", borderRadius: "var(--radius-md)", background: "rgba(73, 79, 223, 0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}>
            <strong style={{ color: "var(--color-text)", fontSize: "var(--font-size-sm)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Salida canónica estándar A_NOTICIAS</strong>
            <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>{canonical.version}</span>
          </div>
          <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
            <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>Tipo: <strong style={{ color: "var(--color-text)" }}>{canonical.aggregate.tipoSenal}</strong></span>
            <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>Score: <strong style={{ color: "var(--color-text)" }}>{canonical.aggregate.score.toFixed(3)}</strong></span>
            <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>Filas: <strong style={{ color: "var(--color-text)" }}>{canonical.rows.length}</strong></span>
          </div>
          <pre style={{ margin: 0, padding: "0.75rem", borderRadius: "var(--radius-sm)", background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)", fontSize: "0.72rem", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 160, overflowY: "auto" }}>{canonical.output}</pre>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div style={{ display: "grid", gap: "var(--space-sm)" }}>
          {items.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-md)" }}>
        <NewsSourcesAnalyzer symbol={symbol} dateRange={dateRange} />
      </div>
    </section>
  );
}

export default NewsSection;
