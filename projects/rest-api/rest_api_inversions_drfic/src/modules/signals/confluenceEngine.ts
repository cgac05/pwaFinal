import type { SourceConfig } from "./sourceConfig";

export type SignalDirection = "BUY" | "SELL" | "HOLD";

export interface SourceVerdict {
  sourceId: string;
  verdict: SignalDirection;
  confidence: number;
  rationale: string;
}

export interface ConfluenceResult {
  signal: SignalDirection;
  confidence: number;
  confluenceScore: number;
}

const verdictWeights: Record<SignalDirection, number> = {
  BUY: 1,
  HOLD: 0,
  SELL: -1
};

export function evaluateConfluence(sources: SourceConfig[], verdicts: SourceVerdict[]): ConfluenceResult {
  const activeWeights = new Map(sources.map((source) => [source.id, source.weight]));

  let weightedScore = 0;
  let totalWeight = 0;

  for (const verdict of verdicts) {
    const weight = activeWeights.get(verdict.sourceId) ?? 0;
    weightedScore += verdictWeights[verdict.verdict] * weight * verdict.confidence;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return { signal: "HOLD", confidence: 0, confluenceScore: 0 };
  }

  const normalized = weightedScore / totalWeight;
  const confidence = Math.min(1, Math.abs(normalized));
  const signal: SignalDirection = normalized > 0.15 ? "BUY" : normalized < -0.15 ? "SELL" : "HOLD";

  return {
    signal,
    confidence,
    confluenceScore: Math.round((normalized + 1) * 50)
  };
}
