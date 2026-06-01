// FIC: Phase 5 T095 — tabla canonica con columnas del PDF "DASBOARD Y TABLA v1".
// FIC: Reemplaza la tabla v0 (symbol/direction/confidence/timestamp) por el contrato del PDF.

import React, { useEffect, useMemo, useState } from "react";
import { useSignalStore, type SelectedSignal } from "../../store/signals";
import { useInstitutionalStore } from "../../store/institutional";
import {
  getConfluenceTable,
  type ConfluenceSignalRow,
  type ConfluenceTableResponse
} from "../../services/signals/confluenceTableApi";
import type { InstitutionalAnalysisResponse } from "../../services/institutional/institutionalApi";
import type { FundamentalAnalysisResponse } from "../../services/fundamental/fundamentalApi";
import { OptionGreeksRow } from "./OptionGreeksRow";
import { InstitutionalDetailModal } from "../institutional/InstitutionalDetailModal";
import { NewsDetailModal } from "../news/NewsDetailModal";
import { MarkdownContent } from "../../components/ui/MarkdownContent";
import type { AnalyzedNewsSource } from "../../services/news/newsApi";

// FIC: Columnas con ancho estable; la tabla se desplaza horizontalmente antes de aplastar texto.
const TABLE_COLUMNS: Array<{ key: keyof ConfluenceSignalRow | "estrategia"; label: string; width: number }> = [
  { key: "ticket",    label: "TICKET",     width: 76  },
  { key: "core",      label: "CORE",       width: 132 },
  { key: "subCore",   label: "SUBCORE",    width: 320 },
  { key: "precio",    label: "PRECIO",     width: 96  },
  { key: "tipoSenal", label: "TIPO SEÑAL", width: 108 },
  { key: "fecha",     label: "FECHA",      width: 110 },
  { key: "timeframe", label: "TIMEFRAME",  width: 112 },
  { key: "tendencia", label: "TENDENCIA",  width: 128 },
  { key: "score",     label: "SCORE",      width: 86  },
  { key: "peso",      label: "PESO",       width: 82  },
  { key: "invertir",  label: "INVERTIR",   width: 96  },
  { key: "estado",    label: "ESTADO",     width: 118 },
  { key: "estrategia",label: "ESTRATEGIA", width: 170 },
];

function buildResumen(
  row: ConfluenceSignalRow,
  instResults: Record<string, InstitutionalAnalysisResponse>
): string {
  if (row.core === "A_INSTITUCIONAL") {
    const result = instResults[row.ticket?.toUpperCase() ?? ""];
    if (result) {
      const parts: string[] = [];
      if (result.trends) {
        parts.push(`Tendencia: ${result.trends.direction} SMA50=${result.trends.sma50.toFixed(2)} SMA200=${result.trends.sma200.toFixed(2)}`);
        if (result.trends.crossover) parts.push(`Crossover: ${result.trends.crossover.type} hace ${result.trends.crossover.daysAgo}d`);
      }
      if (result.zones) {
        parts.push(`Zonas: ${result.zones.support.length} soporte, ${result.zones.resistance.length} resistencia`);
        if (result.zones.support.length) parts.push(`Soporte clave: $${result.zones.support[0].price.toFixed(2)}`);
        if (result.zones.resistance.length) parts.push(`Resistencia clave: $${result.zones.resistance[0].price.toFixed(2)}`);
      }
      if (result.expiration) parts.push(`Vencimiento: régimen=${result.expiration.currentRegime}, ${result.expiration.daysToNextOpex}d para OpEx, sesgo=${result.expiration.expiryBias}`);
      if (result.metrics) parts.push(`Ownership: ${result.metrics.fundsOwnershipPct.toFixed(1)}%, NetFlow: $${result.metrics.netFlow.toLocaleString()}`);
      return `[Institucional ${row.ticket}] ${parts.join(". ")}`;
    }
  }
  const obs = row.observacion;
  const met = Object.entries(obs.metricas ?? {}).map(([k, v]) => `${k}=${v}`).join(", ");
  return [obs.objetivo, obs.senal, obs.explicacion, met ? `Métricas: ${met}` : ""].filter(Boolean).join(". ");
}

