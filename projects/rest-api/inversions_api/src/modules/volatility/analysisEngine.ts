const SCORE_CATEGORY_KEYS = ["financial", "technical", "news", "options"] as const;

export type ScoreCategoryKey = (typeof SCORE_CATEGORY_KEYS)[number];
export type VolatilityDecision = "SÍ" | "NO";
export type VolatilityStrategySuggestion =
  | "IRON_CONDOR"
  | "LONG_STRADDLE"
  | "LONG_STRANGLE"
  | "WAIT";
export type VolatilityRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface ParsedScoreCategory {
  label: string;
  score: number | null;
  note: string;
  raw: string;
}

export interface ParsedScoreBlock {
  categories: Record<ScoreCategoryKey, ParsedScoreCategory>;
  weightedScore: number | null;
  completeness: number;
  missingCategories: ScoreCategoryKey[];
}

export interface VolatilityAssessment {
  ticker: string;
  decision: VolatilityDecision;
  recommendedStrategy: VolatilityStrategySuggestion;
  riskLevel: VolatilityRiskLevel;
  confidence: number;
  popEstimate: number;
  summary: string;
  warnings: string[];
  rationale: string;
  scoreBlock: ParsedScoreBlock;
  scoreSnapshot: {
    financial: number | null;
    technical: number | null;
    news: number | null;
    options: number | null;
    weighted: number | null;
    completeness: number;
  };
}

export interface GeminiDecisionParseResult {
  decision: VolatilityDecision | null;
  justification: string;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
  halfOpenSuccesses?: number;
}

export interface CircuitBreakerStatus {
  state: "closed" | "open" | "half-open";
  failureCount: number;
  lastFailureAt: number | null;
  nextRetryAt: number | null;
}

interface CircuitBreakerInternalState extends CircuitBreakerStatus {
  halfOpenSuccessCount: number;
}

const SCORE_WEIGHTS: Record<ScoreCategoryKey, number> = {
  financial: 0.25,
  technical: 0.35,
  news: 0.2,
  options: 0.2,
};

const CATEGORY_PATTERNS: Record<ScoreCategoryKey, RegExp> = {
  financial: /score\s+financiero|financial/i,
  technical: /score\s+t[eé]cnico|technical/i,
  news: /score\s+noticias|news/i,
  options: /score\s+opciones|options/i,
};

