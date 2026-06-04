import { useEffect, useState } from "react";
import { ExternalLink, Newspaper, Sparkles } from "lucide-react";
import { getRelevantNews, type NewsCanonicalPayload, type NewsDateRange, type RelevantNewsItem } from "../../services/newsTeam06/newsTeam06Api";
import { getMarketQuotes, type MarketQuote } from "../../services/signals/marketApi";
import { NewsTeam06SourcesAnalyzer } from "../news-team06";

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

function addDaysIso(value: string | undefined, days: number): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatNewsWindow(dateRange?: NewsDateRange): string {
  if (!dateRange?.from && !dateRange?.to) return "Últimas noticias disponibles";
  const expandedFrom = addDaysIso(dateRange.from, -7) ?? "inicio";
  const expandedTo = addDaysIso(dateRange.to, 7) ?? "hoy";
  return `Ventana noticias: ${expandedFrom} → ${expandedTo} (rango estrategia ±7 días)`;
}

function trendFromTipo(tipo: NewsCanonicalPayload["aggregate"]["tipoSenal"]): "ALCISTA" | "BAJISTA" | "LATERAL" {
  if (tipo === "CALL") return "ALCISTA";
  if (tipo === "PUT") return "BAJISTA";
  return "LATERAL";
}

function formatQuote(quote: MarketQuote | null, loading: boolean): string {
  if (loading) return "Consultando...";
  if (!quote || !Number.isFinite(quote.price) || quote.price <= 0) return "No disponible";
  const change = quote.changePercent >= 0 ? `+${quote.changePercent.toFixed(2)}%` : `${quote.changePercent.toFixed(2)}%`;
  return `$${quote.price.toFixed(2)} USD (${change})`;
}

function CanonicalMiniTable({ rows }: { rows: Array<[string, string | number]> }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem", background: "#050505", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
      <thead>
        <tr style={{ background: "rgba(255,255,255,0.08)", color: "#bcd7ff", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <th style={{ textAlign: "left", padding: "0.62rem", borderBottom: "1px solid var(--color-border)", width: "38%" }}>Campo</th>
          <th style={{ textAlign: "left", padding: "0.62rem", borderBottom: "1px solid var(--color-border)" }}>Valor</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <td style={{ padding: "0.58rem 0.62rem", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "var(--color-text)", fontWeight: 700 }}>{label}</td>
            <td style={{ padding: "0.58rem 0.62rem", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "var(--color-text)", fontWeight: 750 }}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
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
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const ticker = symbol.trim().toUpperCase();
    if (!ticker) return () => {
      active = false;
    };

    setQuoteLoading(true);
    setQuote(null);
    getMarketQuotes([ticker])
      .then((data) => {
        if (!active) return;
        setQuote(data.quotes.find((item) => item.symbol.toUpperCase() === ticker) ?? null);
      })
      .catch(() => {
        if (active) setQuote(null);
      })
      .finally(() => {
        if (active) setQuoteLoading(false);
      });

    return () => {
      active = false;
    };
  }, [symbol]);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    getRelevantNews(symbol, 4, undefined, dateRange)
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
  }, [symbol, dateRange?.from, dateRange?.to]);

  return (
    <section className="card" style={{ padding: "var(--space-lg)", display: "grid", gap: "var(--space-md)", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-md)", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <Newspaper size={18} color="var(--color-accent)" />
            <h2 style={{ margin: 0, fontSize: "var(--font-size-lg)" }}>Noticias relevantes</h2>
          </div>
          <p style={{ margin: "0.4rem 0 0", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
            Últimos titulares vinculados a {symbol.toUpperCase()} con salida canónica para el core de IA. {formatNewsWindow(dateRange)}.
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
          No se encontraron noticias relevantes para este ticker dentro de la ventana seleccionada.
        </p>
      )}

      {!loading && !error && canonical && (
        <div style={{ display: "grid", gap: "0.75rem", padding: "var(--space-md)", border: "1px solid rgba(73, 79, 223, 0.45)", borderRadius: "var(--radius-md)", background: "rgba(73, 79, 223, 0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-sm)", flexWrap: "wrap" }}>
            <strong style={{ color: "var(--color-text)", fontSize: "var(--font-size-sm)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Señal de confluencia: {canonical.symbol}</strong>
            <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>{canonical.version}</span>
          </div>
          <CanonicalMiniTable
            rows={[
              ["Core", `${canonical.aggregate.core} / ${canonical.aggregate.subCore ?? "CANONICO"}`],
              ["Tipo Señal", canonical.aggregate.tipoSenal],
              ["Tendencia", trendFromTipo(canonical.aggregate.tipoSenal)],
              ["Score", canonical.aggregate.score.toFixed(3)],
              ["Peso", canonical.aggregate.peso.toFixed(3)],
              ["Invertir", "NO"],
              ["Estado", "ACTIVA"],
              ["Timeframe", "Noticias"],
              ["Fecha", canonical.generatedAt.slice(0, 10)],
              ["Ticker", canonical.symbol],
              ["Precio ticket", formatQuote(quote, quoteLoading)],
              ["Filas", canonical.rows.length],
            ]}
          />
          <div style={{ background: "#050505", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.85rem", display: "grid", gap: "0.45rem" }}>
            <strong style={{ color: "var(--color-text)", textTransform: "uppercase", fontSize: "0.82rem" }}>Observación</strong>
            <p style={{ margin: 0, color: "var(--color-text)", fontSize: "0.8rem", lineHeight: 1.55 }}><strong>Objetivo:</strong> {canonical.aggregate.observacion.objetivo}</p>
            <p style={{ margin: 0, color: "var(--color-text)", fontSize: "0.8rem", lineHeight: 1.55 }}><strong>Señal:</strong> {canonical.aggregate.observacion.senal}</p>
            <p style={{ margin: 0, color: "var(--color-text)", fontSize: "0.8rem", lineHeight: 1.55 }}><strong>Precio ticket:</strong> {formatQuote(quote, quoteLoading)}</p>
            <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "0.8rem", lineHeight: 1.55 }}><strong>Explicación:</strong> {canonical.aggregate.observacion.explicacion}</p>
          </div>
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
        <NewsTeam06SourcesAnalyzer symbol={symbol} dateRange={dateRange} />
      </div>
    </section>
  );
}

export default NewsSection;
