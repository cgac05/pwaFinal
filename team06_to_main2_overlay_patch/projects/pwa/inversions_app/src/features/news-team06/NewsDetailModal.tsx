import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { AnalyzedNewsSource, NewsCanonicalRow } from "../../services/news/newsApi";
import { getMarketQuotes, type MarketQuote } from "../../services/signals/marketApi";

interface NewsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: AnalyzedNewsSource | null;
  symbol?: string;
}

type SignalDirection = "bullish" | "bearish" | "neutral";

interface CanonicalField {
  campo: string;
  valor: string;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function safeMetric(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numeric)) return clamp01(numeric);
  return fallback;
}

function safeNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function tipoFromVerdict(verdict: AnalyzedNewsSource["verdict"]): NewsCanonicalRow["tipoSenal"] {
  if (verdict === "BUY") return "CALL";
  if (verdict === "SELL") return "PUT";
  return "HOLD";
}

function signalFromTipo(tipo: NewsCanonicalRow["tipoSenal"]): SignalDirection {
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

function trendFromSignal(signal: SignalDirection): string {
  if (signal === "bullish") return "ALCISTA";
  if (signal === "bearish") return "BAJISTA";
  return "LATERAL";
}

function sentimentLabel(value: AnalyzedNewsSource["sentiment"]): string {
  if (value === "positive") return "positive / alcista";
  if (value === "negative") return "negative / bajista";
  return "neutral / lateral";
}

function cleanText(value: string | undefined | null, fallback = "Sin contexto disponible."): string {
  const normalized = (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length > 0 ? normalized : fallback;
}

function splitSentences(value: string): string[] {
  return cleanText(value, "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function formatContextLine(value: string, maxLength = 290): string {
  const clean = cleanText(value, "");
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1).trim()}…` : clean;
}

function ensureFiveContextLines(lines: string[]): string {
  const cleanLines = lines
    .map((line) => formatContextLine(line))
    .filter(Boolean);

  while (cleanLines.length < 5) {
    cleanLines.push("Lectura adicional: el proveedor no entregó más cuerpo de la nota; se conserva el análisis con los datos disponibles sin inventar información externa.");
  }

  return cleanLines.slice(0, Math.max(5, cleanLines.length)).join("\n");
}

function buildNewsContext(article: AnalyzedNewsSource, symbol: string): string {
  const title = cleanText(article.title, `${symbol} - noticia sin título`);
  const summary = cleanText(article.summary, "");
  const rawText = cleanText(article.rawText, "");
  const combined = summary && rawText && rawText !== summary ? `${summary} ${rawText}` : summary || rawText || title;
  const sentences = splitSentences(combined);
  const firstDetail = sentences[0] || combined || title;
  const secondDetail = sentences[1] || sentences[0] || combined || title;
  const confidence = Number.isFinite(article.confidence) ? article.confidence.toFixed(3) : "n/a";
  const credibility = Number.isFinite(article.credibilityScore) ? article.credibilityScore.toFixed(3) : "n/a";
  const sentiment = article.sentiment === "positive" ? "alcista/positiva" : article.sentiment === "negative" ? "bajista/negativa" : "neutral";

  return ensureFiveContextLines([
    `Titular: ${title}`,
    `Resumen principal: ${firstDetail}`,
    `Detalle de contexto: ${secondDetail}`,
    `Lectura para ${symbol}: proveedor=${article.provider}, veredicto=${article.verdict}, sentimiento=${sentiment}, score=${article.sentimentScore}.`,
    `Peso del análisis: confianza=${confidence}, credibilidad=${credibility}; estos valores determinan qué tanto influye la noticia en A_NOTICIAS.`,
    `Fecha y evidencia: publicada el ${formatPublishedDate(article.publishedAt)}; fuente=${article.url ?? "URL no disponible"}.`,
  ]);
}

function formatPublishedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatPublishedDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return date.toISOString().slice(0, 10);
}

function formatPrice(quote: MarketQuote | null): string {
  if (!quote || !Number.isFinite(quote.price)) return "No disponible";
  return `$${quote.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMetricValue(value: number | string): string {
  if (typeof value === "number") {
    if (Math.abs(value) <= 1) return value.toFixed(3);
    return String(value);
  }
  return value;
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "") || "A_NOTICIAS";
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildCanonicalOutput(
  row: NewsCanonicalRow,
  article: AnalyzedNewsSource,
  symbol: string,
  context: string,
  priceLabel: string,
  formattedDate: string
): string {
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
    `TICKER=${symbol}`,
    `PRECIO_TICKER=${priceLabel}`,
    `FECHA_NOTICIA=${formattedDate}`,
    `OBJETIVO=${row.observacion.objetivo}`,
    `CONTEXTO_NOTICIA=${context}`,
    `SEÑAL=${signal}`,
    `DECISIÓN=${decisionFromTipo(row.tipoSenal)}`,
    `OPCIÓN=${optionFromTipo(row.tipoSenal)}`,
    `EXPLICACIÓN_TÉCNICA=${row.observacion.explicacion}`,
    `CONFLUENCIA=[${metrics}]`,
    `RIESGO=${row.tipoSenal === "HOLD" ? "Riesgo mínimo — señal neutral, sin sesgo direccional claro" : "Riesgo moderado — validar noticia, fuente y contexto antes de operar"}`,
    `CONFIANZA=${Math.round(row.peso * 100)}`,
    `FUENTE=${article.provider}`,
    `FUENTE_URL=${article.url ?? "n/a"}`,
    `RESULTADO_FINAL=A_NOTICIAS emite señal ${signal} con score ${row.score.toFixed(3)} para ${symbol}.`
  ].join(" || ");
}

function canonicalRowForArticle(
  article: AnalyzedNewsSource,
  symbol: string,
  quote: MarketQuote | null,
  context: string,
  formattedDate: string
): NewsCanonicalRow {
  const confidence = safeMetric(article.confidence, 0.2);
  const credibility = safeMetric(article.credibilityScore, article.url ? 0.72 : 0.55);
  const peso = Number(clamp01(confidence * credibility).toFixed(3));
  const tipoSenal = tipoFromVerdict(article.verdict);
  const score = Number((Math.max(-1, Math.min(1, safeNumber(article.sentimentScore, 0) * credibility))).toFixed(3));
  const priceLabel = formatPrice(quote);

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
        TICKER: symbol,
        PRECIO_TICKER: priceLabel,
        FECHA_NOTICIA: formattedDate,
        SENTIMIENTO: safeNumber(article.sentimentScore, 0),
        CONFIANZA: confidence,
        CREDIBILIDAD: credibility,
        PESO_CALCULADO: peso,
        CALCULO_PESO: `confianza(${confidence.toFixed(3)}) x credibilidad(${credibility.toFixed(3)}) = ${peso.toFixed(3)}`,
        PROVEEDOR: article.provider,
        URL_REAL: article.url ? "SI" : "NO"
      }
    }
  };

  const sourceRow = article.canonicalRow;
  const mergedRow: NewsCanonicalRow = {
    ...fallback,
    ...(sourceRow ?? {}),
    subCore: sourceRow?.subCore ?? fallback.subCore,
    tipoSenal: sourceRow?.tipoSenal ?? fallback.tipoSenal,
    score: typeof sourceRow?.score === "number" ? sourceRow.score : fallback.score,
    peso: typeof sourceRow?.peso === "number" ? sourceRow.peso : fallback.peso,
    observacion: {
      objetivo: sourceRow?.observacion?.objetivo || fallback.observacion.objetivo,
      senal: sourceRow?.observacion?.senal || fallback.observacion.senal,
      explicacion: sourceRow?.observacion?.explicacion || fallback.observacion.explicacion,
      metricas: {
        ...fallback.observacion.metricas,
        ...(sourceRow?.observacion?.metricas ?? {}),
        TICKER: symbol,
        PRECIO_TICKER: priceLabel,
        FECHA_NOTICIA: formattedDate,
        CONTEXTO_NOTICIA: context
      }
    },
    canonicalOutput: ""
  };

  const normalizedPeso = safeMetric(mergedRow.peso, peso);
  const normalizedRow = { ...mergedRow, peso: normalizedPeso };
  return {
    ...normalizedRow,
    canonicalOutput: buildCanonicalOutput(normalizedRow, article, symbol, context, priceLabel, formattedDate)
  };
}

