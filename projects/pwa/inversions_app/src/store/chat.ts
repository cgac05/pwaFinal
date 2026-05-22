import { useSyncExternalStore } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  status?: "pending" | "processing" | "completed" | "error";
  responseId?: string;
  pollingAttempts?: number;
}

export interface ChatStoreState {
  ticker: string | null;
  history: ChatMessage[];
  scenarios: any[];
  isAiUnavailable: boolean;
}

type Listener = () => void;

const listeners = new Set<Listener>();

const initialState: ChatStoreState = {
  ticker: null,
  history: [],
  scenarios: [],
  isAiUnavailable: false,
};

let state: ChatStoreState = { ...initialState };

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ChatStoreState {
  return state;
}

export function useChatStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    ...snapshot,
    setContext: (context: { ticker?: string | null; scenarios?: any[] }) => {
      let updated = false;
      if (context.ticker !== undefined) {
        state.ticker = context.ticker;
        updated = true;
      }
      if (context.scenarios !== undefined) {
        state.scenarios = context.scenarios;
        updated = true;
      }
      if (updated) emit();
    },
    addMessage: (message: ChatMessage) => {
      state.history = [...state.history, message];
      emit();
    },
    updateMessage: (
      id: string,
      updates: Partial<Pick<ChatMessage, "content" | "status" | "responseId" | "pollingAttempts">>
    ) => {
      state.history = state.history.map((message) => {
        if (message.id !== id) {
          return message;
        }

        return { ...message, ...updates };
      });
      emit();
    },
    updateMessageStatus: (id: string, status: ChatMessage["status"], responseId?: string) => {
      state.history = state.history.map(msg => {
        if (msg.id === id) {
          return { ...msg, status, ...(responseId ? { responseId } : {}) };
        }
        return msg;
      });
      emit();
    },
    incrementPolling: (id: string) => {
      state.history = state.history.map(msg => 
        msg.id === id 
          ? { ...msg, pollingAttempts: (msg.pollingAttempts || 0) + 1 } 
          : msg
      );
      emit();
    },
    setAiUnavailable: (unavailable: boolean) => {
      state.isAiUnavailable = unavailable;
      emit();
    },
    clearHistory: () => {
      state.history = [];
      emit();
    }
  };
}

export function resetChatStore() {
  state = { ...initialState };
  emit();
}