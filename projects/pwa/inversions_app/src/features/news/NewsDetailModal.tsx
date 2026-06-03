import React from "react";
import { X } from "lucide-react";
import type { AnalyzedNewsSource, NewsCanonicalRow } from "../../services/news/newsApi";

interface NewsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: AnalyzedNewsSource | null;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function safeMetric(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return clamp01(numeric);
  return fallback;
}

function tipoFromVerdict(verdict: AnalyzedNewsSource["verdict"]): NewsCanonicalRow["tipoSenal"] {
  if (verdict === "BUY") return "CALL";
  if (verdict === "SELL") return "PUT";
  return "HOLD";
}

function signalFromTipo(tipo: NewsCanonicalRow["tipoSenal"]): "bullish" | "bearish" | "neutral" {
  if (tipo === "CALL") return "bullish";
  if (tipo === "PUT") return "bearish";
  return "neutral";
}

function decisionFromTipo(tipo: NewsCanonicalRow["tipoSenal"]): "buy" | "sell" | "wait" {
  if (tipo === "CALL") return "buy";
  if (tipo === "PUT") return "sell";
  return "wait";
}

function optionFromTipo(tipo: NewsCanonicalRow["tipoSenal"]): "call" | "put" | "n/a" {
  if (tipo === "CALL") return "call";
  if (tipo === "PUT") return "put";
  return "n/a";
}

function providerSubcore(provider: string): string {
  const clean = provider.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return clean ? `${clean}-DETALLE` : "NEWS-DETALLE";
}

function buildCanonicalOutput(row: NewsCanonicalRow): string {
  const signal = signalFromTipo(row.tipoSenal);
  const metrics = Object.entries(row.observacion.metricas ?? {})
    .map(([key, value], index) => (
      `SEÑAL_${String(index + 1).padStart(2, "0")}=${row.core}/${row.subCore ?? "GENERAL"}` +
      `|LECTURA=${String(value)}|IMPACTO=${signal}|PESO=${row.peso.toFixed(3)}` +
      `|JUSTIFICACIÓN=${key}: ${row.observacion.explicacion}`
    ))
    .join("; ") || "n/a";

  return [
    `CORE=${row.core}/${row.subCore ?? "GENERAL"}`,
    `OBJETIVO=${row.observacion.objetivo}`,
    `SEÑAL=${signal}`,
    `DECISIÓN=${decisionFromTipo(row.tipoSenal)}`,
    `OPCIÓN=${optionFromTipo(row.tipoSenal)}`,
    `EXPLICACIÓN_TÉCNICA=${row.observacion.explicacion}`,
    `CONFLUENCIA=[${metrics}]`,
    `RIESGO=${row.tipoSenal === "HOLD" ? "Riesgo mínimo — señal neutral, sin sesgo direccional claro" : "Riesgo moderado — validar noticia, fuente y contexto antes de operar"}`,
    `CONFIANZA=${Math.round(row.peso * 100)}`,
    `RESULTADO_FINAL=A_NOTICIAS emite señal ${signal} con score ${row.score.toFixed(3)}.`
  ].join(" || ");
}

function canonicalRowForArticle(article: AnalyzedNewsSource): NewsCanonicalRow {
  const confidence = safeMetric(article.confidence, 0.2);
  const credibility = safeMetric(article.credibilityScore, article.url ? 0.72 : 0.55);
  const peso = Number(clamp01(confidence * credibility).toFixed(3));
  const tipoSenal = tipoFromVerdict(article.verdict);
  const score = Number(clamp01(Math.abs(article.sentimentScore)) === 0 ? 0 : Math.max(-1, Math.min(1, article.sentimentScore * credibility)).toFixed(3));

  const fallback: Omit<NewsCanonicalRow, "canonicalOutput"> = {
    core: "A_NOTICIAS",
    subCore: providerSubcore(article.provider),
    tipoSenal,
    score,
    peso,
    observacion: {
      objetivo: article.title,
      senal: `${article.verdict} / ${article.sentiment}`,
      explicacion: article.rationale || article.summary || `Noticia real evaluada por A_NOTICIAS desde ${article.provider}.`,
      metricas: {
        SENTIMIENTO: article.sentimentScore,
        CONFIANZA: confidence,
        CREDIBILIDAD: credibility,
        PESO_CALCULADO: peso,
        CALCULO_PESO: `confianza(${confidence.toFixed(3)}) x credibilidad(${credibility.toFixed(3)}) = ${peso.toFixed(3)}`,
        PROVEEDOR: article.provider,
        URL_REAL: article.url ? "SI" : "NO"
      }
    }
  };

  const row = article.canonicalRow ?? { ...fallback, canonicalOutput: "" };
  return {
    ...row,
    peso: safeMetric(row.peso, peso),
    canonicalOutput: row.canonicalOutput || buildCanonicalOutput({ ...row, peso: safeMetric(row.peso, peso), canonicalOutput: "" })
  };
}