const CATEGORY_LABELS: Record<ScoreCategoryKey, string> = {
  financial: "Financiero",
  technical: "Técnico",
  news: "Noticias",
  options: "Opciones",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractFirstScoreLine(scoresText: string, key: ScoreCategoryKey): string {
  const lines = scoresText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const normalizedPattern = CATEGORY_PATTERNS[key];
  const found = lines.find((line) => normalizedPattern.test(line));
  return found ?? "";
}

function parseScoreLine(line: string): ParsedScoreCategory {
  const match = line.match(/^(.*?):\s*([0-9]{1,3})(?:\s*\/\s*100)?(?:\s*\((.*)\))?$/i);
  if (!match) {
    return {
      label: line ? normalizeWhitespace(line) : "",
      score: null,
      note: "",
      raw: line,
    };
  }

  const label = normalizeWhitespace(match[1] || "");
  const score = clamp(Number.parseInt(match[2], 10), 0, 100);
  const note = normalizeWhitespace(match[3] || "");

  return {
    label,
    score: Number.isNaN(score) ? null : score,
    note,
    raw: line,
  };
}

export function parseScoreBlock(scoresText: string): ParsedScoreBlock {
  const categories = SCORE_CATEGORY_KEYS.reduce((accumulator, key) => {
    const line = extractFirstScoreLine(scoresText, key);
    const parsed = parseScoreLine(line);

    accumulator[key] = {
      label: parsed.label || CATEGORY_LABELS[key],
      score: parsed.score,
      note: parsed.note,
      raw: parsed.raw,
    };

    return accumulator;
  }, {} as Record<ScoreCategoryKey, ParsedScoreCategory>);

  const weightedEntries = SCORE_CATEGORY_KEYS
    .map((key) => {
      const category = categories[key];
      if (category.score === null) {
        return null;
      }

      return {
        key,
        score: category.score,
        weight: SCORE_WEIGHTS[key],
      };
    })
    .filter((entry): entry is { key: ScoreCategoryKey; score: number; weight: number } => Boolean(entry));

  const totalWeight = weightedEntries.reduce((sum, entry) => sum + entry.weight, 0);
  const weightedScore =
    totalWeight > 0
      ? weightedEntries.reduce((sum, entry) => sum + entry.score * entry.weight, 0) / totalWeight
      : null;

  const missingCategories = SCORE_CATEGORY_KEYS.filter((key) => categories[key].score === null);
  const completeness = Number((1 - missingCategories.length / SCORE_CATEGORY_KEYS.length).toFixed(2));

  return {
    categories,
    weightedScore: weightedScore === null ? null : Number(weightedScore.toFixed(2)),
    completeness,
    missingCategories,
  };
}

function buildSummary(ticker: string, scoreBlock: ParsedScoreBlock, strategy: VolatilityStrategySuggestion): string {
  const technical = scoreBlock.categories.technical.score;
  const options = scoreBlock.categories.options.score;
  const news = scoreBlock.categories.news.score;

  const scoreText = scoreBlock.weightedScore === null ? "sin promedio suficiente" : `score ponderado ${scoreBlock.weightedScore.toFixed(2)}/100`;
  const technicalText = technical === null ? "técnico no disponible" : `técnico ${technical}/100`;
  const optionsText = options === null ? "opciones no disponible" : `opciones ${options}/100`;
  const newsText = news === null ? "noticias no disponible" : `noticias ${news}/100`;

  return `El ticker ${ticker} muestra ${scoreText} con lectura ${technicalText}, ${optionsText} y ${newsText}. La estrategia sugerida por la validación local es ${strategy.replace("_", " ").toLowerCase()}.`;
}

function calculateRiskLevel(scoreBlock: ParsedScoreBlock): VolatilityRiskLevel {
  const technical = scoreBlock.categories.technical.score ?? 50;
  const news = scoreBlock.categories.news.score ?? 50;
  const options = scoreBlock.categories.options.score ?? 50;
  const weighted = scoreBlock.weightedScore ?? 50;

  if (technical >= 78 || news >= 80 || weighted < 42) {
    return "HIGH";
  }

  if (options < 45 || weighted < 60 || scoreBlock.completeness < 1) {
    return "MEDIUM";
  }

  return "LOW";
}

function chooseStrategy(scoreBlock: ParsedScoreBlock): VolatilityStrategySuggestion {
  const technical = scoreBlock.categories.technical.score ?? 50;
  const news = scoreBlock.categories.news.score ?? 50;
  const options = scoreBlock.categories.options.score ?? 50;
  const weighted = scoreBlock.weightedScore ?? 50;

  if (technical >= 78 || news >= 80) {
    return "WAIT";
  }

  if (options >= 78 && technical <= 55 && news <= 60 && weighted >= 50) {
    return "IRON_CONDOR";
  }

  if (options >= 70 && technical >= 45 && technical <= 72 && news <= 70) {
    return "LONG_STRANGLE";
  }

  if (options >= 60 && technical <= 50 && news <= 55 && weighted >= 60) {
    return "LONG_STRADDLE";
  }

  return "WAIT";
}

function estimatePop(scoreBlock: ParsedScoreBlock, riskLevel: VolatilityRiskLevel): number {
  const weighted = scoreBlock.weightedScore ?? 50;
  const options = scoreBlock.categories.options.score ?? 50;
  const news = scoreBlock.categories.news.score ?? 50;
  const technical = scoreBlock.categories.technical.score ?? 50;

  const base = 38 + weighted * 0.33 + options * 0.12 - news * 0.08 - technical * 0.05;
  const riskPenalty = riskLevel === "HIGH" ? 14 : riskLevel === "MEDIUM" ? 6 : 0;
  return Math.round(clamp(base - riskPenalty, 10, 92));
}

function estimateConfidence(scoreBlock: ParsedScoreBlock, riskLevel: VolatilityRiskLevel): number {
  const weighted = scoreBlock.weightedScore ?? 50;
  const completenessBoost = scoreBlock.completeness * 0.08;
  const riskPenalty = riskLevel === "HIGH" ? 0.16 : riskLevel === "MEDIUM" ? 0.06 : 0;
  const confidence = weighted / 100 + completenessBoost - riskPenalty;
  return Number(clamp(confidence, 0.2, 0.95).toFixed(2));
}

function buildWarnings(scoreBlock: ParsedScoreBlock, riskLevel: VolatilityRiskLevel): string[] {
  const warnings: string[] = [];

  if (scoreBlock.missingCategories.length > 0) {
    warnings.push(`Faltan categorías: ${scoreBlock.missingCategories.join(", ")}.`);
  }

  const technical = scoreBlock.categories.technical.score;
  const news = scoreBlock.categories.news.score;
  const options = scoreBlock.categories.options.score;

  if (technical !== null && technical >= 78) {
    warnings.push("Momentum direccional elevado: reduce la calidad de estrategias neutras de volatilidad.");
  }

  if (news !== null && news >= 75) {
    warnings.push("Riesgo de evento alto en noticias: conviene esperar confirmación o ampliar stops.");
  }

  if (options !== null && options <= 45) {
    warnings.push("El componente de opciones está deprimido: la estructura de prima puede ser pobre.");
  }

  if (riskLevel === "HIGH") {
    warnings.push("El perfil de riesgo supera el umbral de seguridad local.");
  }

  return warnings;
}

export function assessVolatility(ticker: string, scoresText: string): VolatilityAssessment {
  const scoreBlock = parseScoreBlock(scoresText);
  const recommendedStrategy = chooseStrategy(scoreBlock);
  const riskLevel = calculateRiskLevel(scoreBlock);
  const popEstimate = estimatePop(scoreBlock, riskLevel);
  const confidence = estimateConfidence(scoreBlock, riskLevel);
  const decision: VolatilityDecision = recommendedStrategy === "WAIT" || riskLevel === "HIGH" || popEstimate < 45 ? "NO" : "SÍ";
  const warnings = buildWarnings(scoreBlock, riskLevel);

  if (scoreBlock.weightedScore === null) {
    warnings.push("No se pudo calcular un score ponderado completo; la decisión usa heurística conservadora.");
  }

  const summary = buildSummary(ticker, scoreBlock, recommendedStrategy);
  const rationaleParts = [
    summary,
    `POP estimada: ${popEstimate}%`,
    `Confianza local: ${(confidence * 100).toFixed(0)}%`,
  ];

  return {
    ticker,
    decision,
    recommendedStrategy,
    riskLevel,
    confidence,
    popEstimate,
    summary,
    warnings,
    rationale: rationaleParts.join(". "),
    scoreBlock,
    scoreSnapshot: {
      financial: scoreBlock.categories.financial.score,
      technical: scoreBlock.categories.technical.score,
      news: scoreBlock.categories.news.score,
      options: scoreBlock.categories.options.score,
      weighted: scoreBlock.weightedScore,
      completeness: scoreBlock.completeness,
    },
  };
}

export function buildVolatilityGeminiPrompt(
  basePrompt: string,
  ticker: string,
  scoresText: string,
  assessment: VolatilityAssessment
): string {
  return `${basePrompt}

ANÁLISIS ESTRUCTURADO PREVIO (validación local)
Ticker: ${ticker}
Scores crudos:
${scoresText}

Resultado local:
${JSON.stringify(
  {
    decision: assessment.decision,
    recommendedStrategy: assessment.recommendedStrategy,
    riskLevel: assessment.riskLevel,
    popEstimate: assessment.popEstimate,
    confidence: assessment.confidence,
    summary: assessment.summary,
    warnings: assessment.warnings,
    scoreSnapshot: assessment.scoreSnapshot,
  },
  null,
  2
)}

INSTRUCCIONES:
- Responde obligatoriamente comenzando con SÍ/NO.
- Mantén el uso de Gemini como motor de análisis narrativo.
- Contrasta tu conclusión con el análisis local estructurado.
- Si difieres, explica exactamente qué score cambió la decisión.
- No uses bloques de código; responde en texto natural y preciso.`;
}

export function buildLocalFallbackNarrative(assessment: VolatilityAssessment): string {
  const opening = assessment.decision;
  const warningText = assessment.warnings.length > 0 ? `\n\nAdvertencias: ${assessment.warnings.join(" ")}` : "";

  return `${opening}. ${assessment.rationale}. Estrategia sugerida: ${assessment.recommendedStrategy}.${warningText}`;
}

export function parseGeminiDecision(text: string): GeminiDecisionParseResult {
  const normalized = text.trim();
  const match = normalized.match(/^(SÍ|SI|NO|YES)(?:[\s\.,:-]+|$)/i);

  const decision = match
    ? match[1].toUpperCase().startsWith("N")
      ? "NO"
      : "SÍ"
    : null;

  const justification = match ? normalized.slice(match[0].length).trim() : normalized;

  return {
    decision,
    justification,
  };
}

export class VolatilityCircuitBreaker {
  private state: CircuitBreakerInternalState;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly halfOpenSuccesses: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.cooldownMs = options.cooldownMs ?? 30_000;
    this.halfOpenSuccesses = options.halfOpenSuccesses ?? 1;
    this.state = {
      state: "closed",
      failureCount: 0,
      lastFailureAt: null,
      nextRetryAt: null,
      halfOpenSuccessCount: 0,
    };
  }

  public getStatus(): CircuitBreakerStatus {
    return {
      state: this.state.state,
      failureCount: this.state.failureCount,
      lastFailureAt: this.state.lastFailureAt,
      nextRetryAt: this.state.nextRetryAt,
    };
  }

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    const now = Date.now();

    if (this.state.state === "open") {
      if (this.state.nextRetryAt && now >= this.state.nextRetryAt) {
        this.state.state = "half-open";
        this.state.halfOpenSuccessCount = 0;
      } else {
        throw new Error("VOLATILITY_CIRCUIT_OPEN");
      }
    }

    try {
      const result = await operation();

      if (this.state.state === "half-open") {
        this.state.halfOpenSuccessCount += 1;
        if (this.state.halfOpenSuccessCount >= this.halfOpenSuccesses) {
          this.reset();
        }
      } else {
        this.reset();
      }

      return result;
    } catch (error) {
      this.state.failureCount += 1;
      this.state.lastFailureAt = Date.now();

      if (this.state.failureCount >= this.failureThreshold) {
        this.state.state = "open";
        this.state.nextRetryAt = Date.now() + this.cooldownMs;
      }

      throw error;
    }
  }

  public reset(): void {
    this.state = {
      state: "closed",
      failureCount: 0,
      lastFailureAt: null,
      nextRetryAt: null,
      halfOpenSuccessCount: 0,
    };
  }
}
