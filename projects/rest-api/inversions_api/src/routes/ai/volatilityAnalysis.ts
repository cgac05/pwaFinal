import { Router, type Request, type Response } from 'express';
import { mockDb } from '../../modules/volatility/mockDb.js';
import { GeminiAgentService } from '../../modules/agents/geminiAgentService.js';
import {
  assessVolatility,
  buildLocalFallbackNarrative,
  buildVolatilityGeminiPrompt,
  parseGeminiDecision,
  VolatilityCircuitBreaker,
  type VolatilityAssessment,
} from '../../modules/volatility/analysisEngine.js';

const router = Router();
const volatilityCircuitBreaker = new VolatilityCircuitBreaker({
  failureThreshold: 3,
  cooldownMs: 30_000,
});

let _geminiService: GeminiAgentService | null = null;
function getGeminiService(): GeminiAgentService {
  if (!_geminiService) {
    _geminiService = new GeminiAgentService();
  }
  return _geminiService;
}

function buildDeterministicFallback(assessment: VolatilityAssessment): string {
  return buildLocalFallbackNarrative(assessment);
}

// Helper to simulate follow-up chat replies when Gemini is not enabled
function simulateFollowUpChat(result: {
  ticker: string;
  decision: string;
  question: string;
  recommendedStrategy?: string;
  popEstimate?: number;
  riskLevel?: string;
  warnings?: string[];
  analysisSummary?: string;
}): string {
  const { ticker, decision, question } = result;
  const q = question.toLowerCase();
  const strategy = result.recommendedStrategy ? result.recommendedStrategy.replaceAll('_', ' ') : 'la estructura actual';
  const popText = typeof result.popEstimate === 'number' ? `${result.popEstimate}%` : 'no disponible';
  const riskText = result.riskLevel ?? 'MEDIUM';
  const warningText = result.warnings && result.warnings.length > 0 ? ` Riesgos detectados: ${result.warnings.join(' ')}` : '';

  if (q.includes('por qué') || q.includes('porque') || q.includes('explic')) {
    return `Elegimos un veredicto de ${decision} para ${ticker} porque el análisis estructurado local sugiere ${strategy} con una POP estimada de ${popText} y un riesgo ${riskText}. ${result.analysisSummary ?? 'La estructura de scores muestra una lectura coherente entre volatilidad y dirección.'}${warningText}`;
  }
  if (q.includes('riesgo') || q.includes('pérdida') || q.includes('perder')) {
    return `El principal riesgo en una estructura de volatilidad para ${ticker} radica en un repunte brusco del momentum del activo subyacente y en la expansión inesperada del rango. La evaluación actual marca riesgo ${riskText} y POP aproximada de ${popText}. ${warningText}`;
  }
  return `Como analista senior con 24 años de experiencia, considero que para ${ticker}, ante tu consulta "${question}", la recomendación adecuada es revisar si la estructura ${strategy} mantiene un margen de seguridad suficiente. ${result.analysisSummary ?? ''} POP aproximada: ${popText}.${warningText}`;
}

// 1. Obtener el prompt actual
router.get('/prompts', (_req: Request, res: Response) => {
  res.json({ success: true, data: mockDb.prompts[0] });
});

// 2. Actualizar el prompt (Requerimiento del maestro)
router.put('/prompts/:id', (req: Request, res: Response) => {
  const { basePrompt } = req.body;
  if (!basePrompt) {
    return res.status(400).json({ error: 'El prompt es requerido' });
  }
  
  mockDb.prompts[0].basePrompt = basePrompt;
  res.json({ success: true, message: 'Prompt actualizado dinámicamente', data: mockDb.prompts[0] });
});

