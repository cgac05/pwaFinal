// FIC: Runtime mode badge for the NavBar — supports pulse animation for critical states.
// FIC: Badge de modo runtime para la NavBar — soporta animación de pulso para estados críticos.

import React from "react";

interface BadgeProps {
  label: string;
  color: string;
  icon?: React.ReactNode;
  size?: "sm" | "md";
  pulse?: boolean;
}

export function Badge({ label, color, icon, size = "sm", pulse = false }: BadgeProps) {
  const fontSize = size === "sm" ? "var(--font-size-xs)" : "var(--font-size-sm)";
  const padding = size === "sm" ? "0.2rem 0.6rem" : "0.35rem 0.85rem";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
        borderRadius: "var(--radius-pill)",
        fontSize,
        fontWeight: "var(--font-weight-emphasis)",
        padding,
        letterSpacing: "0.03em",
        animation: pulse ? "badge-pulse 2s ease-in-out infinite" : undefined
      }}
    >
      {icon}
      {label}
    </span>
  );
}
