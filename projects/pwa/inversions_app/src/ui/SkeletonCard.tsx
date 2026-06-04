// FIC: Skeleton loading placeholder with skeleton-pulse animation — Revolut style.
// FIC: Placeholder de carga con animación skeleton-pulse — estilo Revolut.

import React from "react";

interface SkeletonCardProps {
  height?: string | number;
  lines?: number;
  className?: string;
}

export function SkeletonCard({ height = 110, lines = 3, className }: SkeletonCardProps) {
  const heightValue = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className={className}
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-md)",
        height: heightValue,
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-sm)",
        overflow: "hidden"
      }}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{
            height: i === 0 ? "1.25rem" : "0.875rem",
            borderRadius: "var(--radius-sm)",
            width: i === lines - 1 ? "60%" : "100%"
          }}
        />
      ))}
    </div>
  );
}