function buildExportContent(params: {
  symbol: string;
  article: AnalyzedNewsSource;
  row: NewsCanonicalRow;
  context: string;
  priceLabel: string;
  formattedDate: string;
  generatedAt: string;
}): { plain: string; markdown: string } {
  const { symbol, article, row, context, priceLabel, formattedDate, generatedAt } = params;
  const metrics = Object.entries(row.observacion.metricas ?? {})
    .map(([key, value]) => `- ${key}: ${formatMetricValue(value)}`)
    .join("\n");
  const signal = signalFromTipo(row.tipoSenal);
  const plain = [
    `SEÑAL DE CONFLUENCIA: ${symbol}`,
    "",
    `Core: ${row.core} / ${row.subCore ?? "NEWS"}`,
    `Tipo Señal: ${row.tipoSenal}`,
    `Tendencia: ${trendFromSignal(signal)}`,
    `Score: ${row.score.toFixed(3)}`,
    `Peso: ${row.peso.toFixed(3)}`,
    `Invertir: NO`,
    `Estado: ACTIVA`,
    `Timeframe: Noticias`,
    `Fecha: ${formattedDate}`,
    `Precio ticket: ${priceLabel}`,
    `Proveedor: ${article.provider}`,
    "",
    "OBSERVACIÓN",
    `Objetivo: ${row.observacion.objetivo}`,
    `Contexto de la noticia: ${context}`,
    `Señal: ${row.observacion.senal}`,
    `Explicación: ${row.observacion.explicacion}`,
    "",
    "MÉTRICAS CONSIDERADAS",
    metrics || "- Sin métricas",
    "",
    "RAZONAMIENTO",
    `- El core ${row.core} / ${row.subCore ?? "NEWS"} evaluó una noticia real de ${article.provider}.`,
    `- El precio del ticket usado como contexto fue ${priceLabel}.`,
    `- La señal ${row.tipoSenal} sale del sentimiento ${article.sentiment} y del peso ${row.peso.toFixed(3)}.`,
    "",
    "QUÉ SE USÓ PARA EL CÁLCULO",
    `- Insumos del score: sentimiento=${article.sentimentScore}, confianza=${article.confidence}, credibilidad=${article.credibilityScore}.`,
    `- Objetivo del análisis: ${row.observacion.objetivo}`,
    `- Algoritmo / versión: A_NOTICIAS canonical-output-v1`,
    `- Fuente de datos: ${article.provider}`,
    `- Timeframe evaluado: Noticias / fecha ${formattedDate}`,
    `- Calculado: ${generatedAt}`,
    `- Hash de insumos: ${article.id}`,
    "",
    "EVIDENCIA",
    `- ${article.id}`,
    article.url ? `- ${article.url}` : "- URL no disponible",
    "",
    "SALIDA CANÓNICA",
    row.canonicalOutput
  ].join("\n");

  const markdown = [
    `# Señal de confluencia: ${symbol}`,
    "",
    "| Campo | Valor |",
    "|---|---|",
    `| Core | ${row.core} / ${row.subCore ?? "NEWS"} |`,
    `| Tipo Señal | ${row.tipoSenal} |`,
    `| Tendencia | ${trendFromSignal(signal)} |`,
    `| Score | ${row.score.toFixed(3)} |`,
    `| Peso | ${row.peso.toFixed(3)} |`,
    `| Invertir | NO |`,
    `| Estado | ACTIVA |`,
    `| Timeframe | Noticias |`,
    `| Fecha | ${formattedDate} |`,
    `| Precio ticket | ${priceLabel} |`,
    `| Proveedor | ${article.provider} |`,
    "",
    "## Observación",
    `**Objetivo:** ${row.observacion.objetivo}`,
    "",
    `**Contexto de la noticia:** ${context}`,
    "",
    `**Señal:** ${row.observacion.senal}`,
    "",
    `**Explicación:** ${row.observacion.explicacion}`,
    "",
    "## Métricas consideradas",
    metrics || "- Sin métricas",
    "",
    "## Razonamiento",
    `- El core **${row.core} / ${row.subCore ?? "NEWS"}** evaluó una noticia real de **${article.provider}**.`,
    `- El precio del ticket usado como contexto fue **${priceLabel}**.`,
    `- La señal **${row.tipoSenal}** sale del sentimiento **${article.sentiment}** y del peso **${row.peso.toFixed(3)}**.`,
    "",
    "## Qué se usó para el cálculo",
    `- Insumos del score: sentimiento=${article.sentimentScore}, confianza=${article.confidence}, credibilidad=${article.credibilityScore}.`,
    `- Objetivo del análisis: ${row.observacion.objetivo}`,
    `- Algoritmo / versión: A_NOTICIAS canonical-output-v1`,
    `- Fuente de datos: ${article.provider}`,
    `- Timeframe evaluado: Noticias / fecha ${formattedDate}`,
    `- Calculado: ${generatedAt}`,
    `- Hash de insumos: ${article.id}`,
    "",
    "## Evidencia",
    `- ${article.id}`,
    article.url ? `- ${article.url}` : "- URL no disponible",
    "",
    "## Salida canónica",
    "```txt",
    row.canonicalOutput,
    "```"
  ].join("\n");

  return { plain, markdown };
}

