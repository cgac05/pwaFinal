// FIC: Segmented pill selector — Revolut sub-nav-pill style. Active pill uses accent color.
// FIC: Selector segmentado tipo píldora — estilo sub-nav-pill Revolut. Píldora activa usa color acento.

import React from "react";

interface PillOption<T extends string = string> {
  value: T;
  label: string;
}

interface PillGroupProps<T extends string = string> {
  options: PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label"?: string;
}

export function PillGroup<T extends string = string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel
}: PillGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        gap: "var(--space-xs)",
        background: "var(--color-surface-raised)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-pill)",
        padding: "3px"
      }}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.value)}
            style={{
              background: isActive ? "var(--color-accent)" : "transparent",
              color: isActive ? "#ffffff" : "var(--color-text-muted)",
              border: "none",
              borderRadius: "var(--radius-pill)",
              padding: "0.3rem 0.75rem",
              fontSize: "var(--font-size-sm)",
              fontWeight: isActive ? "var(--font-weight-emphasis)" : "var(--font-weight-body)",
              cursor: "pointer",
              transition: "background var(--duration-fast) var(--easing-standard), color var(--duration-fast) var(--easing-standard)"
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
