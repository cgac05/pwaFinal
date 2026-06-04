// FIC: WatchlistView unit tests — search input, loading state, empty state rendering.
// FIC: Tests unitarios de WatchlistView — campo de búsqueda, estado de carga, renderizado de estado vacío.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WatchlistView } from "./WatchlistView";

vi.mock("../../../store/signals", () => ({
  useSignalStore: () => ({ setSelectedInstrument: vi.fn(), selectedInstrument: undefined }),
}));

vi.mock("../../../services/signals/marketApi", () => ({
  useWatchlistPrices: () => ({}),
}));

vi.mock("../../../services/signals/signalApi", () => ({
  getAuthHeaders: () => ({}),
}));

vi.mock("../../../hooks/useAnimatedValue", () => ({
  useAnimatedValue: (val: number) => val,
}));

globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ items: [] }),
} as Response);

describe("WatchlistView", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("renderiza el campo de búsqueda/agregar tras cargar", async () => {
    render(<WatchlistView />);
    const input = await screen.findByPlaceholderText(/buscar o agregar/i);
    expect(input).toBeDefined();
  });

  it("muestra estado de carga inicial antes de que resuelva el fetch", () => {
    // FIC: Fetch stays pending — loading indicator should render immediately.
    // FIC: Fetch queda pendiente — el indicador de carga debe renderizarse de inmediato.
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<WatchlistView />);
    expect(screen.getByText(/cargando/i)).toBeDefined();
  });

  it("muestra estado vacío cuando el watchlist está vacío", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    } as Response);
    render(<WatchlistView />);
    // Wait for loading to resolve
    await screen.findByText(/watchlist está vacío/i);
  });
});
