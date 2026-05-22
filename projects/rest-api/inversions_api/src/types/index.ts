/**
 * Agent Message Interfaces
 * Define the contract for communication between AI agents
 */

export type AgentRole = "analyzer" | "strategist" | "executor";

/**
 * Message sent to an AI agent
 */
export interface IAgentMessage {
  role: AgentRole;
  userPrompt: string;
  context?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Response from Gemini API with structured and raw output
 */
export interface IGeminiResponse {
  model: string;
  text: string;
  structured: unknown;
  raw: unknown;
  timestampUtc: string;
}

/**
 * Output from agent processing pipeline
 */
export interface IAgentOutput {
  agentRole: AgentRole;
  status: "success" | "error" | "partial";
  response: IGeminiResponse;
  analysis?: Record<string, unknown>;
  metadata?: {
    executionTimeMs?: number;
    retryAttempts?: number;
    fallbackUsed?: boolean;
  };
}

/**
 * Strategy assessment response from Gemini
 */
export interface IGeminiStrategyAssessmentResponse {
  markdown: string;
  strategies?: Array<{
    strategy_id?: string;
    name?: string;
    symbol?: string;
    viability?: "Alta" | "Media" | "Baja" | string;
    strengths?: string[];
    weaknesses?: string[];
    action?: string;
    justification?: string;
  }>;
  summary?: {
    operate?: number;
    pause?: number;
    discard?: number;
    bestRiskReward?: string;
    highestRisk?: string;
    observation?: string;
  };
}
