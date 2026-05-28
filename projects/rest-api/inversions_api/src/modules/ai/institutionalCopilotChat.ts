// FIC: Institutional AI copilot — async Gemini 2.5 Flash integration with polling and traceability. (EN)
// FIC: Copiloto IA institucional — integración asíncrona con Gemini 2.5 Flash, polling y trazabilidad. (ES)

import { createHash } from "node:crypto";
import type { InstitutionalZone } from "../institutional/institutionalZonesEngine";
import type { InstitutionalTrendResult } from "../institutional/institutionalTrendEngine";
import type { ExpirationAnalysisResult } from "../institutional/expirationAnalysisEngine";

// ─── Constants ────────────────────────────────────────────────────────────────

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const MODEL_VERSION = "gemini-2.5-flash";

const TIMEOUT_MS = 30_000;
const INITIAL_DECISION_WINDOW_MS = 5_000;
const POLLING_INTERVAL_MS = 2_000;
const MAX_POLLING_ATTEMPTS = 15;
const JOB_TTL_MS = 30_000;

// ─── Input types ──────────────────────────────────────────────────────────────

// FIC: Context object required to submit a copilot chat request. (EN)
// FIC: Objeto de contexto requerido para enviar una solicitud al copiloto. (ES)
export interface CopilotChatContext {
  ticker: string;
  currentPrice: number;
  zones: InstitutionalZone[];
  trends?: InstitutionalTrendResult;
  expiration?: ExpirationAnalysisResult;
  question: string;
  userRole?: string;
  /** Optional pre-assigned context ID; generated if omitted. */
  contextId?: string;
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface ScenarioAnalysisItem {
  label: string;
  description: string;
  protectionLevel: string;
  potentialPnL: string;
}

// FIC: Full copilot response with dual snake_case + camelCase fields. (EN)
// FIC: Respuesta completa del copiloto con campos duales snake_case + camelCase. (ES)
export interface CopilotChatResponse {
  narrative: string;
  reasoning: string;
  recommendation: string;
  // snake_case fields
  scenario_analysis: ScenarioAnalysisItem[];
  evidence_ids: string[];
  model_version: string;
  response_hash: string;
  context_id: string;
  response_id: string;
  timestamp: string;
  ai_unavailable?: boolean;
  // camelCase aliases
  scenarioAnalysis: ScenarioAnalysisItem[];
  evidenceIds: string[];
  modelVersion: string;
  responseHash: string;
  contextId: string;
  responseId: string;
}

// FIC: Result when Gemini responds within the 5-second decision window. (EN)
// FIC: Resultado cuando Gemini responde dentro de la ventana de decisión de 5 segundos. (ES)
export interface DirectSubmitResult {
  status: "completed";
  response: CopilotChatResponse;
}

// FIC: Result when Gemini exceeds the 5-second window — client must poll. (EN)
// FIC: Resultado cuando Gemini supera la ventana de 5 segundos — el cliente debe hacer polling. (ES)
export interface PendingSubmitResult {
  status: "pending";
  contextId: string;
  responseId: string;
  pollingUrl: string;
  retryAfterSeconds: number;
}

export type SubmitResult = DirectSubmitResult | PendingSubmitResult;

// FIC: Result of a poll() call for an async copilot job. (EN)
// FIC: Resultado de una llamada poll() para un trabajo asíncrono del copiloto. (ES)
export interface PollResult {
  status: "pending" | "completed" | "error";
  response?: CopilotChatResponse;
  ai_unavailable?: boolean;
}

// ─── Internal job store types ─────────────────────────────────────────────────

interface PendingJob {
  status: "pending" | "completed" | "error";
  contextId: string;
  responseId: string;
  result?: CopilotChatResponse;
  ai_unavailable?: boolean;
  createdAt: number;
}

// ─── Gemini raw response shape ────────────────────────────────────────────────

interface GeminiParsedContent {
  narrative?: string;
  reasoning?: string;
  scenarioAnalysis?: ScenarioAnalysisItem[];
  recommendation?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// FIC: Map user role to copilot AI role: admin/trader → analyst, others → risk_manager. (EN)
// FIC: Mapea el rol del usuario al rol IA del copiloto: admin/trader → analyst, otros → risk_manager. (ES)
export function inferAIRole(role?: string): "analyst" | "risk_manager" {
  if (role === "admin" || role === "trader") return "analyst";
  return "risk_manager";
}

function computeHash(data: unknown): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

// FIC: Evict jobs that have exceeded their TTL to prevent unbounded memory growth. (EN)
// FIC: Elimina jobs que han superado su TTL para evitar crecimiento ilimitado de memoria. (ES)
function evictExpiredJobs(jobs: Map<string, PendingJob>): void {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) {
      jobs.delete(id);
    }
  }
}

