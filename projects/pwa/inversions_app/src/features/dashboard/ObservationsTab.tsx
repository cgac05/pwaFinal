// FIC: Canonical observations tab — shows canonical output string with copy/download options. (EN)
// FIC: Pestaña de observaciones canónicas — muestra el string canónico con opciones de copiar/descargar. (ES)

import React, { useState } from "react";
import type { ConfluenceSignalRow } from "../../services/signals/confluenceTableApi";
import { MarkdownContent } from "../../components/ui/MarkdownContent";
import {
  buildCanonicalOutputString,
  buildSignalContextMD,
} from "../../services/signals/confluenceTableApi";

interface RelevantSignal {
  core: string;
  indicator: string;
  senal: string;
  score: number;
  detail: string;
}

export function parseRelevantSignals(explanation: string): RelevantSignal[] {
  if (!explanation) return [];
  const lines = explanation.split("\n");
  const signals: RelevantSignal[] = [];
  
  for (const line of lines) {
    const upperLine = line.toUpperCase();
    if (upperLine.includes("CORE:") && upperLine.includes("INDICADOR:") && (upperLine.includes("SEÑAL:") || upperLine.includes("SENAL:")) && upperLine.includes("SCORE:")) {
      const coreMatch = line.match(/CORE:\s*([^|]+)/i);
      const indicatorMatch = line.match(/INDICADOR:\s*([^|]+)/i);
      const senalMatch = line.match(/SE[ÑN]AL:\s*([^|]+)/i);
      const scoreMatch = line.match(/SCORE:\s*([^|]+)/i);
      const detailMatch = line.match(/DETALLE:\s*(.+)/i);

      let core = coreMatch?.[1]?.trim() || "";
      // Remover asteriscos o viñetas iniciales que Gemini pueda haber dejado
      core = core.replace(/^[*-\s]+/, "").trim();
      
      const indicator = indicatorMatch?.[1]?.trim() || "";
      const senal = senalMatch?.[1]?.trim() || "";
      const scoreRaw = scoreMatch?.[1]?.trim() || "0";
      const detail = detailMatch?.[1]?.trim() || "";
      
      const score = parseFloat(scoreRaw);
      if (core && indicator) {
        signals.push({ core, indicator, senal, score, detail });
      }
    }
  }
  return signals.slice(0, 10);
}

export function cleanExplanation(explanation: string): string {
  if (!explanation) return "";
  const index = explanation.toUpperCase().indexOf("SALIDAS RELEVANTES");
  if (index !== -1) {
    return explanation.slice(0, index).trim();
  }
  return explanation;
}

