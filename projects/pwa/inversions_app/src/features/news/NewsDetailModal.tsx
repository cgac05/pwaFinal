import React from "react";
import { X } from "lucide-react";
import type { AnalyzedNewsSource } from "../../services/news/newsApi";

interface NewsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: AnalyzedNewsSource | null;
}

export function NewsDetailModal({ isOpen, onClose, article }: NewsDetailModalProps) {
  if (!isOpen || !article) return null;

  const publishDate = new Date(article.publishedAt);
  const formattedDate = publishDate.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

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
          width: "min(720px, 95vw)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-surface)",
          padding: 0,
          overflow: "hidden"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
            padding: "1.5rem",
            borderBottom: "1px solid var(--color-border)",
            background: "var(--color-surface-raised)",
            flexShrink: 0
          }}
        >
          <div style={{ flex: 1 }}>
            <h2 id="news-modal-title" style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "var(--color-text)", lineHeight: 1.2 }}>
              {article.title}
            </h2>
            <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", flexWrap: "wrap", fontSize: "0.8rem" }}>
              <span style={{ color: "var(--color-text-muted)" }}>📅 {formattedDate}</span>
              <span style={{ display: "inline-block", padding: "0.25rem 0.6rem", borderRadius: "999px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-muted)", fontSize: "0.75rem", fontWeight: 600 }}>
                {article.provider}
              </span>
              <span style={{ display: "inline-block", padding: "0.25rem 0.6rem", borderRadius: "999px", border: "1px solid var(--color-border)", background: article.sentiment === "positive" ? "rgba(46, 194, 126, 0.1)" : article.sentiment === "negative" ? "rgba(248, 81, 73, 0.1)" : "rgba(255, 255, 255, 0.05)", color: article.sentiment === "positive" ? "var(--color-buy)" : article.sentiment === "negative" ? "var(--color-sell)" : "var(--color-text-muted)", fontSize: "0.75rem", fontWeight: 600 }}>
                {article.sentiment === "positive" ? "✓ Positivo" : article.sentiment === "negative" ? "✗ Negativo" : "→ Neutral"}
              </span>
              <span style={{ display: "inline-block", padding: "0.25rem 0.6rem", borderRadius: "999px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-accent)", fontSize: "0.75rem", fontWeight: 600 }}>
                {article.verdict}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "transparent", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.5rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", transition: "all 0.2s ease", flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem", display: "grid", gap: "1rem" }}>
          {article.summary && (
            <div>
              <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Resumen</h3>
              <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.6, color: "var(--color-text)" }}>{article.summary}</p>
            </div>
          )}

          {article.rawText && (
            <div>
              <h3 style={{ margin: "1rem 0 0.75rem", fontSize: "0.9rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Contenido Completo</h3>
              <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.7, color: "var(--color-text)", whiteSpace: "pre-wrap", wordWrap: "break-word" }}>{article.rawText}</p>
            </div>
          )}

          {article.rationale && (
            <div style={{ padding: "1rem", borderRadius: "var(--radius-sm)", background: "var(--color-surface-raised)", border: "1px solid var(--color-border)" }}>
              <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Análisis</h3>
              <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.6, color: "var(--color-text)" }}>{article.rationale}</p>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", padding: "1rem", borderRadius: "var(--radius-sm)", background: "var(--color-surface-raised)", border: "1px solid var(--color-border)" }}>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Confianza</span>
              <p style={{ margin: "0.5rem 0 0", fontSize: "1rem", fontWeight: 700, color: "var(--color-text)" }}>{(article.confidence * 100).toFixed(0)}%</p>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Credibilidad</span>
              <p style={{ margin: "0.5rem 0 0", fontSize: "1rem", fontWeight: 700, color: "var(--color-text)" }}>{(article.credibilityScore * 100).toFixed(0)}%</p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", padding: "1rem 1.5rem", borderTop: "1px solid var(--color-border)", background: "var(--color-surface-raised)", flexShrink: 0 }}>
          {article.url && (
            <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: "0.7rem 1rem", borderRadius: "var(--radius-sm)", background: "var(--color-accent)", color: "#000", textDecoration: "none", fontWeight: 700, textAlign: "center", cursor: "pointer", transition: "opacity 0.2s ease" }}>
              Leer Noticia Completa →
            </a>
          )}
          <button type="button" onClick={onClose} style={{ padding: "0.7rem 1.5rem", borderRadius: "var(--radius-sm)", background: "transparent", border: "1px solid var(--color-border)", color: "var(--color-text)", fontWeight: 700, cursor: "pointer", transition: "all 0.2s ease" }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewsDetailModal;
