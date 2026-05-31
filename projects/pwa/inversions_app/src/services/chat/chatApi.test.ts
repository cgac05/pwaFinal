// FIC: chatApi unit tests — happy path, 400/429/5xx error handling.
// FIC: Tests unitarios de chatApi — happy path, manejo de errores 400/429/5xx.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendChatMessage } from "./chatApi";

vi.mock("../signals/signalApi", () => ({
  getAuthHeaders: () => ({ Authorization: "Bearer test" }),
}));

const baseReq = { symbol: "AAPL", timeframe: "1d", question: "¿Tendencia?" };

function mockFetch(status: number, body: unknown) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as any);
}

describe("sendChatMessage", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("happy path devuelve explanation", async () => {
    mockFetch(200, { explanation: "RSI en 78, sobrecomprado." });
    const res = await sendChatMessage(baseReq);
    expect(res.explanation).toBe("RSI en 78, sobrecomprado.");
  });

  it("error 400 lanza error descriptivo", async () => {
    mockFetch(400, { message: "Símbolo inválido" });
    await expect(sendChatMessage(baseReq)).rejects.toThrow("Símbolo inválido");
  });

  it("error 400 sin body usa mensaje genérico", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => { throw new Error("no json"); },
    } as any);
    await expect(sendChatMessage(baseReq)).rejects.toThrow("Solicitud inválida");
  });

  it("error 429 lanza error de rate limit", async () => {
    mockFetch(429, {});
    await expect(sendChatMessage(baseReq)).rejects.toThrow("Límite de consultas");
  });

  it("error 5xx lanza error de servidor", async () => {
    mockFetch(503, {});
    await expect(sendChatMessage(baseReq)).rejects.toThrow("no está disponible");
  });

  it("error de red lanza error descriptivo", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("fetch failed"));
    await expect(sendChatMessage(baseReq)).rejects.toThrow("Error de red");
  });
});
