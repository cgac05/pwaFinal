// FIC: Chat API service — sends questions to POST /api/chat/explain with instrument context and 15s timeout.
// FIC: Servicio de API de chat — envía preguntas a POST /api/chat/explain con contexto del instrumento y timeout de 15s.

import { getAuthHeaders } from "../signals/signalApi";

export interface ChatRequest {
  symbol: string;
  timeframe: string;
  question: string;
  context?: string;
}

export interface ChatResponse {
  explanation: string;
  model?: string;
  cached?: boolean;
}

const TIMEOUT_MS = 15_000;

export async function sendChatMessage(req: ChatRequest): Promise<ChatResponse> {
  let signal: AbortSignal | undefined;
  try {
    signal = AbortSignal.timeout(TIMEOUT_MS);
  } catch {
    // FIC: AbortSignal.timeout not supported in all environments — proceed without timeout.
    // FIC: AbortSignal.timeout no soportado en todos los entornos — proceder sin timeout.
  }

  const res = await fetch("/api/chat/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(req),
    signal,
  }).catch((err: unknown) => {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error("El asistente tardó demasiado. Intenta de nuevo.");
    }
    throw new Error("Error de red. Verifica tu conexión.");
  });

  if (res.status === 400) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? "Solicitud inválida. Verifica símbolo y pregunta.");
  }
  if (res.status === 404) {
    throw new Error("No hay datos disponibles para este instrumento.");
  }
  if (res.status === 429) {
    throw new Error("Límite de consultas alcanzado. Intenta en 1 minuto.");
  }
  if (!res.ok) {
    throw new Error("El asistente no está disponible. Intenta de nuevo.");
  }

  return res.json() as Promise<ChatResponse>;
}