export function buildSvgBarChart(signals: RelevantSignal[]): string {
  if (signals.length === 0) return "";
  
  const width = 680;
  const barHeight = 22;
  const padding = 10;
  const labelWidth = 150;
  const chartWidth = width - labelWidth - 40;
  const height = signals.length * (barHeight + padding) + 45;
  
  const yAxisX = labelWidth;
  const xAxisY = height - 25;
  const zeroX = yAxisX + chartWidth / 2;
  
  let svgContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="font-family: 'Inter', sans-serif; display: block; margin: 0 auto;">`;
  
  // Background
  svgContent += `<rect width="${width}" height="${height}" fill="#f8fafc" rx="8" />`;
  
  // Grid Ticks
  const ticks = [-1.0, -0.5, 0, 0.5, 1.0];
  ticks.forEach(tick => {
    const x = zeroX + (tick * (chartWidth / 2));
    svgContent += `
      <line x1="${x}" y1="15" x2="${x}" y2="${xAxisY}" stroke="#e2e8f0" stroke-dasharray="3,3" />
      <text x="${x}" y="${xAxisY + 12}" font-size="10" font-weight="600" fill="#94a3b8" text-anchor="middle">${tick >= 0 ? "+" : ""}${tick.toFixed(1)}</text>
    `;
  });
  
  // Zero Axis Line
  svgContent += `<line x1="${zeroX}" y1="10" x2="${zeroX}" y2="${xAxisY}" stroke="#94a3b8" stroke-width="1.5" />`;
  
  // Render Bars
  signals.forEach((s, idx) => {
    const y = 15 + idx * (barHeight + padding);
    const scoreVal = s.score;
    const barWidth = Math.abs(scoreVal) * (chartWidth / 2);
    const x = scoreVal >= 0 ? zeroX : zeroX - barWidth;
    const barColor = s.senal === "CALL" ? "#00a87e" : s.senal === "PUT" ? "#cf222e" : "#64748b";
    
    svgContent += `
      <!-- Label -->
      <text x="${yAxisX - 10}" y="${y + barHeight/2 + 4}" font-size="11" font-weight="600" fill="#334155" text-anchor="end">${s.indicator}</text>
      
      <!-- Bar -->
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${barColor}" rx="3" opacity="0.85" />
      
      <!-- Score Text -->
      <text x="${scoreVal >= 0 ? x + barWidth + 6 : x - 6}" y="${y + barHeight/2 + 4}" font-size="10" font-weight="700" fill="${barColor}" text-anchor="${scoreVal >= 0 ? "start" : "end"}">${scoreVal >= 0 ? "+" : ""}${scoreVal.toFixed(2)}</text>
    `;
  });
  
  svgContent += `</svg>`;
  return svgContent;
}

export function buildSvgDonutChart(signals: RelevantSignal[]): string {
  let callCount = 0;
  let putCount = 0;
  let holdCount = 0;
  for (const s of signals) {
    if (s.senal === "CALL") callCount++;
    else if (s.senal === "PUT") putCount++;
    else holdCount++;
  }
  const total = signals.length;
  if (total === 0) return "";
  
  const callPct = (callCount / total) * 100;
  const putPct = (putCount / total) * 100;
  const holdPct = (holdCount / total) * 100;
  
  const radius = 75;
  const circumference = 2 * Math.PI * radius;
  
  const callStroke = (callPct / 100) * circumference;
  const putStroke = (putPct / 100) * circumference;
  const holdStroke = (holdPct / 100) * circumference;
  
  let currentOffset = 0;
  
  const callDash = `${callStroke} ${circumference - callStroke}`;
  const callOffset = -currentOffset;
  currentOffset += callStroke;
  
  const putDash = `${putStroke} ${circumference - putStroke}`;
  const putOffset = -currentOffset;
  currentOffset += putStroke;
  
  const holdDash = `${holdStroke} ${circumference - holdStroke}`;
  const holdOffset = -currentOffset;
  
  const width = 500;
  const height = 240;
  const cx = 150;
  const cy = height / 2;
  
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="font-family: 'Inter', sans-serif; display: block; margin: 0 auto;">
      <rect width="${width}" height="${height}" fill="#f8fafc" rx="8" />
      
      <!-- Donut Base -->
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="transparent" stroke="#f1f5f9" stroke-width="22" />
      
      <!-- CALL -->
      ${callStroke > 0 ? `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="transparent" stroke="#00a87e" stroke-width="22" stroke-dasharray="${callDash}" stroke-dashoffset="${callOffset}" transform="rotate(-90 ${cx} ${cy})" />` : ""}
      
      <!-- PUT -->
      ${putStroke > 0 ? `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="transparent" stroke="#cf222e" stroke-width="22" stroke-dasharray="${putDash}" stroke-dashoffset="${putOffset}" transform="rotate(-90 ${cx} ${cy})" />` : ""}
      
      <!-- HOLD -->
      ${holdStroke > 0 ? `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="transparent" stroke="#64748b" stroke-width="22" stroke-dasharray="${holdDash}" stroke-dashoffset="${holdOffset}" transform="rotate(-90 ${cx} ${cy})" />` : ""}
      
      <!-- Center text -->
      <text x="${cx}" y="${cy - 6}" font-size="11" font-weight="700" fill="#94a3b8" text-anchor="middle">SEÑALES</text>
      <text x="${cx}" y="${cy + 20}" font-size="26" font-weight="800" fill="#0f172a" text-anchor="middle">${total}</text>
      
      <!-- Legend -->
      <g transform="translate(290, 70)">
        <circle cx="5" cy="10" r="7.5" fill="#00a87e" />
        <text x="22" y="15" font-size="14" font-weight="600" fill="#334155">CALL: ${callCount} (${Math.round(callPct)}%)</text>
        
        <circle cx="5" cy="40" r="7.5" fill="#cf222e" />
        <text x="22" y="45" font-size="14" font-weight="600" fill="#334155">PUT: ${putCount} (${Math.round(putPct)}%)</text>
        
        <circle cx="5" cy="70" r="7.5" fill="#64748b" />
        <text x="22" y="75" font-size="14" font-weight="600" fill="#334155">HOLD: ${holdCount} (${Math.round(holdPct)}%)</text>
      </g>
    </svg>
  `;
}