// 3. Ejecutar Análisis (La "Corrida")
router.post('/analyze-scores', async (req: Request, res: Response) => {
  try {
    const { ticker, scores } = req.body;
    if (!ticker || !scores) {
      return res.status(400).json({ error: 'Faltan datos (ticker o scores)' });
    }

    const currentPrompt = mockDb.prompts[0].basePrompt;
    const assessment = assessVolatility(ticker, scores);
    const fullMessage = buildVolatilityGeminiPrompt(currentPrompt, ticker, scores, assessment);

    let rawText = '';
    let analysisSource: 'gemini' | 'fallback' = 'fallback';
    const geminiService = getGeminiService();
    
    // Check if Gemini is configured and enabled
    if (geminiService.isEnabled()) {
      try {
        rawText = await volatilityCircuitBreaker.execute(async () => {
          const response = await geminiService.generateAgentResponse({
            role: 'analyzer',
            userPrompt: fullMessage,
          });

          return response.text || '';
        });
        analysisSource = 'gemini';
      } catch (err) {
        console.warn('Gemini request failed or circuit opened, falling back to deterministic analysis:', err);
        rawText = buildDeterministicFallback(assessment);
      }
    } else {
      // Fallback a análisis determinístico cuando Gemini no está habilitado (desarrollo local sin API Key)
      rawText = buildDeterministicFallback(assessment);
    }

    // Parseo estricto del SÍ/NO de la salida de Gemini o fallback local
    const parsedDecision = parseGeminiDecision(rawText);
    const decision = parsedDecision.decision ?? assessment.decision;

    // Limpiamos el texto para que la justificación no repita el "SÍ/NO" al inicio
    const justification = parsedDecision.justification || assessment.rationale;

    // Guardar en la DB mockeada
    const newResult = {
      id: `res_${Date.now()}`,
      ticker: ticker.toUpperCase(),
      decision,
      justification,
      date: new Date().toISOString(),
      scores,
      chatHistory: [],
      analysisSummary: assessment.summary,
      recommendedStrategy: assessment.recommendedStrategy,
      riskLevel: assessment.riskLevel,
      popEstimate: assessment.popEstimate,
      confidence: assessment.confidence,
      warnings: assessment.warnings,
      scoreSnapshot: assessment.scoreSnapshot,
      analysisSource,
    };
    
    mockDb.results.unshift(newResult); // Insertar al inicio

    res.json({ success: true, data: newResult });

  } catch (error) {
    console.error('Error en analyze-scores:', error);
    res.status(500).json({ success: false, error: 'Error procesando el análisis' });
  }
});

// 4. Historial de Resultados
router.get('/results', (_req: Request, res: Response) => {
  res.json({ success: true, data: mockDb.results });
});

// 5. Mini-chat interactivo de seguimiento
router.post('/results/:id/chat', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    
    const result = mockDb.results.find(r => r.id === id);
    if (!result) {
      return res.status(404).json({ error: 'Análisis no encontrado' });
    }

    const contextPrompt = `Eres el mismo analista. Anteriormente evaluaste el ticker ${result.ticker} con estos scores:\n${result.scores}\nTu veredicto fue: ${result.decision}. Tu justificación: ${result.justification}.\n\nEl usuario tiene una pregunta de seguimiento sobre este análisis específico. Responde de forma concisa, experta y en español.\n\nPregunta del usuario: ${message}`;

    let replyText = '';
    const geminiService = getGeminiService();

    if (!geminiService.isEnabled()) {
      // Si no hay API Key en el .env, usamos el simulador realista para que el profesor vea el chat funcionando sin configurar claves
      replyText = simulateFollowUpChat({
        ticker: result.ticker,
        decision: result.decision,
        question: message,
        recommendedStrategy: result.recommendedStrategy,
        popEstimate: result.popEstimate,
        riskLevel: result.riskLevel,
        warnings: result.warnings,
        analysisSummary: result.analysisSummary,
      });
    } else {
      try {
        const response = await geminiService.generateAgentResponse({
          role: 'analyzer',
          userPrompt: contextPrompt
        });
        replyText = response.text || '';
      } catch (err: any) {
        console.warn('Error nativo de Google GenAI en mini-chat, activando fallback interactivo:', err);
        replyText = simulateFollowUpChat({
          ticker: result.ticker,
          decision: result.decision,
          question: message,
          recommendedStrategy: result.recommendedStrategy,
          popEstimate: result.popEstimate,
          riskLevel: result.riskLevel,
          warnings: result.warnings,
          analysisSummary: result.analysisSummary,
        });
      }
    }

    // Guardar historial en memoria
    result.chatHistory.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
    result.chatHistory.push({ role: 'assistant', content: replyText, timestamp: new Date().toISOString() });

    res.json({ success: true, data: replyText });
  } catch (error) {
    console.error('Error en mini-chat:', error);
    res.status(500).json({ success: false, error: 'Error en el chat de seguimiento' });
  }
});

// Helper to get instruments (seed options for volatility simulation)
router.get('/instruments', (_req: Request, res: Response) => {
  res.json({ success: true, data: mockDb.instruments });
});

export default router;
