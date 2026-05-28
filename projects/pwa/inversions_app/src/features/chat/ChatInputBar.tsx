// FIC: ChatInputBar — controlled textarea + send button, disabled while AI is processing (FR-010).
// FIC: ChatInputBar — textarea controlado + botón de envío, deshabilitado mientras la IA procesa (FR-010).

import React, { useState } from "react";
import { Send } from "lucide-react";

interface ChatInputBarProps {
  onSend: (text: string) => void;
  pending: boolean;
}

export function ChatInputBar({ onSend, pending }: ChatInputBarProps) {
  const [text, setText] = useState("");

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    onSend(trimmed);
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "var(--space-xs)",
        padding: "var(--space-sm)",
        borderTop: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        flexShrink: 0,
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={pending}
        placeholder={pending ? "Esperando respuesta…" : "Escribe tu pregunta…"}
        rows={2}
        style={{
          flex: 1,
          resize: "none",
          background: "var(--color-surface-raised)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          color: "var(--color-text)",
          fontSize: "var(--font-size-sm)",
          padding: "var(--space-xs) var(--space-sm)",
          outline: "none",
          opacity: pending ? 0.6 : 1,
          fontFamily: "inherit",
        }}
      />
      <button
        onClick={handleSend}
        disabled={pending || !text.trim()}
        aria-label="Enviar mensaje"
        style={{
          background: "var(--color-accent)",
          border: "none",
          borderRadius: "var(--radius-sm)",
          color: "#fff",
          cursor: pending || !text.trim() ? "not-allowed" : "pointer",
          opacity: pending || !text.trim() ? 0.5 : 1,
          padding: "var(--space-xs)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          height: "36px",
          width: "36px",
        }}
      >
        <Send size={16} />
      </button>
    </div>
  );
}
