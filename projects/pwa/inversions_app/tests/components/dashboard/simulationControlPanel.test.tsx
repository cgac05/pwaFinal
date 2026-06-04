// FIC: Tests T103 — SimulationControlPanel: render + click EJECUTAR llama onResult.

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SimulationControlPanel } from "../../../src/features/dashboard/simulation/SimulationControlPanel";

vi.mock("../../../src/services/signals/confluenceTableApi", async () => {
  const actual = await vi.importActual<any>("../../../src/services/signals/confluenceTableApi");
  return {
    ...actual,
    runSimulation: vi.fn(async () => ({
      verdict: { verdict: "alcista", score: 0.5, degraded: false },
      table: [],
      inputs_echo: {},
      computed_at: new Date().toISOString(),
      algorithm_version: "1.0.0"
    }))
  };
});

describe("SimulationControlPanel", () => {
  it("renders the canonical inputs from PDF v1", () => {
    render(<SimulationControlPanel ticket="AAPL" onResult={() => {}} />);
    expect(screen.getByText(/Rango Hist[oó]rico/i)).toBeTruthy();
    expect(screen.getByText(/Temporalidad/i)).toBeTruthy();
    expect(screen.getByText(/^Estrategia$/i)).toBeTruthy();
    expect(screen.getByText(/Tolerancia al Riesgo/i)).toBeTruthy();
    // FIC: Phase 8 — optional historical as-of date field. (EN)
    expect(screen.getByText(/Fecha Hist[oó]rica/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Ejecutar/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Limpiar panel/i })).toBeTruthy();
  });

  it("starts with the A_INDICADORES core disabled by default (Phase 8)", () => {
    render(<SimulationControlPanel ticket="AAPL" onResult={() => {}} />);
    // The A_INDICADORES core chip renders with the Spanish label "Indicadores".
    const indicadoresChip = screen.getByRole("button", { name: "Indicadores" });
    expect(indicadoresChip.getAttribute("aria-pressed")).toBe("false");
  });

  it("calls onResult after clicking Ejecutar Simulacion", async () => {
    const onResult = vi.fn();
    render(<SimulationControlPanel ticket="AAPL" onResult={onResult} />);
    const btn = screen.getByRole("button", { name: /Ejecutar/i });
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(onResult).toHaveBeenCalled();
  });
});
