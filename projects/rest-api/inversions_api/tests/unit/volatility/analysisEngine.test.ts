import { describe, expect, it } from 'vitest';
import {
  assessVolatility,
  buildVolatilityGeminiPrompt,
  parseGeminiDecision,
  parseScoreBlock,
  VolatilityCircuitBreaker,
} from '../../../src/modules/volatility/analysisEngine';

const SPY_SCORES = `Score Financiero: 75/100 (Liquidez óptima, bajo spread bid-ask)
Score Técnico: 38/100 (Baja volatilidad histórica, canal lateral consolidado)
Score Noticias: 22/100 (Sentimiento neutral, sin eventos macro de impacto en 72h)
Score Opciones: 85/100 (IV Rank en percentil favorable para recolectar primas)`;

const AAPL_SCORES = `Score Financiero: 55/100 (Volumen institucional promedio)
Score Técnico: 82/100 (Direccionalidad con fuerte momentum alcista/sobrecompra)
Score Noticias: 78/100 (Alertas por anuncio trimestral de ganancias en 24h)
Score Opciones: 42/100 (IV Rank deprimido, sin colchón de volatilidad implícita)`;

describe('volatility analysis engine', () => {
  it('parses score blocks into structured categories', () => {
    const block = parseScoreBlock(SPY_SCORES);

    expect(block.categories.financial.score).toBe(75);
    expect(block.categories.technical.score).toBe(38);
    expect(block.categories.news.score).toBe(22);
    expect(block.categories.options.score).toBe(85);
    expect(block.weightedScore).toBeGreaterThan(50);
    expect(block.completeness).toBe(1);
  });

  it('suggests iron condor for low directionality and rich premium', () => {
    const assessment = assessVolatility('SPY', SPY_SCORES);

    expect(assessment.decision).toBe('SÍ');
    expect(assessment.recommendedStrategy).toBe('IRON_CONDOR');
    expect(assessment.riskLevel).toBe('MEDIUM');
    expect(assessment.popEstimate).toBeGreaterThan(45);
    expect(assessment.summary).toContain('SPY');
  });

  it('flags directional risk when technical and news scores are elevated', () => {
    const assessment = assessVolatility('AAPL', AAPL_SCORES);

    expect(assessment.decision).toBe('NO');
    expect(assessment.recommendedStrategy).toBe('WAIT');
    expect(assessment.riskLevel).toBe('HIGH');
    expect(assessment.warnings.length).toBeGreaterThan(0);
  });

  it('builds an enriched Gemini prompt with the local assessment', () => {
    const assessment = assessVolatility('SPY', SPY_SCORES);
    const prompt = buildVolatilityGeminiPrompt('PROMPT BASE', 'SPY', SPY_SCORES, assessment);

    expect(prompt).toContain('PROMPT BASE');
    expect(prompt).toContain('ANÁLISIS ESTRUCTURADO PREVIO');
    expect(prompt).toContain('SÍ/NO');
    expect(prompt).toContain('IRON_CONDOR');
  });

  it('parses Gemini decisions from raw text output', () => {
    const parsed = parseGeminiDecision('SÍ. La estructura luce favorable y la POP es razonable.');

    expect(parsed.decision).toBe('SÍ');
    expect(parsed.justification).toContain('estructura luce favorable');
  });

  it('opens the circuit breaker after repeated failures', async () => {
    const breaker = new VolatilityCircuitBreaker({ failureThreshold: 1, cooldownMs: 60_000 });

    await expect(breaker.execute(async () => {
      throw new Error('boom');
    })).rejects.toThrow('boom');

    await expect(breaker.execute(async () => 'ok')).rejects.toThrow('VOLATILITY_CIRCUIT_OPEN');
  });
});
