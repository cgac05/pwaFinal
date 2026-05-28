// FIC: ChatPanel tests — sessionStorage history, send flow, header render.
// FIC: Tests de ChatPanel — historial en sessionStorage, flujo de envío, renderizado del header.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ChatPanel } from "./ChatPanel";

vi.mock("../../store/signals", () => ({
  useSignalStore: () => ({ selectedInstrument: { symbol: "AAPL" } }),
}));

vi.mock("../../store/appShell", () => ({
  useAppShellStore: () => ({ analysisCategory: "technical" }),
}));

vi.mock("../../services/chat/chatApi", () => ({
  sendChatMessage: vi.fn().mockResolvedValue({ explanation: "Respuesta del asistente." }),
}));

const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, v: string) => { store[key] = v; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, "sessionStorage", { value: sessionStorageMock, writable: true });

describe("ChatPanel", () => {
  beforeEach(() => {
    sessionStorageMock.clear();
    vi.clearAllMocks();
  });

  it("renderiza el header con título 'Chat IA'", () => {
    render(<ChatPanel />);
    expect(screen.getByText("Chat IA")).toBeDefined();
  });

  it("historial vacío muestra placeholder", () => {
    render(<ChatPanel />);
    expect(screen.getByText(/haz una pregunta/i)).toBeDefined();
  });

  it("carga historial desde sessionStorage al montar", () => {
    const saved = JSON.stringify([{
      id: "1", role: "user", content: "Pregunta guardada", context: null, timestamp: Date.now(), status: "ok"
    }]);
    sessionStorageMock.setItem("inversions.chat.history", saved);
    render(<ChatPanel />);
    expect(screen.getByText("Pregunta guardada")).toBeDefined();
  });

  it("enviar mensaje llama sendChatMessage y actualiza la UI", async () => {
    const { sendChatMessage } = await import("../../services/chat/chatApi");
    render(<ChatPanel />);
    const textarea = screen.getByPlaceholderText(/escribe tu pregunta/i);
    fireEvent.change(textarea, { target: { value: "¿Sobrecomprado?" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    await waitFor(() => {
      expect(sendChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({ question: "¿Sobrecomprado?" })
      );
    });
  });

  it("guarda el historial en sessionStorage después de enviar", async () => {
    render(<ChatPanel />);
    const textarea = screen.getByPlaceholderText(/escribe tu pregunta/i);
    fireEvent.change(textarea, { target: { value: "Test" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    await waitFor(() => {
      const saved = sessionStorageMock.getItem("inversions.chat.history");
      expect(saved).not.toBeNull();
    });
  });
});