function formatMetricValue(value: number | string): string {
  if (typeof value === "number") {
    if (Math.abs(value) <= 1) return value.toFixed(3);
    return String(value);
  }
  return value;
}

export function NewsDetailModal({ isOpen, onClose, article }: NewsDetailModalProps) {
  if (!isOpen || !article) return null;

  const publishDate = new Date(article.publishedAt);
  const formattedDate = Number.isNaN(publishDate.getTime())
    ? "Fecha no disponible"
    : publishDate.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

  const canonicalRow = canonicalRowForArticle(article);
  const canonicalMetricsObject = canonicalRow.observacion.metricas ?? {};
  const canonicalMetrics = Object.entries(canonicalMetricsObject);
  const signal = signalFromTipo(canonicalRow.tipoSenal);
  const displayConfidence = safeMetric(canonicalMetricsObject.CONFIANZA ?? article.confidence, canonicalRow.peso || 0.2);
  const displayCredibility = safeMetric(canonicalMetricsObject.CREDIBILIDAD ?? article.credibilityScore, article.url ? 0.72 : 0.55);
  const displayPeso = safeMetric(canonicalMetricsObject.PESO_CALCULADO ?? canonicalRow.peso, canonicalRow.peso || 0);
  const displayFormula = String(canonicalMetricsObject.CALCULO_PESO ?? `confianza(${displayConfidence.toFixed(3)}) x credibilidad(${displayCredibility.toFixed(3)}) = ${displayPeso.toFixed(3)}`);

  const fieldCard = (label: string, value: React.ReactNode) => (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.7rem", background: "var(--color-surface)" }}>
      <div style={{ fontSize: "0.65rem", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <strong style={{ fontSize: "0.9rem" }}>{value}</strong>
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="news-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.25rem"
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: "min(960px, 96vw)",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-surface)",
          padding: 0,
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.55)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "1rem 1.25rem 0.75rem", display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-raised)" }}>
          <div style={{ flex: 1 }}>
            <h2 id="news-modal-title" style={{ margin: "0 0 0.25rem", fontSize: "1rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Detalle de Señal
            </h2>
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.78rem", margin: 0, fontWeight: 700 }}>
              A_NOTICIAS - {canonicalRow.subCore ?? article.provider} / Noticias
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: "transparent", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.5rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem", display: "grid", gap: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.65rem" }}>
            {fieldCard("Subcore", canonicalRow.subCore ?? "NEWS")}
            {fieldCard("Proveedor", article.provider)}
            {fieldCard("Señal", canonicalRow.tipoSenal)}
            {fieldCard("Tendencia", signal === "bullish" ? "ALCISTA" : signal === "bearish" ? "BAJISTA" : "LATERAL")}
            {fieldCard("Score", canonicalRow.score.toFixed(3))}
            {fieldCard("Peso", canonicalRow.peso.toFixed(3))}
            {fieldCard("Confianza", `${Math.round(displayConfidence * 100)}%`)}
            {fieldCard("Credibilidad", `${Math.round(displayCredibility * 100)}%`)}
            {fieldCard("Peso calculado", displayPeso.toFixed(3))}
            {fieldCard("Fecha", formattedDate)}
            {fieldCard("Veredicto", article.verdict)}
            {fieldCard("Sentimiento", article.sentiment)}
            {fieldCard("Fuente real", article.url ? "SI" : "NO")}
          </div>

          <div>
            <h3 style={{ margin: "0 0 0.6rem", fontSize: "0.98rem", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Observación</h3>
            <div style={{ fontSize: "0.82rem", lineHeight: 1.45 }}>
              <strong>Objetivo:</strong> {canonicalRow.observacion.objetivo}<br />
              <strong>Señal:</strong> {canonicalRow.observacion.senal}<br />
              <strong>Explicación:</strong> {canonicalRow.observacion.explicacion}
            </div>
          </div>

          <div>
            <h3 style={{ margin: "0 0 0.35rem", fontSize: "0.98rem", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Métricas consideradas para esta señal</h3>
            <p style={{ margin: "0 0 0.35rem", color: "var(--color-text-muted)", fontSize: "0.78rem" }}>
              Valores que A_NOTICIAS evaluó para emitir la señal {canonicalRow.tipoSenal} con score {canonicalRow.score.toFixed(3)}.
            </p>
            <p style={{ margin: "0 0 0.65rem", color: "var(--color-text)", fontSize: "0.78rem", fontWeight: 700 }}>
              Fórmula usada: {displayFormula}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
              {canonicalMetrics.length > 0
                ? canonicalMetrics.map(([key, value]) => fieldCard(key, formatMetricValue(value)))
                : fieldCard("Sin métricas", "-")}
            </div>
          </div>

          <div>
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.98rem", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Razonamiento</h3>
            <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.82rem", lineHeight: 1.55 }}>
              <li>El core <strong>A_NOTICIAS / {canonicalRow.subCore ?? article.provider}</strong> evaluó una noticia real y produjo score <strong>{canonicalRow.score.toFixed(3)}</strong>; el peso se calcula con <strong>{displayFormula}</strong>.</li>
              <li>La señal queda <strong>{canonicalRow.tipoSenal}</strong> porque el sentimiento normalizado es <strong>{article.sentiment}</strong>.</li>
              <li>La fuente visible es <strong>{article.provider}</strong>{article.url ? " y conserva URL verificable." : "."}</li>
            </ul>
          </div>

          <div style={{ padding: "1rem", borderRadius: "var(--radius-sm)", background: "rgba(73, 79, 223, 0.08)", border: "1px solid rgba(73, 79, 223, 0.45)", display: "grid", gap: "0.75rem" }}>
            <h3 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 800, color: "var(--color-accent)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Salida canónica estándar</h3>
            <pre style={{ margin: 0, padding: "0.85rem", borderRadius: "var(--radius-sm)", background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border)", fontSize: "0.72rem", lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 220, overflowY: "auto" }}>{canonicalRow.canonicalOutput}</pre>
          </div>

          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1rem", display: "grid", gap: "0.8rem" }}>
            <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Detalle visual de noticia</h3>
            <h4 style={{ margin: 0, fontSize: "1.1rem", color: "var(--color-text)", lineHeight: 1.25 }}>{article.title}</h4>
            {article.summary && <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.6, color: "var(--color-text)" }}>{article.summary}</p>}
            {article.rawText && <p style={{ margin: 0, fontSize: "0.86rem", lineHeight: 1.65, color: "var(--color-text-muted)", whiteSpace: "pre-wrap", wordWrap: "break-word" }}>{article.rawText}</p>}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", padding: "1rem 1.5rem", borderTop: "1px solid var(--color-border)", background: "var(--color-surface-raised)", flexShrink: 0 }}>
          {article.url && (
            <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: "0.7rem 1rem", borderRadius: "var(--radius-sm)", background: "var(--color-accent)", color: "#000", textDecoration: "none", fontWeight: 700, textAlign: "center", cursor: "pointer" }}>
              Leer Noticia Completa →
            </a>
          )}
          <button type="button" onClick={onClose} style={{ padding: "0.7rem 1.5rem", borderRadius: "var(--radius-sm)", background: "transparent", border: "1px solid var(--color-border)", color: "var(--color-text)", fontWeight: 700, cursor: "pointer" }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewsDetailModal;
