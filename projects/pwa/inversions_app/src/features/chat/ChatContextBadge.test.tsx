// FIC: ChatContextBadge tests — shows symbol when instrument active, "Sin contexto" otherwise.
// FIC: Tests de ChatContextBadge — muestra símbolo cuando hay instrumento activo, "Sin contexto" si no.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatContextBadge } from "./ChatContextBadge";

// FIC: Mutable mock ref so each test can control the active instrument independently.
// FIC: Mock mutable para que cada test controle el instrumento activo de forma independiente.
let mockInstrument: { symbol: string; name?: string } | undefined = undefined;

vi.mock("../../store/signals", () => ({
  useSignalStore: () => ({ selectedInstrument: mockInstrument }),
}));

describe("ChatContextBadge", () => {
  beforeEach(() => {
    mockInstrument = undefined;
  });

  it("muestra 'Sin contexto' cuando no hay instrumento activo", () => {
    render(<ChatContextBadge />);
    expect(screen.getByTestId("chat-context-badge").textContent).toBe("Sin contexto");
  });

  it("muestra el símbolo del instrumento activo", () => {
    mockInstrument = { symbol: "AAPL", name: "Apple Inc." };
    render(<ChatContextBadge />);
    expect(screen.getByTestId("chat-context-badge").textContent).toBe("AAPL");
  });

  it("actualiza a 'Sin contexto' cuando symbol está vacío", () => {
    mockInstrument = { symbol: "" };
    render(<ChatContextBadge />);
    expect(screen.getByTestId("chat-context-badge").textContent).toBe("Sin contexto");
  });
});
