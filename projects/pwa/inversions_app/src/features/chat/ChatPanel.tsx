// FIC: ChatPanel — AI chat panel with sessionStorage history, context-aware sending, and rate limit handling.
// FIC: ChatPanel — panel de chat IA con historial en sessionStorage, envío con contexto y manejo de rate limit.

import React, { useState, useEffect, useCallback } from "react";
import { MessageSquare } from "lucide-react";
import type { ChatMessage } from "./types";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInputBar } from "./ChatInputBar";
import { ChatContextBadge } from "./ChatContextBadge";
import { sendChatMessage } from "../../services/chat/chatApi";
import { useSignalStore } from "../../store/signals";
import { useAppShellStore } from "../../store/appShell";
import { getObservationSummary } from "../../store/institutional";

const STORAGE_KEY = "inversions.chat.history";
const MAX_MESSAGES = 100;
const TRIM_TO = 80;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadHistory(): ChatMessage[] {
  try {
    const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(STORAGE_KEY) : null;
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages: ChatMessage[]): void {
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  } catch {
    // silent — sessionStorage may be unavailable in some contexts
  }
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory());
  const [pending, setPending] = useState(false);
  const { selectedInstrument } = useSignalStore();
  const { analysisCategory } = useAppShellStore();

  // FIC: Persist history to sessionStorage on every change.
  // FIC: Persistir historial en sessionStorage en cada cambio.
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  const trimHistory = useCallback((msgs: ChatMessage[]): ChatMessage[] => {
    if (msgs.length <= MAX_MESSAGES) return msgs;
    const systemMsg: ChatMessage = {
      id: generateId(),
      role: "system",
      content: "El historial fue comprimido para mantener el rendimiento.",
      context: null,
      timestamp: Date.now(),
      status: "ok",
    };
    return [systemMsg, ...msgs.slice(msgs.length - TRIM_TO)];
  }, []);

  const handleSend = useCallback(async (text: string) => {
    if (pending) return;

    // FIC: Enrich context with institutional observations from TEAM-05 store if available. (EN)
    // FIC: Enriquece el contexto con observaciones institucionales del store de TEAM-05 si están disponibles. (ES)
    const institutionalObservations = selectedInstrument?.symbol
      ? getObservationSummary(selectedInstrument.symbol)
      : null;

    const context = selectedInstrument?.symbol
      ? { symbol: selectedInstrument.symbol, timeframe: "1d", analysisCategory, institutionalObservations }
      : null;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      content: text,
      context,
      timestamp: Date.now(),
      status: "ok",
    };

    const assistantId = generateId();
    const assistantPending: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      context,
      timestamp: Date.now(),
      status: "pending",
    };

    setMessages((prev) => trimHistory([...prev, userMsg, assistantPending]));
    setPending(true);

    try {
      const response = await sendChatMessage({
        symbol: context?.symbol ?? "",
        timeframe: context?.timeframe ?? "1d",
        question: text,
        context: context?.analysisCategory,
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: response.explanation, status: "ok" }
            : m
        )
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error desconocido.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: errorMsg, status: "error" }
            : m
        )
      );
    } finally {
      setPending(false);
    }
  }, [pending, selectedInstrument, analysisCategory, trimHistory]);

  const handleRetry = useCallback((messageId: string) => {
    const errorMsg = messages.find((m) => m.id === messageId);
    const preceding = messages.slice().reverse().find((m: ChatMessage) => m.role === "user");
    if (preceding) {
      void handleSend(preceding.content);
    } else if (errorMsg) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
  }, [messages, handleSend]);

  return (
    <div
      data-testid="chat-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          padding: "0 var(--space-sm)",
          height: "var(--nav-height)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--color-border)",
          gap: "var(--space-sm)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
          <MessageSquare size={16} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
          <span style={{ fontWeight: "var(--font-weight-emphasis)", fontSize: "var(--font-size-sm)", color: "var(--color-text)", whiteSpace: "nowrap" }}>
            Chat IA
          </span>
        </div>
        <ChatContextBadge />
      </div>

      {/* Message list */}
      <ChatMessageList messages={messages} onRetry={handleRetry} />

      {/* Input */}
      <ChatInputBar onSend={(text) => void handleSend(text)} pending={pending} />
    </div>
  );
}
