// FIC: Generic overlay drawer with slide-in/out animations, focus trap, and scroll lock.
// FIC: Drawer overlay genérico con animaciones de deslizamiento, trampa de foco y bloqueo de scroll.

import React, { useEffect, useRef } from "react";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  position?: "left" | "right";
  width?: string;
  title?: string;
  children: React.ReactNode;
  "data-testid"?: string;
}

export function Drawer({
  isOpen,
  onClose,
  position = "right",
  width = "var(--drawer-width)",
  title,
  children,
  "data-testid": testId
}: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
      document.body.style.overflow = "hidden";

      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.[0]?.focus();
    } else {
      document.body.style.overflow = "";
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && drawerRef.current) {
        const focusable = Array.from(
          drawerRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute("disabled"));

        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const slideIn = position === "right" ? "drawer-slide-in-right" : "drawer-slide-in-left";
  const translateOut = position === "right" ? "translateX(100%)" : "translateX(-100%)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 900,
        display: "flex",
        justifyContent: position === "right" ? "flex-end" : "flex-start"
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.6)"
        }}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        style={{
          position: "relative",
          width,
          height: "100%",
          background: "var(--color-surface-raised)",
          borderLeft: position === "right" ? "1px solid var(--color-border)" : undefined,
          borderRight: position === "left" ? "1px solid var(--color-border)" : undefined,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          animation: `${slideIn} var(--duration-slow) var(--easing-decelerate) forwards`
        }}
      >
        {/* Header */}
        {title && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--space-md) var(--space-lg)",
            borderBottom: "1px solid var(--color-border)",
            flexShrink: 0
          }}>
            <span style={{
              fontWeight: "var(--font-weight-bold)",
              fontSize: "var(--font-size-base)",
              color: "var(--color-text)"
            }}>
              {title}
            </span>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              style={{
                background: "none",
                border: "none",
                color: "var(--color-text-muted)",
                cursor: "pointer",
                fontSize: "1.25rem",
                lineHeight: 1,
                padding: "var(--space-xs)"
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, padding: "var(--space-lg)", overflow: "auto" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