export function NewsDetailModal({ isOpen, onClose, article, symbol }: NewsDetailModalProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const displaySymbol = (symbol ?? article?.affectedSymbols?.find((item) => /^[A-Z.]{1,6}$/.test(item)) ?? "SPY").trim().toUpperCase() || "SPY";

  useEffect(() => {
    let cancelled = false;
    if (!isOpen || !displaySymbol) {
      setQuote(null);
      return () => { cancelled = true; };
    }

    setQuote(null);
    getMarketQuotes([displaySymbol])
      .then((data) => {
        if (cancelled) return;
        const nextQuote = data.quotes.find((item) => item.symbol.toUpperCase() === displaySymbol) ?? null;
        setQuote(nextQuote);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      });

    return () => { cancelled = true; };
  }, [isOpen, displaySymbol]);

  if (!isOpen || !article) return null;

  const formattedDate = formatPublishedDate(article.publishedAt);
  const formattedDay = formatPublishedDay(article.publishedAt);
  const context = buildNewsContext(article, displaySymbol);
  const priceLabel = formatPrice(quote);
  const canonicalRow = canonicalRowForArticle(article, displaySymbol, quote, context, formattedDate);
  const canonicalMetrics = Object.entries(canonicalRow.observacion.metricas ?? {});
  const signal = signalFromTipo(canonicalRow.tipoSenal);
  const generatedAt = new Date().toISOString();
  const exportContent = buildExportContent({
    symbol: displaySymbol,
    article,
    row: canonicalRow,
    context,
    priceLabel,
    formattedDate,
    generatedAt
  });
  const baseFilename = sanitizeFilename(`A_NOTICIAS-${displaySymbol}-${formattedDay}-${article.provider}`);
  const canonicalFields: CanonicalField[] = [
    { campo: "Core", valor: `${canonicalRow.core} / ${canonicalRow.subCore ?? "NEWS"}` },
    { campo: "Tipo Señal", valor: canonicalRow.tipoSenal },
    { campo: "Tendencia", valor: trendFromSignal(signal) },
    { campo: "Score", valor: canonicalRow.score.toFixed(3) },
    { campo: "Peso", valor: canonicalRow.peso.toFixed(3) },
    { campo: "Invertir", valor: "NO" },
    { campo: "Estado", valor: "ACTIVA" },
    { campo: "Timeframe", valor: "Noticias" },
    { campo: "Fecha", valor: formattedDay },
    { campo: "Ticker", valor: displaySymbol },
    { campo: "Precio ticket", valor: priceLabel },
    { campo: "Proveedor", valor: article.provider },
    { campo: "Sentimiento", valor: sentimentLabel(article.sentiment) },
    { campo: "Fuente real", valor: article.url ? "SI" : "NO" }
  ];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportContent.plain);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      // FIC: Clipboard may be blocked by browser permissions.
    }
    setDropdownOpen(false);
  };

  const handleDownloadTxt = () => {
    downloadTextFile(`${baseFilename}.txt`, exportContent.plain, "text/plain;charset=utf-8");
    setDropdownOpen(false);
  };

  const handleDownloadMd = () => {
    downloadTextFile(`${baseFilename}.md`, exportContent.markdown, "text/markdown;charset=utf-8");
    setDropdownOpen(false);
  };

  const handleDownloadPdf = () => {
    if (!contentRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${baseFilename}</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; color: #1f2328; padding: 36px; line-height: 1.55; }
            h1 { font-size: 22px; margin: 0 0 18px; }
            h2 { font-size: 16px; margin-top: 22px; text-transform: uppercase; letter-spacing: 0.04em; }
            table { width: 100%; border-collapse: collapse; margin: 14px 0 22px; font-size: 12px; }
            th, td { border-bottom: 1px solid #d0d7de; padding: 9px 10px; text-align: left; vertical-align: top; }
            th { background: #f6f8fa; text-transform: uppercase; font-size: 11px; color: #57606a; }
            ul { padding-left: 22px; }
            li { margin-bottom: 5px; }
            pre { white-space: pre-wrap; word-break: break-word; background: #f6f8fa; padding: 12px; border: 1px solid #d0d7de; border-radius: 6px; }
          </style>
        </head>
        <body>${contentRef.current.innerHTML}</body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
    setDropdownOpen(false);
  };

  const optionButtonStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "0.5rem 0.9rem",
    fontSize: "0.78rem",
    background: "none",
    border: "none",
    color: "var(--color-text)",
    cursor: "pointer"
  };

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
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ padding: "1rem 1.25rem 0.75rem", display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-raised)" }}>
          <div style={{ flex: 1 }}>
            <h2 id="news-modal-title" style={{ margin: "0 0 0.25rem", fontSize: "1rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Detalle de Señal
            </h2>
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.78rem", margin: 0, fontWeight: 700 }}>
              A_NOTICIAS - {canonicalRow.subCore ?? article.provider} / Noticias · {displaySymbol} · Precio ticket: {priceLabel}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: "transparent", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.5rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem", display: "grid", gap: "1rem" }}>
          <section style={{ display: "grid", gap: "0.75rem" }}>
            <h3 style={{ margin: 0, fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-muted)" }}>Observaciones</h3>
            <div style={{ background: "var(--color-surface-raised)", borderRadius: "var(--radius-sm)", padding: "0.85rem", border: "1px solid var(--color-border)", display: "grid", gap: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", margin: 0 }}>
                  Salida canónica según estándar de equipo. Formato auditable y comparable entre cores.
                </p>

                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setDropdownOpen((open) => !open)}
                    style={{ fontSize: "0.75rem", padding: "0.3rem 0.7rem" }}
                  >
                    {copyFeedback ? "✓ Copiado" : "Opciones ▾"}
                  </button>

                  {dropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        right: 0,
                        background: "var(--color-surface-raised)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-sm)",
                        zIndex: 20,
                        minWidth: 150,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.4)"
                      }}
                    >
                      <button type="button" onClick={handleCopy} style={optionButtonStyle}>Copiar texto</button>
                      <button type="button" onClick={handleDownloadTxt} style={optionButtonStyle}>Descargar .txt</button>
                      <button type="button" onClick={handleDownloadMd} style={optionButtonStyle}>Descargar .md</button>
                      <button type="button" onClick={handleDownloadPdf} style={optionButtonStyle}>Descargar .pdf</button>
                    </div>
                  )}
                </div>
              </div>

              <div
                ref={contentRef}
                style={{
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "1rem",
                  maxHeight: 520,
                  overflowY: "auto",
                  color: "var(--color-text)",
                  fontSize: "0.82rem",
                  lineHeight: 1.55
                }}
              >
                <h1 style={{ margin: "0 0 1rem", fontSize: "0.95rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Señal de confluencia: {displaySymbol}
                </h1>

                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1rem" }}>
                  <thead>
                    <tr style={{ background: "var(--color-surface-raised)", color: "var(--color-text-muted)", textTransform: "uppercase", fontSize: "0.72rem" }}>
                      <th style={{ textAlign: "left", padding: "0.65rem", borderBottom: "1px solid var(--color-border)" }}>Campo</th>
                      <th style={{ textAlign: "left", padding: "0.65rem", borderBottom: "1px solid var(--color-border)" }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {canonicalFields.map((field) => (
                      <tr key={field.campo}>
                        <td style={{ padding: "0.58rem 0.65rem", borderBottom: "1px solid rgba(255,255,255,0.08)", fontWeight: 700 }}>{field.campo}</td>
                        <td style={{ padding: "0.58rem 0.65rem", borderBottom: "1px solid rgba(255,255,255,0.08)", fontWeight: 700 }}>{field.valor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h2 style={{ margin: "1rem 0 0.45rem", fontSize: "0.85rem", textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.04em" }}>Observación</h2>
                <p style={{ margin: "0 0 0.35rem" }}><strong>Objetivo:</strong> {canonicalRow.observacion.objetivo}</p>
                <p style={{ margin: "0 0 0.35rem", whiteSpace: "pre-line" }}><strong>Contexto de la noticia:</strong><br />{context}</p>
                <p style={{ margin: "0 0 0.35rem" }}><strong>Precio ticket:</strong> {displaySymbol} {priceLabel}</p>
                <p style={{ margin: "0 0 0.35rem" }}><strong>Señal:</strong> {canonicalRow.observacion.senal}</p>
                <p style={{ margin: 0 }}><strong>Explicación:</strong> {canonicalRow.observacion.explicacion}</p>

                <h2 style={{ margin: "1rem 0 0.45rem", fontSize: "0.85rem", textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.04em" }}>Métricas consideradas</h2>
                <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                  {canonicalMetrics.map(([key, value]) => (
                    <li key={key} style={{ whiteSpace: "pre-line" }}><strong>{key}:</strong> {formatMetricValue(value)}</li>
                  ))}
                </ul>

                <h2 style={{ margin: "1rem 0 0.45rem", fontSize: "0.85rem", textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.04em" }}>Razonamiento</h2>
                <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                  <li>El core <strong>A_NOTICIAS / {canonicalRow.subCore ?? article.provider}</strong> evaluó el contexto de una noticia real de <strong>{article.provider}</strong>.</li>
                  <li>El precio del ticket se usa como dato de contexto: <strong>{displaySymbol} {priceLabel}</strong>.</li>
                  <li>La señal queda <strong>{canonicalRow.tipoSenal}</strong> con tendencia <strong>{trendFromSignal(signal)}</strong>, score <strong>{canonicalRow.score.toFixed(3)}</strong> y peso <strong>{canonicalRow.peso.toFixed(3)}</strong>.</li>
                </ul>

                <h2 style={{ margin: "1rem 0 0.45rem", fontSize: "0.85rem", textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.04em" }}>Qué se usó para el cálculo</h2>
                <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                  <li><strong>Insumos del score:</strong> sentimiento={article.sentimentScore}, confianza={article.confidence}, credibilidad={article.credibilityScore}, peso={canonicalRow.peso.toFixed(3)}.</li>
                  <li><strong>Objetivo del análisis:</strong> {canonicalRow.observacion.objetivo}</li>
                  <li><strong>Algoritmo / versión:</strong> A_NOTICIAS canonical-output-v1</li>
                  <li><strong>Fuente de datos:</strong> {article.provider}</li>
                  <li><strong>Timeframe evaluado:</strong> Noticias / fecha {formattedDate}</li>
                  <li><strong>Calculado:</strong> {generatedAt}</li>
                  <li><strong>Hash de insumos:</strong> {article.id}</li>
                </ul>

                <h2 style={{ margin: "1rem 0 0.45rem", fontSize: "0.85rem", textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.04em" }}>Evidencia</h2>
                <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                  <li>{article.id}</li>
                  <li>{article.url ?? "URL no disponible"}</li>
                </ul>

                <h2 style={{ margin: "1rem 0 0.45rem", fontSize: "0.85rem", textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.04em" }}>Salida canónica</h2>
                <pre style={{ margin: 0, padding: "0.85rem", borderRadius: "var(--radius-sm)", background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)", fontSize: "0.72rem", lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 220, overflowY: "auto" }}>
                  {canonicalRow.canonicalOutput}
                </pre>
              </div>
            </div>
          </section>

          <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1rem", display: "grid", gap: "0.8rem" }}>
            <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Detalle visual de noticia</h3>
            <h4 style={{ margin: 0, fontSize: "1.1rem", color: "var(--color-text)", lineHeight: 1.25 }}>{article.title}</h4>
            {article.summary && <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.6, color: "var(--color-text)" }}>{article.summary}</p>}
            {article.rawText && <p style={{ margin: 0, fontSize: "0.86rem", lineHeight: 1.65, color: "var(--color-text-muted)", whiteSpace: "pre-wrap", wordWrap: "break-word" }}>{article.rawText}</p>}
          </section>
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
