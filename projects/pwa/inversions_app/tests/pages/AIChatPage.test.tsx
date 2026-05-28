import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AIChatPage } from "../../src/pages/ai/AIChatPage";
import { fetchResults, sendGlobalChat } from "../../src/services/ai/volatilityAnalysisApi";

// Mock the volatility analysis API calls
vi.mock("../../src/services/ai/volatilityAnalysisApi", () => ({
  fetchResults: vi.fn(),
  sendGlobalChat: vi.fn()
}));

const mockedFetchResults = vi.mocked(fetchResults);
const mockedSendGlobalChat = vi.mocked(sendGlobalChat);

const mockResultsData = [
  {
    id: "result-1",
    ticker: "SPY",
    date: new Date().toISOString(),
    scores: "Técnico: 85\nOpciones: 78\nMacro: 90",
    decision: "SÍ",
    justification: "Volatilidad ideal para cobro de prima en rangos.",
    chatHistory: []
  },
  {
    id: "result-2",
    ticker: "AAPL",
    date: new Date().toISOString(),
    scores: "Técnico: 40\nOpciones: 45\nMacro: 50",
    decision: "NO",
    justification: "Riesgo direccional elevado por noticias.",
    chatHistory: []
  }
];

beforeEach(() => {
  mockedFetchResults.mockReset();
  mockedSendGlobalChat.mockReset();
  mockedFetchResults.mockResolvedValue(mockResultsData);
});

describe("AIChatPage", () => {
  it("renders heading, sidebar and chat inputs correctly", async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <AIChatPage />
        </MemoryRouter>
      );
    });

    // Verify premium heading exists
    expect(screen.getByText(/Chat IA — Auditoría Cuantitativa/i)).toBeTruthy();
    
    // Verify sidebar elements are present
    expect(screen.getByText("Reportes de Volatilidad")).toBeTruthy();
    expect(await screen.findByText("SPY")).toBeTruthy();
    expect(screen.getByText("AAPL")).toBeTruthy();

    // Verify selector and input controls exist
    expect(screen.getByText("Gemma 4 31B (Primario)")).toBeTruthy();
    expect(screen.getByPlaceholderText(/Ej:/)).toBeTruthy();
    expect(screen.getByText("Enviar")).toBeTruthy();
  });

  it("handles sending questions and renders conversational replies", async () => {
    // Delay resolution slightly to allow checking the pending state before the response is typed out
    mockedSendGlobalChat.mockImplementation(() => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            text: "La viabilidad de SPY es afirmativa debido al score de confluencia superior a 80.",
            model: "Gemma 4 31B"
          });
        }, 50);
      });
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <AIChatPage />
        </MemoryRouter>
      );
    });

    const textarea = screen.getByPlaceholderText(/Ej:/);
    const sendButton = screen.getByText("Enviar");

    await act(async () => {
      fireEvent.change(textarea, { target: { value: "¿Por qué es viable SPY?" } });
      fireEvent.click(sendButton);
    });

    // Expect the sendGlobalChat method to be invoked with the question and the selected model
    expect(mockedSendGlobalChat).toHaveBeenCalledWith("¿Por qué es viable SPY?", "primary");
    
    // Expect the temporary typing message to appear while the promise is pending
    expect(screen.getByText(/Analizando reportes y formulando veredicto/i)).toBeTruthy();

    // Wait for the typewriter effect to complete
    await screen.findByText(/La viabilidad de SPY es afirmativa/i, {}, { timeout: 3000 });
  });

  it("switches to the fallback model and sends request with proper model key", async () => {
    mockedSendGlobalChat.mockResolvedValue({
      text: "Respuesta usando el modelo de respaldo de baja latencia.",
      model: "Gemma 4 26B Fallback"
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <AIChatPage />
        </MemoryRouter>
      );
    });

    // Select the fallback model from the dropdown
    const select = screen.getByRole("combobox");
    await act(async () => {
      fireEvent.change(select, { target: { value: "fallback" } });
    });

    const textarea = screen.getByPlaceholderText(/Ej:/);
    const sendButton = screen.getByText("Enviar");

    await act(async () => {
      fireEvent.change(textarea, { target: { value: "¿Cuáles son los riesgos?" } });
      fireEvent.click(sendButton);
    });

    expect(mockedSendGlobalChat).toHaveBeenCalledWith("¿Cuáles son los riesgos?", "fallback");
    await screen.findByText(/Respuesta usando el modelo de respaldo/i, {}, { timeout: 3000 });
  });
});