export type SignalDirection = "BUY" | "SELL" | "HOLD";

export interface SourceVerdict {
  sourceId: string;
  verdict: SignalDirection;
  confidence: number;
  rationale: string;
}

export interface EvaluateSignalRequest {
  instrument: string;
  verdicts: SourceVerdict[];
}

export interface EvaluateSignalResponse {
  signalId: string;
  correlationId: string;
  instrument: string;
  signal: SignalDirection;
  confidence: number;
  confluenceScore: number;
  explainability: {
    summary: string;
    evidence: SourceVerdict[];
  };
}

export interface SignalDetailsResponse {
  signalId: string;
  summary: string;
  evidence: SourceVerdict[];
}

const API_BASE = "/api/signals";

function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const envToken = import.meta.env.VITE_DEV_BEARER_TOKEN as string | undefined;
  const storageToken =
    typeof window !== "undefined" ? window.localStorage.getItem("inversions.dev.token") ?? undefined : undefined;
  const token = envToken || storageToken;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export async function evaluateSignal(payload: EvaluateSignalRequest): Promise<EvaluateSignalResponse> {
  const response = await fetch(`${API_BASE}/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders()
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Error al evaluar senal: ${response.status}`);
  }

  return (await response.json()) as EvaluateSignalResponse;
}

export async function getSignalDetails(signalId: string): Promise<SignalDetailsResponse> {
  const response = await fetch(`${API_BASE}/${signalId}/details`, {
    headers: {
      ...buildAuthHeaders()
    }
  });

  if (!response.ok) {
    throw new Error(`Error al obtener detalle de senal: ${response.status}`);
  }

  return (await response.json()) as SignalDetailsResponse;
}