// FIC: Build evidence IDs from zones for traceability. (EN)
// FIC: Construye IDs de evidencia desde las zonas para trazabilidad. (ES)
function buildEvidenceIds(zones: InstitutionalZone[], ticker: string): string[] {
  return zones.slice(0, 5).map(
    (z, i) => `${ticker}:${z.type}:${z.price.toFixed(2)}:idx${i}`
  );
}

// FIC: Construct the Gemini prompt from the copilot context. (EN)
// FIC: Construye el prompt de Gemini a partir del contexto del copiloto. (ES)
function buildPrompt(context: CopilotChatContext, aiRole: "analyst" | "risk_manager"): string {
  const { ticker, currentPrice, zones, trends, expiration, question } = context;

  const supportZones = zones.filter((z) => z.type === "support").slice(0, 3);
  const resistanceZones = zones.filter((z) => z.type === "resistance").slice(0, 3);

  const zonesText = [
    ...supportZones.map((z) => `  Support: $${z.price.toFixed(2)} (strength=${z.strength.toFixed(2)}, confidence=${z.confidence.toFixed(2)})`),
    ...resistanceZones.map((z) => `  Resistance: $${z.price.toFixed(2)} (strength=${z.strength.toFixed(2)}, confidence=${z.confidence.toFixed(2)})`),
  ].join("\n");

  const trendsText = trends
    ? `Direction: ${trends.direction}, SMA50: ${trends.sma50.toFixed(2)}, SMA200: ${trends.sma200.toFixed(2)}, ` +
      `Crossover: ${trends.crossover ? `${trends.crossover.type} (${trends.crossover.daysAgo}d ago)` : "none"}, ` +
      `Strength: ${trends.trendStrength.toFixed(2)}, Continuity: ${trends.continuityProbability.toFixed(2)}`
    : "Not available";

  const expirationText = expiration
    ? `Next OpEx in ${expiration.daysToNextOpex}d, regime: ${expiration.currentRegime}, bias: ${expiration.expiryBias}, skew: ${expiration.callPutSkew}`
    : "Not available";

  const roleInstruction =
    aiRole === "analyst"
      ? "You are an institutional equity analyst. Provide detailed quantitative analysis with specific price targets."
      : "You are a risk manager. Focus on downside protection, risk metrics, and capital preservation.";

  return `${roleInstruction}

You are analyzing ${ticker} at current price $${currentPrice.toFixed(2)}.

INSTITUTIONAL ZONES:
${zonesText || "  No zones available"}

TREND ANALYSIS:
  ${trendsText}

EXPIRATION CONTEXT:
  ${expirationText}

USER QUESTION: ${question}

IMPORTANT CONSTRAINTS:
- This is a read-only analysis system. Never suggest executing trades directly.
- Base your analysis on the institutional data provided above.
- Be specific about price levels from the zones data.

Respond with a JSON object matching this exact schema:
{
  "narrative": "Comprehensive market narrative for the ticker based on institutional data (2-4 sentences)",
  "reasoning": "Step-by-step analytical reasoning (3-5 sentences)",
  "scenarioAnalysis": [
    {
      "label": "Bullish scenario",
      "description": "Specific scenario description with price levels",
      "protectionLevel": "high|medium|low",
      "potentialPnL": "+X% or -X% range"
    },
    {
      "label": "Bearish scenario",
      "description": "Specific scenario description with price levels",
      "protectionLevel": "high|medium|low",
      "potentialPnL": "-X% or +X% range"
    },
    {
      "label": "Neutral scenario",
      "description": "Consolidation or range-bound scenario",
      "protectionLevel": "medium",
      "potentialPnL": "±X% range"
    }
  ],
  "recommendation": "Actionable read-only recommendation (1-2 sentences)"
}`;
}

// FIC: Parse and normalize the raw Gemini response text into a typed structure. (EN)
// FIC: Parsea y normaliza el texto bruto de Gemini en una estructura tipada. (ES)
function parseGeminiContent(rawText: string): GeminiParsedContent {
  try {
    return JSON.parse(rawText) as GeminiParsedContent;
  } catch {
    return {
      narrative: rawText.slice(0, 500),
      reasoning: "Response could not be parsed as structured JSON.",
      scenarioAnalysis: [],
      recommendation: "Please consult raw narrative above.",
    };
  }
}

// FIC: Build the final CopilotChatResponse from parsed Gemini content. (EN)
// FIC: Construye la respuesta final CopilotChatResponse a partir del contenido parseado. (ES)
function buildResponse(
  parsed: GeminiParsedContent,
  contextId: string,
  responseId: string,
  context: CopilotChatContext
): CopilotChatResponse {
  const narrative = parsed.narrative ?? "";
  const reasoning = parsed.reasoning ?? "";
  const recommendation = parsed.recommendation ?? "";
  const scenarioAnalysis = Array.isArray(parsed.scenarioAnalysis) ? parsed.scenarioAnalysis : [];
  const evidenceIds = buildEvidenceIds(context.zones, context.ticker);
  const timestamp = new Date().toISOString();
  const responseHash = computeHash({ narrative, reasoning, recommendation, contextId, responseId, timestamp });

  return {
    narrative,
    reasoning,
    recommendation,
    // snake_case
    scenario_analysis: scenarioAnalysis,
    evidence_ids: evidenceIds,
    model_version: MODEL_VERSION,
    response_hash: responseHash,
    context_id: contextId,
    response_id: responseId,
    timestamp,
    // camelCase aliases
    scenarioAnalysis,
    evidenceIds,
    modelVersion: MODEL_VERSION,
    responseHash,
    contextId,
    responseId,
  };
}

