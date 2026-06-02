// FIC: Canonical observations tab — shows canonical output string with copy/download options. (EN)
// FIC: Pestaña de observaciones canónicas — muestra el string canónico con opciones de copiar/descargar. (ES)

import React, { useState } from "react";
import type { ConfluenceSignalRow } from "../../services/signals/confluenceTableApi";
import { MarkdownContent } from "../../components/ui/MarkdownContent";
import {
  buildCanonicalOutputString,
  buildSignalContextMD,
} from "../../services/signals/confluenceTableApi";

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

  const handleDownloadPdf = async () => {
    setDropdownOpen(false);
    if (!contentRef.current) return;

    // Create a temporary container for printing with stylized content
    const printContainer = document.createElement("div");
    printContainer.style.position = "absolute";
    printContainer.style.left = "-9999px";
    printContainer.style.top = "0";
    printContainer.style.width = "180mm"; // standard printable width
    printContainer.style.fontFamily = "Arial, sans-serif";
    printContainer.style.color = "#1e293b";
    printContainer.style.backgroundColor = "#ffffff";
    printContainer.style.padding = "20px";

    // Build the inner HTML of the print container
    printContainer.innerHTML = `
      <div style="border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 18px; color: #0f172a; text-transform: uppercase;">
          Reporte de Observaciones Canónicas
        </h1>
        <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b;">
          Generado automáticamente el ${new Date().toLocaleString()}
        </p>
      </div>

      <div style="margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-size: 11px;">
        <div><strong>Ticker:</strong> ${row.ticket || "N/A"}</div>
        <div><strong>Core:</strong> ${row.core.replace("A_", "")}</div>
        <div><strong>Tipo Señal:</strong> ${row.tipoSenal}</div>
        <div><strong>Score:</strong> ${row.score.toFixed(3)}</div>
      </div>

      <div style="font-size: 11.5px; line-height: 1.6; color: #334155;">
        ${contentRef.current.innerHTML}
      </div>
    `;

    document.body.appendChild(printContainer);

    try {
      const html2pdfLib = (await import("html2pdf.js")).default;
      const opt = {
        margin: 10,
        filename: `Observaciones_${row.core}_${row.ticket ?? "ticker"}_${row.fecha}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const }
      };
      await html2pdfLib().set(opt).from(printContainer).save();
    } catch (err) {
      console.error("Failed to generate PDF for observations:", err);
    } finally {
      document.body.removeChild(printContainer);
    }
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
