import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AIChatPage } from "../../src/pages/ai/AIChatPage";
import { resetChatStore } from "../../src/store/chat";
import { resetSignalStore } from "../../src/store/signals";
import { getDashboardOrchestrator } from "../../src/services/signals/signalApi";
import type { DashboardOrchestratorResponse } from "../../src/services/signals/signalApi";

const mockedGetDashboardOrchestrator = vi.mocked(getDashboardOrchestrator);

vi.mock("../../src/services/signals/signalApi", () => ({
  getDashboardOrchestrator: vi.fn()
}));

const dashboardResponse: DashboardOrchestratorResponse = {
  timeframe: "1d",
  generatedAt: new Date().toISOString(),
  instruments: ["SPY", "AAPL"],
  cards: [
    {
      signalId: "spy-buy-1",
      instrument: "SPY",
      signal: "BUY",
      confidence: 0.88,
      confluenceScore: 82,
      riskLevel: "MEDIUM",
      activeCores: ["technical", "options", "flow"],
      updatedAt: new Date().toISOString(),
      evidence: [
        { sourceId: "tech-1", verdict: "BUY", confidence: 0.9, rationale: "Momentum aligned" }
      ],
      metadata: {
        timing_d: "ALTO",
        timing_h: "MEDIO",
        pre_senal: "confirmada",
        senal_real_activada: true,
        stop: 442.5,
        objetivo: 468,
        riesgo: "moderado",
        tipo_opcion: "put",
        precio_ejercicio: 445,
        vencimiento: "2026-06-21",
        stoploss_sugerido: 441.75
      }
    },
    {
      signalId: "aapl-sell-1",
      instrument: "AAPL",
      signal: "SELL",
      confidence: 0.74,
      confluenceScore: 67,
      riskLevel: "HIGH",
      activeCores: ["technical", "news"],
      updatedAt: new Date().toISOString(),
      evidence: [],
      metadata: {
        timing_d: "BAJO",
        timing_h: "BAJO",
        pre_senal: "débil",
        senal_real_activada: false,
        stop: 186,
        objetivo: 176,
        riesgo: "alto"
      }
    }
  ]
};

beforeEach(() => {
  resetChatStore();
  resetSignalStore();
  mockedGetDashboardOrchestrator.mockReset();
  mockedGetDashboardOrchestrator.mockResolvedValue(dashboardResponse);
});

describe("AIChatPage", () => {
  it("renders heading and chat input", () => {
    render(<AIChatPage />);

    expect(screen.getByText("Chat IA — Coberturas")).toBeTruthy();
    expect(screen.getByPlaceholderText(/Ej:/)).toBeTruthy();
    expect(screen.getByText("Enviar")).toBeTruthy();
  });

  it("answers with dashboard data", async () => {
    render(<AIChatPage />);

    fireEvent.change(screen.getByPlaceholderText(/Ej:/), { target: { value: "¿Qué ves en SPY?" } });
    fireEvent.click(screen.getByText("Enviar"));

    expect(await screen.findByText(/SPY muestra una señal BUY con 88% de confianza/i)).toBeTruthy();
    expect(screen.getByText(/El tablero resume 1 compra\(s\), 1 venta\(s\) y 0 neutral\(es\)/i)).toBeTruthy();
    expect(mockedGetDashboardOrchestrator).toHaveBeenCalledWith({
      instruments: "SPY",
      timeframe: "1d"
    });
  });

  it("changes the wording for coverage questions", async () => {
    render(<AIChatPage />);

    fireEvent.change(screen.getByPlaceholderText(/Ej:/), { target: { value: "¿Qué cobertura recomiendas para SPY?" } });
    fireEvent.click(screen.getByText("Enviar"));

    expect(await screen.findByText(/Para cobertura, el tablero destaca cobertura put/i)).toBeTruthy();
    expect(screen.getByText(/vencimiento 2026-06-21/i)).toBeTruthy();
  });

  it("keeps the answer explicit about being dashboard-based and stateless", async () => {
    render(<AIChatPage />);

    fireEvent.change(screen.getByPlaceholderText(/Ej:/), { target: { value: "Dame un resumen" } });
    fireEvent.click(screen.getByText("Enviar"));

    expect(await screen.findByText(/Este chat responde con el snapshot actual del dashboard/i)).toBeTruthy();
    expect(screen.getByText(/No uso memoria entre preguntas/i)).toBeTruthy();
  });
});