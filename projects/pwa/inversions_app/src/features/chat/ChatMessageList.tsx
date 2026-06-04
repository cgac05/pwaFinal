// FIC: ChatMessageList — scrollable message history with pending spinner, error state, and retry button.
// FIC: ChatMessageList — historial de mensajes con scroll, spinner de pendiente, estado de error y botón de reintentar.

import React, { useEffect, useRef } from "react";
import type { ChatMessage } from "./types";

interface ChatMessageListProps {
  messages: ChatMessage[];
  onRetry: (messageId: string) => void;
}

export function ChatMessageList({ messages, onRetry }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", textAlign: "center", padding: "var(--space-lg)" }}>
        <div>
          <div style={{ fontSize: "1.5rem", marginBottom: "var(--space-sm)" }}>💬</div>
          <p>Haz una pregunta sobre el instrumento activo</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-sm)", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
      {messages.map((msg) => (
        <div
          key={msg.id}
          data-testid={`chat-message-${msg.role}`}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: msg.role === "user" ? "flex-end" : "flex-start",
          }}
        >
          {msg.role === "system" ? (
            <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", textAlign: "center", width: "100%", padding: "var(--space-xs) 0", fontStyle: "italic" }}>
              {msg.content}
            </div>
          ) : (
            <div
              style={{
                maxWidth: "90%",
                padding: "var(--space-xs) var(--space-sm)",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--font-size-sm)",
                background: msg.role === "user" ? "var(--color-accent-subtle)" : "var(--color-surface-raised)",
                border: `1px solid ${msg.role === "user" ? "var(--color-accent)" : "var(--color-border)"}`,
                color: "var(--color-text)",
                lineHeight: 1.5,
              }}
            >
              {msg.status === "pending" ? (
                <span style={{ color: "var(--color-text-muted)" }}>
                  ● ● ●
                </span>
              ) : msg.status === "error" ? (
                <div>
                  <span style={{ color: "var(--color-sell)" }}>{msg.content}</span>
                  <button
                    onClick={() => onRetry(msg.id)}
                    style={{ marginLeft: "var(--space-xs)", fontSize: "var(--font-size-xs)", color: "var(--color-accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    Reintentar
                  </button>
                </div>
              ) : (
                <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
              )}
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
