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

  const handleDownloadPdf = () => {
    if (!contentRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Exportación - ${row.ticket || "Confluencia"}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1f2328; padding: 40px; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
            th, td { border-bottom: 1px solid #d0d7de; padding: 10px 12px; text-align: left; }
            th { background-color: #f6f8fa; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; color: #656d76; }
            h1 { font-size: 24px; border-bottom: 1px solid #d0d7de; padding-bottom: 8px; margin-bottom: 16px; }
            h2 { font-size: 20px; margin-top: 24px; }
            h3 { font-size: 16px; margin-top: 20px; color: #656d76; text-transform: uppercase; letter-spacing: 0.05em; }
            ul { padding-left: 20px; }
            li { margin-bottom: 4px; }
            strong { font-weight: 600; }
          </style>
        </head>
        <body>
          ${contentRef.current.innerHTML}
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
