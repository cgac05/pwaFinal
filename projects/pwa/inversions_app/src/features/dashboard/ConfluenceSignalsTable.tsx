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
import { OptionGreeksRow } from "./OptionGreeksRow";
import { InstitutionalDetailModal } from "../institutional/InstitutionalDetailModal";
import { AiDetailModal } from "../ai/AiDetailModal";
import type { ModalRowData } from "../institutional/types";
import { MarkdownContent } from "../../components/ui/MarkdownContent";

// FIC: Columnas con ancho estable; la tabla se desplaza horizontalmente antes de aplastar texto.
const TABLE_COLUMNS: Array<{ key: keyof ConfluenceSignalRow | "estrategia"; label: string; width: number }> = [
  { key: "ticket",    label: "TICKET",     width: 76  },
  { key: "core",      label: "CORE",       width: 150 },
  { key: "subCore",   label: "SUBCORE",    width: 110 },
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

interface Props {
  symbol?: string;
  /** FIC: Permite sobrescribir las filas (por ejemplo desde una corrida de simulacion). */
  rows?: ConfluenceSignalRow[];
  activeStrategy?: string;
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

export function ConfluenceSignalsTable({ symbol, rows: rowsProp, activeStrategy }: Props) {
  const [rows, setRows] = useState<ConfluenceSignalRow[]>(rowsProp ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Omit<ConfluenceTableResponse, "rows"> | null>(null);
  const [modalTicker, setModalTicker] = useState<string | null>(null);
  const [modalResumen, setModalResumen] = useState<string>("");
  const [modalRow, setModalRow] = useState<ConfluenceSignalRow | null>(null);
  const [stubCore, setStubCore] = useState<string | null>(null);
  const [stubResumen, setStubResumen] = useState<string>("");
  // FIC: Full row stored for A_TECNICO structured detail panel. (EN)
  // FIC: Fila completa almacenada para el panel de detalle estructurado de A_TECNICO. (ES)
  const [stubRow, setStubRow] = useState<ConfluenceSignalRow | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const { setSelectedSignal } = useSignalStore();
  const { results: institutionalResults } = useInstitutionalStore();

  useEffect(() => {
    if (!stubCore) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setStubCore(null); setStubRow(null); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [stubCore]);

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
    return [...rows]
      .sort((a, b) => order.indexOf(a.core) - order.indexOf(b.core))
      .map((row) => ({ ...row, resumen_analisis: buildResumen(row, institutionalResults) }));
  }, [rows, institutionalResults]);

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
        <table style={{ width: "100%", minWidth: 1400, borderCollapse: "collapse", tableLayout: "fixed" }}>
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
                    } else {
                      setSelectedSignal({
                        id: rowKey,
                        symbol: row.ticket,
                        metadata: { evidencia_refs: row.evidencia_refs, core: row.core, subCore: row.subCore }
                      } as SelectedSignal);
                    }
                  } else if (row.core === "A_INDICADORES") {
                    setSelectedSignal({
                      id: rowKey,
                      symbol: row.ticket,
                      metadata: { evidencia_refs: row.evidencia_refs, core: row.core, subCore: row.subCore }
                    } as SelectedSignal);
                  } else {
                    setStubCore(row.core);
                    setStubResumen(row.resumen_analisis ?? "");
                    setStubRow(row.core === "A_TECNICO" ? row : null);
                    if (row.core === "A_IA") {
                      setStubRow(row);
                      setAiModalOpen(true);
                      setStubCore(null); // Clear stubCore so the right panel doesn't open
                      setStubResumen("");
                    }
                  }
                };

                const cells = (
                  <tr key={rowKey} onClick={onClick} data-resumen={row.resumen_analisis ?? ""} style={{ cursor: "pointer", opacity: row.estado === "DEGRADADA" ? 0.62 : 1 }}>
                    {TABLE_COLUMNS.map((col) => {
                      let content: React.ReactNode;
                      if (col.key === "estrategia") {
                        content = <span className="badge badge-hold">{(activeStrategy ?? "N/A").replace(/_/g, " ")}</span>;
                      } else if (col.key === "tipoSenal") {
                        content = <span style={{ color: colorForTipo(row.tipoSenal), fontWeight: 700 }}>{row.tipoSenal}</span>;
                      } else if (col.key === "estado") {
                        content = <span style={{ color: colorForEstado(row.estado), fontWeight: 600 }}>{row.estado}</span>;
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
                        <td key={col.key} style={{ padding: "0.72rem 0.8rem", borderBottom: "1px solid var(--color-border)", fontSize: "0.78rem", verticalAlign: "middle", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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

      {stubCore && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="stub-dialog-title"
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
          onClick={() => { setStubCore(null); setStubRow(null); }}
        >
          <div
            className="card"
            style={{
              width: "min(560px, 94vw)",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              border: "1px solid var(--color-border)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
              padding: "1.75rem"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="stub-dialog-title" style={{ marginBottom: "0.25rem", flexShrink: 0 }}>
              {stubCore === "A_TECNICO" ? "Análisis Técnico" : stubCore.replace("A_", "")}
            </h2>
            {stubCore !== "A_TECNICO" && (
              <p style={{ color: "var(--color-text-muted)", fontSize: "0.8rem", marginBottom: "1.25rem", flexShrink: 0 }}>
                Análisis gráfico en construcción — próximamente disponible.
              </p>
            )}

            {/* FIC: A_TECNICO structured panel — replaces plain text for this core. (EN) */}
            {stubCore === "A_TECNICO" && stubRow ? (() => {
              // Parse evidencia_refs: ["trend:ALCISTA", "adx:28.7", ...]
              const ev: Record<string, string> = {};
              for (const ref of (stubRow.evidencia_refs ?? [])) {
                const i = ref.indexOf(":");
                if (i > 0) ev[ref.slice(0, i)] = ref.slice(i + 1);
              }
              const met = stubRow.observacion?.metricas ?? {};
              const trendColor = stubRow.tendencia === "ALCISTA" ? "var(--color-buy)"
                : stubRow.tendencia === "BAJISTA" ? "var(--color-sell)"
                : "var(--color-text-muted)";
              const subCard = { background: "var(--color-surface-raised)", borderRadius: "var(--radius-sm)",
                padding: "0.75rem 1rem", border: "1px solid var(--color-border-subtle)" };
              const subTitle = { fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase" as const,
                letterSpacing: "0.07em", color: "var(--color-accent)", marginBottom: "0.5rem" };
              const dataRow = (label: string, value: React.ReactNode, color?: string) => (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0",
                  borderBottom: "1px solid var(--color-border-subtle)", fontSize: "0.75rem" }}>
                  <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
                  <span style={{ fontWeight: 600, color: color ?? "var(--color-text)" }}>{value}</span>
                </div>
              );
              return (
                <div style={{ flex: 1, overflowY: "auto", display: "grid",
                  gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem" }}>
                  {/* Tendencia */}
                  <div style={subCard}>
                    <div style={subTitle}>Tendencia</div>
                    {dataRow("Detectada", ev.trend ?? stubRow.tendencia, trendColor)}
                    {dataRow("Fuerza", ev.trendStrength ?? (met.TREND_STRENGTH as string) ?? "—")}
                  </div>
                  {/* Momentum */}
                  <div style={subCard}>
                    <div style={subTitle}>Momentum</div>
                    {dataRow("ADX", ev.adx ? `${ev.adx}` : "—")}
                    {dataRow("Interpretación",
                      Number(ev.adx ?? 0) >= 40 ? "Muy fuerte" :
                      Number(ev.adx ?? 0) >= 25 ? "Fuerte" :
                      Number(ev.adx ?? 0) >= 15 ? "Débil" : "Sin tendencia")}
                    {dataRow("Líneas", `${ev.trendLines ?? "0"} totales`)}
                  </div>
                  {/* Medias */}
                  <div style={subCard}>
                    <div style={subTitle}>Medias Móviles</div>
                    {dataRow("EMA50", met.SMA_50 ? `$${Number(met.SMA_50).toFixed(2)}` : "—")}
                    {dataRow("Último cierre", stubRow.precio > 0 ? `$${stubRow.precio.toFixed(2)}` : "—")}
                    {dataRow("Candles analizadas", met.CANDLES_ANALYZED ?? "—")}
                  </div>
                  {/* Soportes */}
                  <div style={subCard}>
                    <div style={subTitle}>Soportes</div>
                    {dataRow("Cantidad", ev.supports ?? (met.SOPORTES as string) ?? "0",
                      Number(ev.supports ?? 0) > 0 ? "var(--color-buy)" : undefined)}
                  </div>
                  {/* Resistencias */}
                  <div style={subCard}>
                    <div style={subTitle}>Resistencias</div>
                    {dataRow("Cantidad", ev.resistances ?? (met.RESISTENCIAS as string) ?? "0",
                      Number(ev.resistances ?? 0) > 0 ? "var(--color-sell)" : undefined)}
                  </div>
                  {/* Métricas */}
                  <div style={subCard}>
                    <div style={subTitle}>Métricas</div>
                    {Object.entries(met).map(([k, v]) => dataRow(k, String(v)))}
                    {Object.keys(met).length === 0 && (
                      <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>Sin métricas</span>
                    )}
                  </div>
                </div>
              );
            })() : null}

            {/* FIC: Non-A_TECNICO/A_IA: ObservationsTab when stubRow available (upstream), else plain stubResumen. (EN) */}
            {stubCore !== "A_TECNICO" && stubCore !== "A_IA" && stubRow && (
              <div style={{ flex: 1, overflowY: "auto", marginBottom: "1.25rem" }}>
                <ObservationsTab row={stubRow} activeStrategy={activeStrategy} />
              </div>
            )}

            {stubCore !== "A_TECNICO" && stubCore !== "A_IA" && !stubRow && stubResumen && (
              <>
                <div style={{
                  borderTop: "1px solid var(--color-border-subtle)",
                  paddingTop: "1rem",
                  marginBottom: "0.5rem",
                  flexShrink: 0
                }}>
                  <span style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    color: "var(--color-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em"
                  }}>
                    Observaciones
                  </span>
                </div>
                <div style={{
                  flex: 1,
                  overflowY: "auto",
                  background: "var(--color-surface-raised)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.9rem 1rem",
                  marginBottom: "1.25rem"
                }}>
                  <MarkdownContent content={stubResumen} />
                </div>
              </>
            )}

            <button className="btn-ghost" type="button" onClick={() => { setStubCore(null); setStubRow(null); }} style={{ flexShrink: 0, alignSelf: "flex-end" }}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      <InstitutionalDetailModal
        isOpen={modalTicker !== null}
        onClose={() => { setModalTicker(null); setModalRow(null); }}
        ticker={modalTicker ?? ""}
        data={modalTicker ? (institutionalResults[modalTicker.toUpperCase()] ?? null) : null}
        resumen={modalResumen}
        signalRow={modalRow ?? undefined}
      />

      <AiDetailModal
        isOpen={aiModalOpen}
        onClose={() => { setAiModalOpen(false); setStubRow(null); }}
        ticker={symbol}
        signalRow={stubRow ?? undefined}
        activeStrategy={activeStrategy}
      />
    </section>
  );
}

export default ConfluenceSignalsTable;
