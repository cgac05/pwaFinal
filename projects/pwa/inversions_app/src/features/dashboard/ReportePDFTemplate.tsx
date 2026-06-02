import React from "react";
import type { ConfluenceSignalRow } from "../../services/signals/confluenceTableApi";

interface Props {
  ticker: string;
  verdict: { verdict?: any; score?: number; degraded?: boolean } | null;
  rows: ConfluenceSignalRow[];
  activeStrategy?: string;
  fundamentalAnalysis?: any;
  optionStrategyAnalysis?: any;
  wheelSummary?: any;
  instData?: any;
  chartImageBase64?: string;
}

export function ReportePDFTemplate({
  ticker,
  verdict,
  rows = [],
  activeStrategy,
  fundamentalAnalysis,
  optionStrategyAnalysis,
  wheelSummary,
  instData,
  chartImageBase64,
}: Props) {
  const generatedAt = new Date().toLocaleString();

  // Find the AI core row for main justification if available
  const aiRow = rows.find((r) => r.core === "A_IA");
  const aiDecision = aiRow ? aiRow.tipoSenal : (verdict?.verdict || "HOLD");
  const aiJustification = aiRow?.observacion?.explicacion || aiRow?.resumen_analisis || "No se ha generado justificación de IA para esta corrida.";
  const confidenceScore = aiRow ? aiRow.score : (verdict?.score || 0);

  // Take top 10 signals
  const topSignals = rows.slice(0, 10);

  // Helper to extract core details
  const getCoreData = (coreId: string) => {
    const row = rows.find((r) => r.core === coreId);
    if (row) {
      return {
        hasData: true,
        score: row.score,
        tipoSenal: row.tipoSenal,
        resumen: row.observacion?.explicacion || row.resumen_analisis || "Señal activa sin explicación detallada.",
        subCore: row.subCore || "General",
      };
    }
    return {
      hasData: false,
      score: 0,
      tipoSenal: "HOLD",
      resumen: "Sin señal activa detectada en esta corrida.",
      subCore: "-",
    };
  };

  const getSignalBadgeClass = (signal: string) => {
    const isCall = signal === "CALL" || signal === "SÍ" || signal === "buy";
    const isPut = signal === "PUT" || signal === "NO" || signal === "sell";
    return isCall
      ? "bg-green-100 text-green-800"
      : isPut
      ? "bg-red-100 text-red-800"
      : "bg-gray-100 text-gray-800";
  };

  const cores = [
    { id: "A_FUNDAMENTAL", label: "Fundamental" },
    { id: "A_INSTITUCIONAL", label: "Institucional" },
    { id: "A_TECNICO", label: "Técnico" },
    { id: "A_NOTICIAS", label: "Noticias" },
  ];

  return (
    <div
      id="reporte-pdf-template"
      className="font-sans text-gray-800 bg-white p-8 max-w-[210mm] mx-auto text-xs leading-relaxed"
    >
      {/* PAGE 1 */}
      <div style={{ minHeight: "255mm", pageBreakAfter: "always" }} className="flex flex-col justify-between">
        <div>
          {/* Cabecera Institucional */}
          <div className="bg-slate-900 text-white p-6 rounded-t-lg flex justify-between items-center mb-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white uppercase">
                Reporte de Análisis Cuantitativo
              </h1>
              <p className="text-[10px] text-slate-400 mt-1">
                Generado automáticamente el {generatedAt}
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-extrabold tracking-wider bg-slate-800 text-teal-400 px-4 py-2 rounded border border-slate-700">
                {ticker}
              </span>
            </div>
          </div>

          {/* Confidence & Strategy Banner */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="text-[10px] uppercase text-slate-500 font-bold mb-1 tracking-wider">
                Veredicto General
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${getSignalBadgeClass(String(aiDecision))}`}>
                  {aiDecision}
                </span>
                <span className="text-xs font-semibold text-slate-700">
                  Confianza: <strong className="text-slate-950 font-bold">{Number(confidenceScore).toFixed(3)}</strong>
                </span>
              </div>
            </div>

            {activeStrategy && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col justify-center">
                <div className="text-[10px] uppercase text-slate-500 font-bold mb-1 tracking-wider">
                  Estrategia Sugerida
                </div>
                <div className="text-xs font-bold text-slate-900">
                  {activeStrategy.replace(/_/g, " ")}
                </div>
              </div>
            )}
          </div>

          {/* AI Verdict & Justification */}
          <div className="bg-slate-50 border-l-4 border-slate-900 rounded-r-lg p-4 mb-6 shadow-sm">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
              Justificación de IA (Decisión del Modelo)
            </h2>
            <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
              {aiJustification}
            </p>
          </div>

          {/* Chart Section */}
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 pb-1 border-b border-slate-200">
              Sección Gráfica (Velas y Volatilidad)
            </h2>
            {chartImageBase64 ? (
              <div className="border border-gray-300 rounded-lg shadow-sm mb-6 w-full p-2 bg-white flex justify-center">
                <img
                  src={chartImageBase64}
                  alt="Gráfico de Volatilidad"
                  className="w-full max-h-[350px] object-contain rounded"
                />
              </div>
            ) : (
              <div className="border border-dashed border-gray-300 rounded-lg p-10 text-center text-slate-500 bg-slate-50 mb-6">
                Gráfico no disponible o no capturado en la corrida
              </div>
            )}
          </div>
        </div>

        {/* Page Footer */}
        <div className="border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400">
          Página 1 de 2
        </div>
      </div>

      {/* PAGE 2 */}
      <div style={{ minHeight: "255mm" }} className="flex flex-col justify-between mt-8">
        <div>
          {/* Header bar P2 */}
          <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-6">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              INVERSIONS | Reporte Técnico de Confluencia
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">
              Ticker: {ticker}
            </span>
          </div>

          {/* Top 10 Signals Table */}
          <div className="mb-6">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Top {topSignals.length} Señales Relevantes
            </h2>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100 text-slate-700 border-b border-gray-300">
                  <th className="p-2.5 font-semibold text-slate-700">CORE</th>
                  <th className="p-2.5 font-semibold text-slate-700">SUBCORE</th>
                  <th className="p-2.5 font-semibold text-slate-700 text-right">PRECIO</th>
                  <th className="p-2.5 font-semibold text-slate-700 text-center">SEÑAL</th>
                  <th className="p-2.5 font-semibold text-slate-700">TENDENCIA</th>
                  <th className="p-2.5 font-semibold text-slate-700 text-right">SCORE</th>
                  <th className="p-2.5 font-semibold text-slate-700 text-right">PESO</th>
                  <th className="p-2.5 font-semibold text-slate-700 text-center">ESTADO</th>
                </tr>
              </thead>
              <tbody>
                {topSignals.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-200 hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 font-bold text-slate-900">{row.core.replace("A_", "")}</td>
                    <td className="p-2.5 text-slate-600">{row.subCore || "-"}</td>
                    <td className="p-2.5 text-right font-mono text-slate-700">${row.precio.toFixed(2)}</td>
                    <td className="p-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getSignalBadgeClass(row.tipoSenal)}`}>
                        {row.tipoSenal}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-600">{row.tendencia}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-950">{row.score.toFixed(3)}</td>
                    <td className="p-2.5 text-right font-mono text-slate-600">{row.peso.toFixed(2)}</td>
                    <td className="p-2.5 text-center text-slate-600">{row.estado}</td>
                  </tr>
                ))}
                {topSignals.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-slate-500 italic">
                      No se han registrado señales para esta simulación.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Desglose por Core */}
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Desglose Detallado por Core
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {cores.map((core) => {
                const data = getCoreData(core.id);
                return (
                  <div
                    key={core.id}
                    className="bg-gray-50 border border-gray-200 p-4 rounded-md shadow-sm flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-center mb-2 border-b border-gray-200 pb-1.5">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        {core.label}
                      </span>
                      <div className="flex gap-2 items-center">
                        {data.hasData && (
                          <>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getSignalBadgeClass(data.tipoSenal)}`}>
                              {data.tipoSenal}
                            </span>
                            <span className="text-[10px] font-bold text-slate-600">
                              Score: {data.score.toFixed(3)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed overflow-hidden text-ellipsis line-clamp-3">
                      {core.id === "A_INSTITUCIONAL" && instData ? (
                        `Ownership: ${instData.metrics?.fundsOwnershipPct?.toFixed(1) ?? "0"}%. Flujo: $${(instData.metrics?.netFlow ?? 0).toLocaleString()}. Tendencia inst: ${instData.trends?.direction ?? "N/A"}.`
                      ) : core.id === "A_FUNDAMENTAL" && fundamentalAnalysis?.fundamentalData ? (
                        `PE: ${fundamentalAnalysis.fundamentalData.pe ?? "N/A"} | PB: ${fundamentalAnalysis.fundamentalData.pb ?? "N/A"} | ROE: ${fundamentalAnalysis.fundamentalData.roe ? (fundamentalAnalysis.fundamentalData.roe * 100).toFixed(1) + "%" : "N/A"}. Verdict: ${fundamentalAnalysis.verdict || "N/A"}.`
                      ) : (
                        data.resumen
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div>
          <div className="border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400">
            Este documento es confidencial y para uso exclusivo del comité de inversiones de la plataforma Inversions.
          </div>
          <div className="text-center text-[10px] text-slate-400 mt-1">
            Página 2 de 2
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReportePDFTemplate;
