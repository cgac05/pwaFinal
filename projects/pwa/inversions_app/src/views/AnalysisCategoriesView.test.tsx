// FIC: AnalysisCategoriesView tests — 5 chips, active state, dispatch, persistence on re-mount.
// FIC: Tests de AnalysisCategoriesView — 5 chips, estado activo, dispatch, persistencia al re-montar.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

let mockCategory = "technical";
const mockSetCategory = vi.fn((cat: string) => { mockCategory = cat; });

vi.mock("../../../store/appShell", () => ({
  useAppShellStore: () => ({
    analysisCategory: mockCategory,
    setAnalysisCategory: mockSetCategory,
  }),
}));

describe("AnalysisCategoriesView", () => {
  beforeEach(() => {
    mockCategory = "technical";
    vi.clearAllMocks();
  });

  it("renderiza los 5 chips con labels correctos", async () => {
    const { AnalysisCategoriesView } = await import("./AnalysisCategoriesView");
    render(<AnalysisCategoriesView />);
    expect(screen.getByText("Técnico")).toBeDefined();
    expect(screen.getByText("Institucional")).toBeDefined();
    expect(screen.getByText("Fundamental")).toBeDefined();
    expect(screen.getByText("Noticias")).toBeDefined();
    expect(screen.getByText("IA")).toBeDefined();
  });

  it("clic en chip llama setAnalysisCategory con el ID correcto", async () => {
    const { AnalysisCategoriesView } = await import("./AnalysisCategoriesView");
    render(<AnalysisCategoriesView />);
    fireEvent.click(screen.getByText("Noticias"));
    expect(mockSetCategory).toHaveBeenCalledWith("news");
  });

  it("chip 'Técnico' tiene aria-pressed=true por defecto", async () => {
    const { AnalysisCategoriesView } = await import("./AnalysisCategoriesView");
    render(<AnalysisCategoriesView />);
    const btn = screen.getByText("Técnico").closest("button");
    expect(btn?.getAttribute("aria-pressed")).toBe("true");
  });

  it("solo un chip tiene aria-pressed=true a la vez", async () => {
    const { AnalysisCategoriesView } = await import("./AnalysisCategoriesView");
    render(<AnalysisCategoriesView />);
    const pressedButtons = screen.getAllByRole("button").filter(
      (b) => b.getAttribute("aria-pressed") === "true"
    );
    expect(pressedButtons.length).toBe(1);
  });

  it("chip activo se muestra correcto cuando analysisCategory es 'ai' al montar (US3 AS-4)", async () => {
    mockCategory = "ai";
    const { AnalysisCategoriesView } = await import("./AnalysisCategoriesView");
    render(<AnalysisCategoriesView />);
    const iaBtn = screen.getByText("IA").closest("button");
    expect(iaBtn?.getAttribute("aria-pressed")).toBe("true");
    const tecBtn = screen.getByText("Técnico").closest("button");
    expect(tecBtn?.getAttribute("aria-pressed")).toBe("false");
  });
});
