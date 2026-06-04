// FIC: ActivityBar unit tests — keyboard navigation, aria-labels, section toggle behavior.
// FIC: Tests unitarios de ActivityBar — navegación por teclado, aria-labels, comportamiento de toggle de sección.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActivityBar } from "./ActivityBar";

const mockSetActiveSection = vi.fn();

vi.mock("../../store/appShell", () => ({
  useAppShellStore: () => ({
    activeSection: "watchlist",
    leftPanelCollapsed: false,
    setActiveSection: mockSetActiveSection,
  }),
}));

describe("ActivityBar", () => {
  beforeEach(() => { mockSetActiveSection.mockClear(); });

  it("renderiza los 3 botones de navegación", () => {
    render(<ActivityBar />);
    expect(screen.getByRole("button", { name: "Watchlist" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Análisis" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Estrategias" })).toBeDefined();
  });

  it("cada botón tiene aria-label correcto", () => {
    render(<ActivityBar />);
    expect(screen.getByLabelText("Watchlist")).toBeDefined();
    expect(screen.getByLabelText("Análisis")).toBeDefined();
    expect(screen.getByLabelText("Estrategias")).toBeDefined();
  });

  it("clic en ícono inactivo llama setActiveSection con la sección correcta", () => {
    render(<ActivityBar />);
    fireEvent.click(screen.getByLabelText("Análisis"));
    expect(mockSetActiveSection).toHaveBeenCalledWith("analysis");
  });

  it("clic en ícono activo llama setActiveSection (toggle de colapso lo maneja el store)", () => {
    render(<ActivityBar />);
    fireEvent.click(screen.getByLabelText("Watchlist")); // already active
    expect(mockSetActiveSection).toHaveBeenCalledWith("watchlist");
  });

  it("Enter activa el botón de sección", () => {
    render(<ActivityBar />);
    fireEvent.keyDown(screen.getByLabelText("Estrategias"), { key: "Enter" });
    expect(mockSetActiveSection).toHaveBeenCalledWith("strategies");
  });

  it("Space activa el botón de sección", () => {
    render(<ActivityBar />);
    fireEvent.keyDown(screen.getByLabelText("Análisis"), { key: " " });
    expect(mockSetActiveSection).toHaveBeenCalledWith("analysis");
  });
});
