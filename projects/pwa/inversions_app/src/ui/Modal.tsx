// FIC: Confirmation modal — centered overlay, explicit close only, ESC triggers onCancel.
// FIC: Modal de confirmación — overlay centrado, cierre solo explícito, ESC dispara onCancel.

import React, { useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  "data-testid"?: string;
}

export function Modal({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  "data-testid": testId
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const confirmBg =
    variant === "warning" ? "var(--color-warning)" :
    variant === "danger" ? "var(--color-sell)" :
    "var(--color-accent)";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid={testId}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.7)"
      }}
    >
      <div
        style={{
          background: "var(--color-surface-raised)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-xl)",
          maxWidth: 440,
          width: "90%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)"
        }}
      >
        <h2 style={{
          margin: 0,
          marginBottom: "var(--space-sm)",
          fontSize: "var(--font-size-lg)",
          fontWeight: "var(--font-weight-bold)",
          color: "var(--color-text)"
        }}>
          {title}
        </h2>
        <p style={{
          margin: 0,
          marginBottom: "var(--space-xl)",
          color: "var(--color-text-muted)",
          fontSize: "var(--font-size-sm)",
          lineHeight: 1.6
        }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: "var(--space-sm)", justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              background: "var(--color-surface)",
              color: "var(--color-text-muted)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-pill)",
              padding: "0.5rem 1.25rem",
              fontSize: "var(--font-size-sm)",
              fontWeight: "var(--font-weight-emphasis)",
              cursor: "pointer"
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: confirmBg,
              color: "#ffffff",
              border: "none",
              borderRadius: "var(--radius-pill)",
              padding: "0.5rem 1.25rem",
              fontSize: "var(--font-size-sm)",
              fontWeight: "var(--font-weight-emphasis)",
              cursor: "pointer"
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
