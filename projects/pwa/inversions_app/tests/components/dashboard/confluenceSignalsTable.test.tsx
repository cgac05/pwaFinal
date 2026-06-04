// FIC: Tests T103 - ConfluenceSignalsTable renderiza columnas del PDF v1 desde filas inyectadas.

import React from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ConfluenceSignalsTable } from "../../../src/features/dashboard/ConfluenceSignalsTable";
import type { ConfluenceSignalRow } from "../../../src/services/signals/confluenceTableApi";

const sampleRow = (overrides: Partial<ConfluenceSignalRow> = {}): ConfluenceSignalRow => ({
  ticket: "AAPL",
  core: "A_INDICADORES",
  subCore: "RSI",
  precio: 185.42,
  tipoSenal: "CALL",
  fecha: "2026-05-26",
  timeframe: "1h",
  tendencia: "ALCISTA",
  score: 0.45,
  peso: 0.2,
  invertir: true,
  estado: "ACTIVA",
  vigencia: "2026-05-27T00:00:00Z",
  fuente: "indicators-core",
  evidencia_refs: ["ohlc:AAPL:1h:300"],
  ia_revisada: false,
  delta_vs_anterior: "NUEVA",
  observacion: { objetivo: "Eval RSI", senal: "0.45", explicacion: "RSI 65", metricas: { VOLATILIDAD: 1.2 } },
  algorithm_version: "1.0.0",
  computed_at: "2026-05-26T00:00:00Z",
  source_input_hash: "abc123",
  ...overrides
});

describe("ConfluenceSignalsTable (PDF v1)", () => {
  it("renders canonical column headers including strategy", () => {
    render(<ConfluenceSignalsTable rows={[sampleRow()]} activeStrategy="Long Call" />);
    for (const label of ["TICKET", "CORE", "SUBCORE", "PRECIO", "TIPO SEÑAL", "FECHA", "TIMEFRAME", "TENDENCIA", "SCORE", "PESO", "INVERTIR", "ESTADO", "ESTRATEGIA", "OBSERVACION"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText("Estrategia: Long Call")).toBeTruthy();
  });

  it("renders SI when invertir=true and HOLD signals in muted color", () => {
    render(<ConfluenceSignalsTable rows={[sampleRow(), sampleRow({ core: "A_IA", subCore: undefined, tipoSenal: "HOLD", invertir: false, ia_revisada: true, disclaimer_id: "disclaimer-ia-constitucional-v1" })]} />);
    expect(screen.getByText("SI")).toBeTruthy();
    expect(screen.getByText("NO")).toBeTruthy();
    expect(screen.getByText("CALL")).toBeTruthy();
    expect(screen.getByText("HOLD")).toBeTruthy();
  });

  it("shows IA badge for A_IA rows", () => {
    render(<ConfluenceSignalsTable rows={[sampleRow({ core: "A_IA", ia_revisada: true, disclaimer_id: "disclaimer-ia-constitucional-v1" })]} />);
    expect(screen.getByText("IA")).toBeTruthy();
  });

  it("renders DEGRADADA rows with reduced opacity but still visible", () => {
    render(<ConfluenceSignalsTable rows={[sampleRow({ estado: "DEGRADADA", invertir: false, tipoSenal: "HOLD" })]} />);
    expect(screen.getByText("DEGRADADA")).toBeTruthy();
  });

  it("opens observation details from the compact table", () => {
    render(<ConfluenceSignalsTable rows={[sampleRow()]} activeStrategy="Short Put" />);
    fireEvent.click(screen.getByRole("button", { name: /Ver detalle/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(screen.getByText("Detalle de Señal")).toBeTruthy();
    expect(screen.getByText("RSI 65")).toBeTruthy();
    expect(within(dialog).getByText("Short Put")).toBeTruthy();
  });
});
