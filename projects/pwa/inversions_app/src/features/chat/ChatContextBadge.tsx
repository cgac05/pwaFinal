// FIC: ChatContextBadge — shows active instrument symbol/timeframe and signal context as labels in chat header.
// FIC: ChatContextBadge — muestra el símbolo/timeframe del instrumento activo y el contexto de señal en el header del chat.

import React from "react";
import { useSignalStore } from "../../store/signals";

export function ChatContextBadge() {
  const { selectedInstrument, signalContextMD, setSignalContextMD } = useSignalStore();
  const title = selectedInstrument?.name
    ? `${selectedInstrument.symbol} - ${selectedInstrument.name}`
    : selectedInstrument?.symbol;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
      {!selectedInstrument?.symbol ? (
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
      ) : (
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
      )}

      {signalContextMD && (
        <span
          data-testid="chat-signal-context-badge"
          title="Señal de confluencia cargada como contexto. Clic para limpiar."
          onClick={() => setSignalContextMD(undefined)}
          style={{
            fontSize: "var(--font-size-xs)",
            color: "#000",
            background: "var(--color-accent, #ffd43b)",
            border: "1px solid var(--color-accent, #ffd43b)",
            borderRadius: "var(--radius-pill)",
            padding: "2px var(--space-sm)",
            whiteSpace: "nowrap",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          + Señal ✕
        </span>
      )}
    </div>
  );
}