function formatMetrics(row: ConfluenceSignalRow): string {
  return Object.entries(row.observacion?.metricas ?? {})
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");
}

function explainScore(row: ConfluenceSignalRow): string {
  const score = Number(row.score);
  if (!Number.isFinite(score)) return "El score no viene como numero valido, por eso se usa la observacion original.";
  const abs = Math.abs(score);
  const strength = abs >= 0.8 ? "muy fuerte" : abs >= 0.6 ? "fuerte" : abs >= 0.35 ? "media" : "debil";
  const direction = score > 0 ? "sesgo alcista" : score < 0 ? "sesgo bajista" : "lectura neutral";
  return `El score ${score.toFixed(3)} indica una conviccion ${strength} con ${direction}.`;
}

function explainTrend(row: ConfluenceSignalRow): string {
  if (row.tendencia === "ALCISTA") {
    return "La tendencia queda ALCISTA porque la senal y el score apuntan a mejora relativa del subcore.";
  }
  if (row.tendencia === "BAJISTA") {
    return "La tendencia queda BAJISTA porque la senal y el score apuntan a deterioro o presion negativa dominante.";
  }
  return "La tendencia queda LATERAL porque la fila no trae suficiente direccion para justificar CALL/PUT direccional.";
}

function buildLocalChatExplanation(row: ConfluenceSignalRow, resumen: string): string {
  const metrics = formatMetrics(row);
  return [
    `- El core **${row.core}${row.subCore ? ` / ${row.subCore}` : ""}** evaluo las metricas mostradas arriba y produjo un score de **${Number(row.score).toFixed(3)}** (peso **${Number(row.peso).toFixed(3)}**) con tendencia **${row.tendencia}**.`,
    `- Por eso la observacion concluye una senal **${row.tipoSenal}**: ${row.observacion?.senal ?? "sin senal detallada"}.`,
    `- Esto sustenta la estrategia **${(row as any).estrategia ?? "segun dashboard"}**, coherente con ${row.tendencia === "ALCISTA" ? "un sesgo alcista" : row.tendencia === "BAJISTA" ? "un sesgo bajista" : "un sesgo neutral"}.`,
    metrics ? `\nMetricas consideradas:\n${metrics}` : "",
  ].filter(Boolean).join("\n");
}

function buildChatContext(row: ConfluenceSignalRow, resumen: string, activeStrategy?: string): string {
  const metrics = formatMetrics(row) || "Sin metricas estructuradas.";
  return [
    `## Senal de Confluencia: ${row.ticket}`,
    "",
    "| Campo | Valor |",
    "|---|---|",
    `| Core | ${row.core}${row.subCore ? ` / ${row.subCore}` : ""} |`,
    `| Tipo Senal | **${row.tipoSenal}** |`,
    `| Tendencia | ${row.tendencia} |`,
    `| Score | ${Number(row.score).toFixed(3)} |`,
    `| Peso | ${Number(row.peso).toFixed(3)} |`,
    `| Invertir | ${row.invertir ? "SI" : "NO"} |`,
    `| Estado | ${row.estado} |`,
    `| Timeframe | ${row.timeframe} |`,
    `| Fecha | ${row.fecha} |`,
    `| Estrategia activa | ${activeStrategy?.replace(/_/g, " ") ?? "N/A"} |`,
    "",
    "### Observacion",
    `**Objetivo:** ${row.observacion?.objetivo ?? "-"}`,
    "",
    `**Senal:** ${row.observacion?.senal ?? "-"}`,
    "",
    `**Explicacion:** ${row.observacion?.explicacion ?? resumen}`,
    "",
    "### Metricas consideradas",
    metrics,
    "",
    "### Razonamiento (como llegamos a esta conclusion)",
    buildLocalChatExplanation(row, resumen),
  ].join("\n");
}

interface Props {
  symbol?: string;
  /** FIC: Permite sobrescribir las filas (por ejemplo desde una corrida de simulacion). */
  rows?: ConfluenceSignalRow[];
  activeStrategy?: string;
  fundamentalAnalysis?: FundamentalAnalysisResponse | null;
}

