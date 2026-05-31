// FIC: News Section — integración de análisis de noticias reales en el dashboard principal.
// FIC: Muestra noticias clickeables que abren modal con detalles completos.

import React from "react";
import { Newspaper } from "lucide-react";
import type { NewsDateRange } from "../../services/news/newsApi";
import { NewsSourcesAnalyzer } from "../news/NewsSourcesAnalyzer";

interface NewsSectionProps {
  symbol?: string;
  dateRange?: NewsDateRange;
}

export function NewsSection({ symbol = "SPY", dateRange }: NewsSectionProps) {
  return (
    <section className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{
        background: "var(--color-surface-raised)",
        borderBottom: "1px solid var(--color-border)",
        padding: "var(--space-md) var(--space-lg)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-sm)"
      }}>
        <Newspaper size={18} style={{ color: "var(--color-accent)" }} />
        <h2 style={{ margin: 0, fontSize: "var(--font-size-lg)" }}>
          Análisis de Noticias — {symbol}
        </h2>
      </div>

      <div style={{ padding: "var(--space-lg)" }}>
        <NewsSourcesAnalyzer symbol={symbol} dateRange={dateRange} />
      </div>
    </section>
  );
}

export default NewsSection;
