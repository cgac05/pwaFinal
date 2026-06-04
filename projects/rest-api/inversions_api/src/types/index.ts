export type AgentRole = "analyzer" | "strategist" | "executor";

export interface IAgentMessage {
  role: AgentRole;
  userPrompt: string;
  context?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface IGeminiResponse {
  model: string;
  text: string;
  structured: unknown;
  raw: unknown;
  timestampUtc: string;
}

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
