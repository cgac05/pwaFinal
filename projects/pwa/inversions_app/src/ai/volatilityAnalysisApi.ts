import { getAuthHeaders } from "../signals/signalApi";

export interface MockInstrument {
  id: string;
  ticker: string;
  classification: string;
  mediaPlan: string;
  updates: string;
}

export interface MockPrompt {
  id: string;
  basePrompt: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface VolatilityScoreSnapshot {
  financial: number | null;
  technical: number | null;
  news: number | null;
  options: number | null;
  weighted: number | null;
  completeness: number;
}

export interface MockResult {
  id: string;
  ticker: string;
  decision: 'SÍ' | 'NO';
  justification: string;
  date: string;
  scores: string;
  chatHistory: ChatMessage[];
  analysisSummary?: string;
  recommendedStrategy?: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  popEstimate?: number;
  confidence?: number;
  warnings?: string[];
  scoreSnapshot?: VolatilityScoreSnapshot;
  analysisSource?: 'gemini' | 'fallback';
}

const BASE_URL = '/api/ai/volatility';

export async function fetchPrompts(): Promise<MockPrompt> {
  const res = await fetch(`${BASE_URL}/prompts`, {
    headers: { ...getAuthHeaders() }
  });
  if (!res.ok) throw new Error('Error al cargar prompt base');
  const body = await res.json();
  return body.data;
}

export async function updatePrompt(id: string, basePrompt: string): Promise<MockPrompt> {
  const res = await fetch(`${BASE_URL}/prompts/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ basePrompt })
  });
  if (!res.ok) throw new Error('Error al actualizar prompt base');
  const body = await res.json();
  return body.data;
}

export async function fetchResults(): Promise<MockResult[]> {
  const res = await fetch(`${BASE_URL}/results`, {
    headers: { ...getAuthHeaders() }
  });
  if (!res.ok) throw new Error('Error al cargar historial de análisis');
  const body = await res.json();
  return body.data;
}

export async function fetchInstruments(): Promise<MockInstrument[]> {
  const res = await fetch(`${BASE_URL}/instruments`, {
    headers: { ...getAuthHeaders() }
  });
  if (!res.ok) throw new Error('Error al cargar catálogo de instrumentos');
  const body = await res.json();
  return body.data;
}

export async function runAnalysis(ticker: string, scores: string): Promise<MockResult> {
  const res = await fetch(`${BASE_URL}/analyze-scores`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ ticker, scores })
  });
  if (!res.ok) throw new Error('Error al ejecutar análisis de volatilidad');
  const body = await res.json();
  return body.data;
}

export async function sendFollowUpChat(resultId: string, message: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/results/${resultId}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ message })
  });
  if (!res.ok) throw new Error('Error al enviar mensaje de seguimiento');
  const body = await res.json();
  return body.data;
}

export async function sendGlobalChat(message: string, model: 'primary' | 'fallback'): Promise<{ text: string; model: string }> {
  const res = await fetch(`${BASE_URL}/global-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ message, model })
  });
  if (!res.ok) throw new Error('Error al enviar mensaje al chat global');
  const body = await res.json();
  return body.data;
}
