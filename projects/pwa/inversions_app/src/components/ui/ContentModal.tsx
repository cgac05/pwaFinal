// FIC: Content modal — full-content overlay with scroll, close button, no fixed footer buttons. (EN)
// FIC: Modal de contenido — overlay de contenido completo con scroll, botón de cierre, sin botones fijos. (ES)

import React, { useEffect, useCallback } from "react";
import { X } from "lucide-react";

interface ContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: string;
  "data-testid"?: string;
}

// FIC: ContentModal — use this for information-rich overlays (institutional detail, coverage strategies).
//      Modal.tsx is for confirmation dialogs only. (EN)
// FIC: ContentModal — úsalo para overlays con información rica (detalle institucional, estrategias de cobertura).
//      Modal.tsx es solo para diálogos de confirmación. (ES)
export function ContentModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = "840px",
  "data-testid": testId,
}: ContentModalProps) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, handleKey]);

  if (!isOpen) return null;

  return (
    <div
      data-testid={testId}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.72)",
        padding: "var(--space-lg)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: "var(--color-surface-raised)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "var(--radius-md)",
          width: "100%",
          maxWidth: width,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "var(--space-lg)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "var(--font-size-lg)",
                fontWeight: 600,
                color: "var(--color-text)",
              }}
            >
              {title}
            </h2>
            {subtitle && (
              <p
                style={{
                  margin: "var(--space-xs) 0 0",
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-text-muted)",
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "var(--space-xs)",
              color: "var(--color-text-muted)",
              borderRadius: "var(--radius-xs)",
              display: "flex",
              alignItems: "center",
              transition: "color var(--duration-fast) var(--easing-standard)",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)"; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "var(--space-lg)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