// ─── Main class ───────────────────────────────────────────────────────────────

// FIC: InstitutionalCopilotChat — read-only AI assistant for institutional analysis. (EN)
// FIC: InstitutionalCopilotChat — asistente IA de solo lectura para análisis institucional. (ES)
export class InstitutionalCopilotChat {
  // FIC: In-memory job store for async polling — keyed by responseId. (EN)
  // FIC: Almacén de jobs en memoria para polling asíncrono — indexado por responseId. (ES)
  private readonly jobs = new Map<string, PendingJob>();

  // FIC: Submit a copilot chat context. Returns direct result if Gemini responds within 5s,
  //      otherwise returns pending result with a pollingUrl. (EN)
  // FIC: Envía un contexto al copiloto. Retorna resultado directo si Gemini responde en ≤5s,
  //      de lo contrario retorna resultado pendiente con pollingUrl. (ES)
  async submit(context: CopilotChatContext): Promise<SubmitResult> {
    evictExpiredJobs(this.jobs);

    const contextId = context.contextId ?? crypto.randomUUID();
    const responseId = crypto.randomUUID();

    const geminiPromise = this.callGemini(context, contextId, responseId);

    const decisionTimer = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), INITIAL_DECISION_WINDOW_MS);
    });

    const raceResult = await Promise.race([geminiPromise, decisionTimer]);

    if (raceResult !== null) {
      // Gemini responded within the 5-second window
      return { status: "completed", response: raceResult };
    }

    // 5-second window expired — store pending job, return 202 info
    const job: PendingJob = {
      status: "pending",
      contextId,
      responseId,
      createdAt: Date.now(),
    };
    this.jobs.set(responseId, job);

    // Continue Gemini call in background and update job on completion
    geminiPromise
      .then((result) => {
        const existing = this.jobs.get(responseId);
        if (!existing) return;
        if (result !== null) {
          existing.status = "completed";
          existing.result = result;
        } else {
          existing.status = "error";
          existing.ai_unavailable = true;
        }
      })
      .catch(() => {
        const existing = this.jobs.get(responseId);
        if (existing) {
          existing.status = "error";
          existing.ai_unavailable = true;
        }
      });

    return {
      status: "pending",
      contextId,
      responseId,
      pollingUrl: `/api/ai/institutional-chat/poll/${responseId}`,
      retryAfterSeconds: Math.ceil(POLLING_INTERVAL_MS / 1000),
    };
  }

  // FIC: Poll for the result of a previously submitted async job by responseId. (EN)
  // FIC: Consulta el resultado de un job asíncrono previamente enviado por responseId. (ES)
  poll(responseId: string): PollResult {
    evictExpiredJobs(this.jobs);

    const job = this.jobs.get(responseId);
    if (!job) {
      return { status: "error", ai_unavailable: false };
    }

    if (job.status === "pending") {
      return { status: "pending" };
    }

    if (job.status === "error") {
      return { status: "error", ai_unavailable: true };
    }

    return { status: "completed", response: job.result };
  }

  // FIC: Call Gemini 2.5 Flash with the built prompt; returns null if unavailable or timed out. (EN)
  // FIC: Llama a Gemini 2.5 Flash con el prompt construido; retorna null si no está disponible o supera el timeout. (ES)
  private async callGemini(
    context: CopilotChatContext,
    contextId: string,
    responseId: string
  ): Promise<CopilotChatResponse | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const aiRole = inferAIRole(context.userRole);
    const prompt = buildPrompt(context, aiRole);

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            topP: 0.9,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutHandle);

      if (!res.ok) return null;

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      const parsed = parseGeminiContent(rawText);
      return buildResponse(parsed, contextId, responseId, context);
    } catch {
      clearTimeout(timeoutHandle);
      return null;
    }
  }
}

// FIC: Exported constants for external consumers (e.g., route handlers). (EN)
// FIC: Constantes exportadas para consumidores externos (p. ej., handlers de rutas). (ES)
export const COPILOT_TIMEOUT_MS = TIMEOUT_MS;
export const COPILOT_POLLING_INTERVAL_MS = POLLING_INTERVAL_MS;
export const COPILOT_MAX_POLLING_ATTEMPTS = MAX_POLLING_ATTEMPTS;
export const COPILOT_JOB_TTL_MS = JOB_TTL_MS;
