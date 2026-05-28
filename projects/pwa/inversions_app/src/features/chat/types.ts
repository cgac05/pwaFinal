// FIC: Chat domain types — ChatMessage, ChatContext, ChatStatus for the AI chat panel.
// FIC: Tipos del dominio de chat — ChatMessage, ChatContext, ChatStatus para el panel de chat IA.

export type ChatRole = "user" | "assistant" | "system";
export type ChatStatus = "pending" | "ok" | "error";

export interface ChatContext {
  symbol: string;
  timeframe: string;
  analysisCategory: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  context: ChatContext | null;
  timestamp: number;
  status: ChatStatus;
}
