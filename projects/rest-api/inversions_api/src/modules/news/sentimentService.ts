// src/modules/news/sentimentService.ts
// Llama a Claude para analizar el sentimiento de las noticias

import Anthropic from '@anthropic-ai/sdk';
import type { AlpacaNewsArticle } from './newsAdapter';

export interface SentimentResult {
  score: number;          // -1.0 (muy negativo) a +1.0 (muy positivo)
  label: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;     // 0.0 a 1.0
  reasoning: string;
  keyFactors: string[];
}

export class SentimentService {
  private client: Anthropic;

  constructor() {
    // Reutiliza la Claude API que ya existe en el proyecto
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async analyzeNewsSentiment(
    symbol: string,
    articles: AlpacaNewsArticle[]
  ): Promise<SentimentResult> {
    if (articles.length === 0) {
      return {
        score: 0,
        label: 'NEUTRAL',
        confidence: 0,
        reasoning: 'No hay noticias recientes para analizar.',
        keyFactors: [],
      };
    }

    // Preparamos el resumen de noticias para Claude
    const newsDigest = articles
      .slice(0, 10)   // máximo 10 artículos para no saturar el contexto
      .map((a, i) => `[${i + 1}] ${a.headline}\nResumen: ${a.summary}`)
      .join('\n\n');

    const prompt = `Eres un analista financiero experto. Analiza las siguientes noticias recientes sobre ${symbol} y determina el sentimiento de inversión.

NOTICIAS RECIENTES:
${newsDigest}

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "score": <número entre -1.0 y 1.0>,
  "label": <"BULLISH" | "BEARISH" | "NEUTRAL">,
  "confidence": <número entre 0.0 y 1.0>,
  "reasoning": "<explicación concisa en 2-3 oraciones>",
  "keyFactors": ["<factor 1>", "<factor 2>", "<factor 3>"]
}

Criterios:
- score > 0.3 y label BULLISH: noticias positivas, crecimiento, ganancias, expansión
- score < -0.3 y label BEARISH: noticias negativas, pérdidas, litigios, caídas
- -0.3 a 0.3 y label NEUTRAL: noticias mixtas o sin impacto claro
- confidence refleja qué tan clara y consistente es la señal en las noticias`;

    const message = await this.client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = (message.content[0] as { type: 'text'; text: string }).text;

    // Limpiamos posibles markdown fences antes de parsear
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleaned) as SentimentResult;

    return result;
  }
}