function colorForTipo(tipo: string): string {
  if (tipo === "CALL") return "var(--color-buy, #2ec27e)";
  if (tipo === "PUT") return "var(--color-sell, #f85149)";
  return "var(--color-text-muted, #8b949e)";
}

function colorForEstado(estado: string): string {
  if (estado === "DEGRADADA") return "var(--color-text-muted, #8b949e)";
  if (estado === "INVALIDADA") return "var(--color-sell, #f85149)";
  return "var(--color-buy, #2ec27e)";
}

function providerAccent(provider?: string): string {
  const clean = (provider ?? "").toLowerCase();
  if (clean.includes("yahoo")) return "#8b5cf6";
  if (clean.includes("finnhub")) return "#00c2a8";
  if (clean.includes("newsapi")) return "#3b82f6";
  if (clean.includes("polygon")) return "#f59e0b";
  if (clean.includes("alpha")) return "#f43f5e";
  return "var(--color-accent)";
}

function compactNewsTitle(row: ConfluenceSignalRow): string {
  const title = row.observacion?.objetivo ?? "Noticia sin titulo";
  return title.length > 92 ? `${title.slice(0, 89)}...` : title;
}


function clampScore(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function buildFundamentalRow(data: FundamentalAnalysisResponse, timeframe: string): ConfluenceSignalRow {
  const score = clampScore(((data.overallScore ?? 5) - 5) / 5);
  const verdict = String(data.verdict ?? "").toLowerCase();
  const tipoSenal = verdict.includes("comprar") || verdict.includes("buy") ? "CALL" : verdict.includes("vender") || verdict.includes("sell") ? "PUT" : "HOLD";
  return {
    ticket: data.ticker,
    core: "A_FUNDAMENTAL",
    subCore: "FUNDAMENTAL",
    precio: data.fundamentalData?.price ?? 0,
    tipoSenal,
    fecha: new Date(data.timestamp).toISOString().slice(0, 10),
    timeframe: timeframe as any,
    tendencia: tipoSenal === "CALL" ? "ALCISTA" : tipoSenal === "PUT" ? "BAJISTA" : "LATERAL",
    score,
    peso: Math.abs(score),
    invertir: tipoSenal !== "HOLD" && score > 0,
    estado: "ACTIVA",
    vigencia: data.timestamp,
    fuente: data.sourceId ?? "fundamental",
    evidencia_refs: [`fundamental:${data.ticker}:${data.timestamp}`],
    ia_revisada: false,
    delta_vs_anterior: "CONFIRMADA",
    observacion: {
      objetivo: `Analisis fundamental de ${data.companyName || data.ticker}`,
      senal: String(data.verdict ?? "Sin veredicto"),
      explicacion: `Score fundamental ${Number(data.overallScore ?? 0).toFixed(1)}/10.`,
      metricas: {
        MARKET_CAP: data.fundamentalData?.marketCap ?? 0,
        VOLATILIDAD: data.fundamentalData?.volatility ?? 0,
      },
    },
    algorithm_version: "fundamental-frontend-1.0",
    computed_at: data.timestamp,
    source_input_hash: `fundamental:${data.ticker}:${data.timestamp}`,
  };
}

export function ConfluenceSignalsTable({ symbol, rows: rowsProp, activeStrategy, fundamentalAnalysis }: Props) {
  const [rows, setRows] = useState<ConfluenceSignalRow[]>(rowsProp ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Omit<ConfluenceTableResponse, "rows"> | null>(null);
  const [modalTicker, setModalTicker] = useState<string | null>(null);
  const [modalResumen, setModalResumen] = useState<string>("");
  const [modalRow, setModalRow] = useState<ConfluenceSignalRow | null>(null);
  const [newsArticle, setNewsArticle] = useState<AnalyzedNewsSource | null>(null);
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [observationRow, setObservationRow] = useState<(ConfluenceSignalRow & { resumen_analisis?: string }) | null>(null);
  const [detailTab, setDetailTab] = useState<"analysis" | "context">("analysis");

  const { setSelectedSignal } = useSignalStore();
  const { results: institutionalResults } = useInstitutionalStore();

  useEffect(() => {
    if (!observationRow) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setObservationRow(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [observationRow]);

  useEffect(() => {
    if (rowsProp) {
      setRows(rowsProp);
      return;
    }
    if (!symbol) return;
    setLoading(true);
    setError(null);
    getConfluenceTable({ ticket: symbol })
      .then((res) => {
        setRows(res.rows);
        setMeta({
          generated_at: res.generated_at,
          algorithm_version: res.algorithm_version,
          ticket: res.ticket,
          timeframe: res.timeframe
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "load_failed"))
      .finally(() => setLoading(false));
  }, [symbol, rowsProp]);

  const enrichedSorted = useMemo(() => {
    const order = ["A_INDICADORES", "A_FUNDAMENTAL", "A_TECNICO", "A_INSTITUCIONAL", "A_NOTICIAS", "A_IA"];
    const timeframe = rows[0]?.timeframe ?? "1h";
    let mergedRows = [...rows];
    if (fundamentalAnalysis) {
      mergedRows = mergedRows.filter((row) => row.core !== "A_FUNDAMENTAL");
      if (Array.isArray(fundamentalAnalysis.confluenceRows) && fundamentalAnalysis.confluenceRows.length > 0) {
        mergedRows.push(...fundamentalAnalysis.confluenceRows);
      } else {
        mergedRows.push(buildFundamentalRow(fundamentalAnalysis, timeframe));
      }
    }
    return mergedRows
      .sort((a, b) => order.indexOf(a.core) - order.indexOf(b.core))
      .map((row) => ({ ...row, resumen_analisis: buildResumen(row, institutionalResults) }));
  }, [rows, institutionalResults, fundamentalAnalysis]);

  const totalCols = TABLE_COLUMNS.length;
  const sorted = enrichedSorted;

  return (
    <section className="card" style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Tabla de Confluencia de Señales</h2>
        {meta && (
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.75rem" }}>
            {meta.ticket} · {meta.timeframe} · v{meta.algorithm_version}
          </span>
        )}
      </div>

      {error && (
        <div style={{ color: "var(--color-sell, #f85149)", marginBottom: "0.5rem", fontSize: "0.8rem" }}>
          Error: {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <span className="badge badge-medium">Vista compacta</span>
        <span className="badge badge-hold" style={{ fontSize: "0.72rem" }}>
          Estrategia: {(activeStrategy ?? "SIN_ESTRATEGIA").replace(/_/g, " ")}
        </span>
      </div>

      <div style={{ maxHeight: 500, overflow: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}>
        <table style={{ width: "100%", minWidth: 1660, borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr>
              {TABLE_COLUMNS.map((col) => (
                <th key={col.key} style={{ position: "sticky", top: 0, background: "var(--color-surface)", padding: "0.72rem 0.8rem", textAlign: "left", fontSize: "0.68rem", borderBottom: "1px solid var(--color-border)", width: col.width }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={totalCols} style={{ padding: "1rem", textAlign: "center" }}>Cargando…</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={totalCols} style={{ padding: "1rem", textAlign: "center", color: "var(--color-text-muted)" }}>Sin datos para mostrar</td></tr>
            ) : (
              sorted.flatMap((row, idx) => {
                const rowKey = `${row.core}-${row.subCore ?? "agg"}-${idx}`;
                const instData = institutionalResults[row.ticket?.toUpperCase() ?? ""];
                const onClick = () => {
                  if (row.core === "A_INSTITUCIONAL") {
                    if (instData) {
                      setModalTicker(row.ticket ?? null);
                      setModalResumen(row.resumen_analisis ?? "");
                      setModalRow(row);
                      return;
                    }
                    setSelectedSignal({
                      id: rowKey,
                      symbol: row.ticket,
                      metadata: { evidencia_refs: row.evidencia_refs, core: row.core, subCore: row.subCore }
                    } as SelectedSignal);
                    return;
                  }
                  if (row.core === "A_INDICADORES") {
                    setSelectedSignal({
                      id: rowKey,
                      symbol: row.ticket,
                      metadata: { evidencia_refs: row.evidencia_refs, core: row.core, subCore: row.subCore }
                    } as SelectedSignal);
                    return;
                  }
                  if (row.core === "A_NOTICIAS") {
                    const article: AnalyzedNewsSource = {
                      id: row.evidencia_refs?.[0] ?? `${row.ticket}-${row.subCore ?? "news"}`,
                      title: row.observacion?.objetivo ?? (row.subCore ? `${row.ticket} · ${row.subCore}` : `Noticias ${row.ticket}`),
                      url: row.evidencia_refs?.[0],
                      provider: row.fuente,
                      publishedAt: `${row.fecha}T12:00:00.000Z`,
                      summary: row.observacion?.senal ?? "Noticia de confluencia",
                      rawText: row.observacion?.explicacion ?? row.resumen_analisis ?? "",
                      sentiment: row.tipoSenal === "CALL" ? "positive" : row.tipoSenal === "PUT" ? "negative" : "neutral",
                      sentimentScore: row.score,
                      confidence: Math.max(0, Math.min(1, row.peso)),
                      credibilityScore: Math.max(0, Math.min(1, row.peso)),
                      affectedSymbols: [row.ticket],
                      keywords: [],
                      verdict: row.tipoSenal === "CALL" ? "BUY" : row.tipoSenal === "PUT" ? "SELL" : "HOLD",
                      rationale: row.observacion?.explicacion ?? row.observacion?.senal ?? ""
                    };
                    setNewsArticle(article);
                    setShowNewsModal(true);
                    return;
                  }
                  if (row.core === "A_FUNDAMENTAL") {
                    setDetailTab("analysis");
                    setObservationRow(row);
                    return;
                  }
                  setDetailTab("analysis");
                  setObservationRow(row);
                };

                const cells = (
                  <tr
                    key={rowKey}
                    onClick={onClick}
                    data-resumen={row.resumen_analisis ?? ""}
                    style={{
                      cursor: "pointer",
                      opacity: row.estado === "DEGRADADA" ? 0.62 : 1,
                      background: row.core === "A_NOTICIAS" ? "linear-gradient(90deg, rgba(56,139,253,0.10), transparent 70%)" : undefined,
                      boxShadow: row.core === "A_NOTICIAS" ? `inset 3px 0 0 ${providerAccent(row.fuente)}` : undefined,
                    }}
                  >
                    {TABLE_COLUMNS.map((col) => {
                      let content: React.ReactNode;
                      if (col.key === "estrategia") {
                        content = <span className="badge badge-hold">{(activeStrategy ?? "N/A").replace(/_/g, " ")}</span>;
                      } else if (col.key === "tipoSenal") {
                        content = <span style={{ color: colorForTipo(row.tipoSenal), fontWeight: 700 }}>{row.tipoSenal}</span>;
                      } else if (col.key === "estado") {
                        content = <span style={{ color: colorForEstado(row.estado), fontWeight: 600 }}>{row.estado}</span>;
                      } else if (col.key === "subCore" && row.core === "A_NOTICIAS") {
                        content = (
                          <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800, color: providerAccent(row.fuente) }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: providerAccent(row.fuente), display: "inline-block" }} />
                              {row.subCore ?? row.fuente}
                            </span>
                            <span title={row.observacion?.objetivo} style={{ color: "var(--color-text)", fontWeight: 650, lineHeight: 1.25 }}>
                              {compactNewsTitle(row)}
                            </span>
                          </div>
                        );
                      } else if (col.key === "core" && row.core === "A_NOTICIAS") {
                        content = <span style={{ color: "var(--color-accent)", fontWeight: 800 }}>A_NOTICIAS</span>;
                      } else if (col.key === "invertir") {
                        content = row.invertir ? "SI" : "NO";
                      } else if (col.key === "score" || col.key === "peso" || col.key === "precio") {
                        const v = row[col.key] as number;
                        content = Number.isFinite(v) ? v.toFixed(3) : "-";
                      } else if (col.key === "core" && row.core === "A_IA") {
                        content = (
                          <span>
                            {row.core}{" "}
                            <span title={row.disclaimer_id} style={{ background: "var(--color-accent-subtle)", color: "var(--color-accent)", borderRadius: 3, padding: "0 4px", fontSize: "0.6rem", fontWeight: 700 }}>IA</span>
                          </span>
                        );
                      } else {
                        const v = (row as any)[col.key];
                        content = v == null ? "-" : String(v);
                      }
                      return (
                        <td
                          key={col.key}
                          style={{
                            padding: row.core === "A_NOTICIAS" ? "0.82rem 0.8rem" : "0.72rem 0.8rem",
                            borderBottom: "1px solid var(--color-border)",
                            fontSize: "0.78rem",
                            verticalAlign: "middle",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: col.key === "subCore" && row.core === "A_NOTICIAS" ? "normal" : "nowrap",
                          }}
                        >
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                );
                if (row.optionLeg) {
                  return [cells, <OptionGreeksRow key={`${rowKey}-greeks`} greeks={row.optionLeg} colSpan={totalCols} />];
                }
                return [cells];
              })
            )}
          </tbody>
        </table>
      </div>

      {observationRow && (() => {
        const resumen = observationRow.resumen_analisis ?? buildResumen(observationRow, institutionalResults);
        const contextMarkdown = buildChatContext(observationRow, resumen, activeStrategy);
        const reasoning = buildLocalChatExplanation(observationRow, resumen);
        const metrics = Object.entries(observationRow.observacion?.metricas ?? {});
        const technicalEvidence = (observationRow.evidencia_refs ?? []).reduce<Record<string, string>>((acc, ref) => {
          const separator = ref.indexOf(":");
          if (separator > 0) acc[ref.slice(0, separator)] = ref.slice(separator + 1);
          return acc;
        }, {});
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
            aria-labelledby="observation-dialog-title"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.72)",
              zIndex: 1100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1.25rem"
            }}
            onClick={() => setObservationRow(null)}
          >
            <div
              className="card"
              style={{
                width: "min(960px, 96vw)",
                maxHeight: "88vh",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                border: "1px solid var(--color-border)",
                boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
                padding: "0"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: "1rem 1.25rem 0.5rem", display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
                <div>
                  <h2 id="observation-dialog-title" style={{ margin: "0 0 0.25rem", fontSize: "1rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>Detalle de Señal</h2>
                  <p style={{ color: "var(--color-text-muted)", fontSize: "0.78rem", margin: 0, fontWeight: 700 }}>
                    {observationRow.ticket} - {observationRow.core} / {observationRow.subCore ?? "General"}
                  </p>
                </div>
                <button className="btn-ghost" type="button" onClick={() => setObservationRow(null)} style={{ borderRadius: "var(--radius-pill)", fontWeight: 700 }}>
                  Cerrar
                </button>
              </div>

              <div style={{ display: "flex", gap: "0.4rem", padding: "0 1.25rem 0.5rem", borderBottom: "1px solid var(--color-border)" }}>
                {[
                  ["analysis", "Análisis"],
                  ["context", "Contexto para Chat"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDetailTab(id as "analysis" | "context")}
                    style={{
                      padding: "0.55rem 0.9rem",
                      background: detailTab === id ? "var(--color-surface-raised)" : "transparent",
                      color: "var(--color-text)",
                      border: "1px solid var(--color-border)",
                      borderBottom: detailTab === id ? "2px solid var(--color-accent)" : "1px solid var(--color-border)",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {detailTab === "analysis" ? (
                <div style={{ padding: "1rem 1.25rem", overflowY: "auto" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.65rem", marginBottom: "1rem" }}>
                    {fieldCard("Subcore", observationRow.subCore ?? "-")}
                    {fieldCard("Precio", Number(observationRow.precio).toFixed(2))}
                    {fieldCard("Señal", observationRow.tipoSenal)}
                    {fieldCard("Tendencia", observationRow.tendencia)}
                    {fieldCard("Score", Number(observationRow.score).toFixed(3))}
                    {fieldCard("Peso", Number(observationRow.peso).toFixed(3))}
                    {fieldCard("Invertir", observationRow.invertir ? "SI" : "NO")}
                    {fieldCard("Estado", observationRow.estado)}
                    {fieldCard("Fecha", observationRow.fecha)}
                    {fieldCard("Timeframe", observationRow.timeframe)}
                    {fieldCard("Estrategia", activeStrategy?.replace(/_/g, " ") ?? "N/A")}
                  </div>

                  {observationRow.core === "A_TECNICO" && (
                    <>
                      <h3 style={{ margin: "0 0 0.6rem", fontSize: "0.98rem", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Detalle técnico</h3>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.5rem", marginBottom: "1rem" }}>
                        {fieldCard("Trend", technicalEvidence.trend ?? observationRow.tendencia)}
                        {fieldCard("ADX", technicalEvidence.adx ?? "-")}
                        {fieldCard("Trend strength", technicalEvidence.trendStrength ?? observationRow.observacion?.metricas?.TREND_STRENGTH ?? "-")}
                        {fieldCard("Soportes", technicalEvidence.supports ?? observationRow.observacion?.metricas?.SOPORTES ?? "0")}
                        {fieldCard("Resistencias", technicalEvidence.resistances ?? observationRow.observacion?.metricas?.RESISTENCIAS ?? "0")}
                        {fieldCard("Candles", observationRow.observacion?.metricas?.CANDLES_ANALYZED ?? "-")}
                      </div>
                    </>
                  )}

                  <h3 style={{ margin: "0 0 0.6rem", fontSize: "0.98rem", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Observación</h3>
                  <div style={{ fontSize: "0.82rem", lineHeight: 1.35, marginBottom: "1rem" }}>
                    <strong>Objetivo:</strong> {observationRow.observacion?.objetivo ?? "-"}<br />
                    <strong>Señal:</strong> {observationRow.observacion?.senal ?? "-"}<br />
                    <strong>Explicación:</strong> {observationRow.observacion?.explicacion ?? resumen}
                  </div>

                  <h3 style={{ margin: "0 0 0.35rem", fontSize: "0.98rem", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Métricas consideradas para esta señal</h3>
                  <p style={{ margin: "0 0 0.65rem", color: "var(--color-text-muted)", fontSize: "0.78rem" }}>
                    Valores que el algoritmo evaluó para emitir la señal {observationRow.tipoSenal} con score {Number(observationRow.score).toFixed(3)}.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem", marginBottom: "1rem" }}>
                    {metrics.length > 0 ? metrics.map(([key, value]) => fieldCard(key, String(value))) : fieldCard("Sin métricas", "-")}
                  </div>

                  <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.98rem", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Razonamiento</h3>
                  <MarkdownContent content={reasoning} />
                </div>
              ) : (
                <div style={{ padding: "1rem 1.25rem", overflow: "hidden", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                    <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "0.78rem" }}>
                      Representación MD de esta señal lista para enviar al chat.
                    </p>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button className="btn-ghost" type="button" onClick={() => void navigator.clipboard?.writeText(contextMarkdown)}>Copiar</button>
                      <button className="btn-primary" type="button" onClick={() => void navigator.clipboard?.writeText(contextMarkdown)}>Usar en chat</button>
                    </div>
                  </div>
                  <pre style={{ margin: 0, flex: 1, overflow: "auto", minHeight: 420, background: "#000", color: "var(--color-text)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "1rem", fontSize: "0.72rem", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                    {contextMarkdown}
                  </pre>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <InstitutionalDetailModal
        isOpen={modalTicker !== null}
        onClose={() => { setModalTicker(null); setModalRow(null); }}
        ticker={modalTicker ?? ""}
        data={modalTicker ? (institutionalResults[modalTicker.toUpperCase()] ?? null) : null}
        resumen={modalResumen}
        signalRow={modalRow ?? undefined}
      />

      <NewsDetailModal
        isOpen={showNewsModal}
        onClose={() => {
          setShowNewsModal(false);
          setNewsArticle(null);
        }}
        article={newsArticle}
      />
    </section>
  );
}

export default ConfluenceSignalsTable;