interface Props {
  row: ConfluenceSignalRow;
  activeStrategy?: string;
}

export function ObservationsTab({ row, activeStrategy }: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  const canonicalStr = buildCanonicalOutputString(row);
  const mdStr = buildSignalContextMD(row, activeStrategy);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(canonicalStr);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch { /* ignore */ }
    setDropdownOpen(false);
  };

  const handleDownload = () => {
    const content = `# Observación Canónica\n\n${canonicalStr}\n\n---\n\n${mdStr}`;
    const filename = `${row.core}-${row.ticket ?? "ticker"}-${row.fecha}.md`;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setDropdownOpen(false);
  };

  const handleDownloadPdf = () => {
    if (!contentRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    // Parse relevant signals from the row observation's explanation
    const rawExplanation = row.observacion.explicacion || "";
    const signals = parseRelevantSignals(rawExplanation);
    const cleanedExplanation = cleanExplanation(rawExplanation);
    
    // Format computed date
    const formattedDate = new Date(row.computed_at).toLocaleString();
    
    // Determine colors based on signal row
    const decisionColor = row.tipoSenal === "CALL" ? "#00a87e" : row.tipoSenal === "PUT" ? "#cf222e" : "#8b949e";
    const decisionBg = row.tipoSenal === "CALL" ? "#d1f5ea" : row.tipoSenal === "PUT" ? "#ffebe9" : "#eaeef2";
    
    // Build Svg charts
    const donutChartHtml = buildSvgDonutChart(signals);
    const barChartHtml = buildSvgBarChart(signals);
    
    const graphicalChartsContainer = signals.length > 0 ? `
      <div class="section-title" style="text-align: center;">GRÁFICAS DE SEÑALES RELEVANTES</div>
      <div style="display: flex; flex-direction: column; gap: 30px; margin-bottom: 30px; page-break-inside: avoid; align-items: center; width: 100%;">
        <div style="width: 100%; display: flex; flex-direction: column; align-items: center;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.05em; text-align: center;">Distribución de Veredictos</div>
          <div style="display: flex; justify-content: center; width: 100%;">
            ${donutChartHtml}
          </div>
        </div>
        <div style="width: 100%; display: flex; flex-direction: column; align-items: center;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.05em; text-align: center;">Fuerza Confluence (Score de Indicadores)</div>
          <div style="display: flex; justify-content: center; width: 100%;">
            ${barChartHtml}
          </div>
        </div>
      </div>
    ` : "";
    
    // Build HTML chart for relevant signals
    const signalsChartHtml = signals.length > 0 ? `
      <div class="section-title">DETALLE DE CONFLUENCIAS CLAVE</div>
      <table class="signals-table">
        <thead>
          <tr>
            <th>Core</th>
            <th>Indicador / Pata</th>
            <th>Señal</th>
            <th>Score</th>
            <th>Detalle de Observación</th>
          </tr>
        </thead>
        <tbody>
          ${signals.map(s => {
            const barColor = s.senal === "CALL" ? "#00a87e" : s.senal === "PUT" ? "#cf222e" : "#64748b";
            const badgeBg = s.senal === "CALL" ? "#d1f5ea" : s.senal === "PUT" ? "#ffebe9" : "#eaeef2";
            const badgeColor = s.senal === "CALL" ? "#00684a" : s.senal === "PUT" ? "#cf222e" : "#475569";
            
            return `
              <tr>
                <td><span class="badge-core">${s.core}</span></td>
                <td><strong>${s.indicator}</strong></td>
                <td><span class="badge-senal" style="background-color: ${badgeBg}; color: ${badgeColor};">${s.senal}</span></td>
                <td><strong style="color: ${barColor};">${s.score >= 0 ? "+" : ""}${s.score.toFixed(2)}</strong></td>
                <td>${s.detail}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    ` : "";

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reporte Confluencia - ${row.ticket || "Asset"}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            
            @page {
              size: A4 portrait;
              margin: 25mm 15mm 20mm 15mm;
            }
            body { 
              font-family: 'Inter', -apple-system, sans-serif; 
              color: #1e293b; 
              margin: 0 auto;
              padding: 40px 15px; 
              line-height: 1.6; 
              background-color: #ffffff;
              max-width: 680px;
            }
            @media print {
              body {
                padding: 0;
                margin: 0;
                max-width: 100%;
              }
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 15px;
              margin-bottom: 25px;
            }
            .title-section h1 {
              font-size: 24px;
              font-weight: 800;
              margin: 0;
              color: #0f172a;
              letter-spacing: -0.02em;
            }
            .title-section p {
              font-size: 12px;
              color: #64748b;
              margin: 4px 0 0 0;
            }
            .ticker-badge {
              font-size: 18px;
              font-weight: 800;
              background-color: #f1f5f9;
              border: 1px solid #cbd5e1;
              padding: 6px 16px;
              border-radius: 6px;
              color: #0f172a;
            }
            .summary-box {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 15px 20px;
              margin-bottom: 25px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .verdict-info {
              display: flex;
              flex-direction: column;
              gap: 2px;
            }
            .verdict-title {
              font-size: 11px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .verdict-badge {
              font-size: 15px;
              font-weight: 800;
              padding: 4px 12px;
              border-radius: 50px;
              display: inline-block;
            }
            .confidence-value {
              font-size: 20px;
              font-weight: 800;
              color: #0f172a;
            }
            .section-title {
              font-size: 12px;
              font-weight: 800;
              color: #475569;
              letter-spacing: 0.05em;
              text-transform: uppercase;
              margin-top: 30px;
              margin-bottom: 12px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 6px;
              page-break-after: avoid;
            }
            .narrative {
              font-size: 13.5px;
              color: #334155;
              white-space: pre-wrap;
              background-color: #f8fafc;
              padding: 15px;
              border-radius: 6px;
              border-left: 4px solid #0f172a;
              margin-bottom: 25px;
            }
            .signals-table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 10px 0 25px 0; 
              font-size: 12px; 
              page-break-inside: avoid;
            }
            .signals-table th, .signals-table td { 
              border-bottom: 1px solid #e2e8f0; 
              padding: 10px 12px; 
              text-align: left; 
            }
            .signals-table th { 
              background-color: #f8fafc; 
              text-transform: uppercase; 
              font-size: 10px; 
              letter-spacing: 0.05em; 
              color: #475569; 
              font-weight: 700;
            }
            .details-table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0 25px 0;
              font-size: 12px;
              page-break-inside: avoid;
            }
            .details-table th,
            .details-table td {
              border-bottom: 1px solid #e2e8f0;
              padding: 12px 14px;
              text-align: left;
            }
            .details-table th {
              background-color: #f8fafc;
              text-transform: uppercase;
              font-size: 10px;
              letter-spacing: 0.05em;
              color: #475569;
              font-weight: 700;
            }
            .badge-core {
              font-size: 9px;
              background-color: #e2e8f0;
              padding: 2px 6px;
              border-radius: 4px;
              color: #334155;
              font-weight: 600;
            }
            .badge-senal {
              font-size: 10px;
              font-weight: 700;
              padding: 2px 8px;
              border-radius: 4px;
              text-transform: uppercase;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 15px;
              margin-bottom: 25px;
            }
            .meta-item {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 10px 12px;
            }
            .meta-label {
              font-size: 10px;
              text-transform: uppercase;
              color: #64748b;
              font-weight: 600;
              margin-bottom: 2px;
            }
            .meta-value {
              font-size: 13px;
              font-weight: 700;
              color: #0f172a;
            }
            .footer-disclaimer { 
              font-size: 9.5px; 
              color: #94a3b8; 
              text-align: center; 
              margin-top: 40px; 
              border-top: 1px solid #e2e8f0; 
              padding-top: 15px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title-section">
              <h1>REPORTE DE AUDITORÍA QUANT IA</h1>
              <p>Generado automáticamente a través de la simulación de confluencia</p>
            </div>
            <div class="ticker-badge">${row.ticket}</div>
          </div>

          <div class="summary-box">
            <div class="verdict-info">
              <span class="verdict-title">Veredicto Consolidado</span>
              <div>
                <span class="verdict-badge" style="background-color: ${decisionBg}; color: ${decisionColor};">
                  VIABLE: ${row.tipoSenal === "CALL" || row.tipoSenal === "PUT" ? "SÍ" : "NO"} (${row.tipoSenal})
                </span>
              </div>
            </div>
            <div class="verdict-info" style="align-items: flex-end;">
              <span class="verdict-title" style="text-align: right;">Confianza / Score</span>
              <span class="confidence-value">${Math.round(Math.abs(row.score) * 100)}%</span>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <div class="meta-label">Temporalidad</div>
              <div class="meta-value">${row.timeframe}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Fecha de Ejecución</div>
              <div class="meta-value">${formattedDate}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Estrategia Activa</div>
              <div class="meta-value">${activeStrategy ? activeStrategy.replace(/_/g, " ") : "General / Ninguna"}</div>
            </div>
          </div>

          <div class="section-title">Análisis de Justificación Técnica</div>
          <div class="narrative">${cleanedExplanation || row.observacion.explicacion}</div>

          ${graphicalChartsContainer}

          ${signalsChartHtml}

          <div class="section-title">Detalles de la Señal</div>
          <table class="details-table">
            <thead>
              <tr>
                <th>Campo</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Core</td>
                <td>${row.core}${row.subCore ? ` / ${row.subCore}` : ""}</td>
              </tr>
              <tr>
                <td>Tipo Señal</td>
                <td>${row.tipoSenal}</td>
              </tr>
              <tr>
                <td>Tendencia</td>
                <td>${row.tendencia ?? "N/A"}</td>
              </tr>
              <tr>
                <td>Precio</td>
                <td>${typeof row.precio === "number" ? `$${row.precio.toFixed(2)}` : "N/A"}</td>
              </tr>
              <tr>
                <td>Score</td>
                <td>${row.score.toFixed(3)}</td>
              </tr>
              <tr>
                <td>Peso</td>
                <td>${row.peso.toFixed(3)}</td>
              </tr>
              <tr>
                <td>Fecha</td>
                <td>${row.fecha ?? "N/A"}</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">Detalles del Core Operativo</div>
          <div class="meta-grid">
            <div class="meta-item">
              <div class="meta-label">Core de Origen</div>
              <div class="meta-value">${row.core}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Algoritmo Versión</div>
              <div class="meta-value">${row.algorithm_version}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Fuente del Core</div>
              <div class="meta-value">${row.fuente}</div>
            </div>
          </div>

          <div class="footer-disclaimer">
            Este informe es de carácter estrictamente informativo y cuantitativo. Las evaluaciones de Inteligencia Artificial 
            deben ser contrastadas por un analista certificado antes de cualquier toma de decisión operativa.
          </div>
        </body>
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", margin: 0 }}>
          Salida canónica según estándar de equipo. Formato auditable y comparable entre cores.
        </p>

        {/* FIC: Split button — copy or download / Botón dividido — copiar o descargar */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setDropdownOpen((o) => !o)}
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
                minWidth: 140,
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              }}
            >
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.5rem 0.9rem",
                  fontSize: "0.78rem",
                  background: "none",
                  border: "none",
                  color: "var(--color-text)",
                  cursor: "pointer",
                 }}
              >
                Copiar texto
              </button>
              <button
                type="button"
                onClick={handleDownload}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.5rem 0.9rem",
                  fontSize: "0.78rem",
                  background: "none",
                  border: "none",
                  color: "var(--color-text)",
                  cursor: "pointer",
                }}
              >
                Descargar .md
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.5rem 0.9rem",
                  fontSize: "0.78rem",
                  background: "none",
                  border: "none",
                  color: "var(--color-text)",
                  cursor: "pointer",
                }}
              >
                Descargar .pdf
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FIC: Renderizado del Markdown en lugar de texto plano / Markdown rendering instead of plain text */}
      <div
        ref={contentRef}
        style={{
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          padding: "1rem",
          maxHeight: 420,
          overflowY: "auto",
        }}
      >
        <MarkdownContent content={mdStr} />
      </div>
    </div>
  );
}

export default ObservationsTab;
