// FIC: ChatContextBadge — shows active instrument symbol/timeframe as context label in chat header.
// FIC: ChatContextBadge — muestra el símbolo/timeframe del instrumento activo como etiqueta de contexto en el header del chat.

import React from "react";
import { useSignalStore } from "../../store/signals";

export function ChatContextBadge() {
  const { selectedInstrument } = useSignalStore();
  const title = selectedInstrument?.name
    ? `${selectedInstrument.symbol} - ${selectedInstrument.name}`
    : selectedInstrument?.symbol;

  if (!selectedInstrument?.symbol) {
    return (
      <span
        data-testid="chat-context-badge"
        style={{
          fontSize: "var(--font-size-xs)",
          color: "var(--color-text-muted)",
          background: "var(--color-surface-raised)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-pill)",
          padding: "2px var(--space-sm)",
          whiteSpace: "nowrap",
        }}
      >
        Sin contexto
      </span>
    );
  }

  return (
    <span
      data-testid="chat-context-badge"
      title={title}
      style={{
        fontSize: "var(--font-size-xs)",
        color: "var(--color-accent)",
        background: "var(--color-accent-subtle)",
        border: "1px solid var(--color-accent)",
        borderRadius: "var(--radius-pill)",
        padding: "2px var(--space-sm)",
        whiteSpace: "nowrap",
        fontWeight: "var(--font-weight-emphasis)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {selectedInstrument.symbol}
    </span>
  );
}
