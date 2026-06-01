import { Router, type Request, type Response } from 'express';
import { mockDb } from '../../modules/volatility/mockDb';
import { GeminiAgentService } from '../../modules/agents/geminiAgentService';
import {
  assessVolatility,
  buildLocalFallbackNarrative,
  buildVolatilityGeminiPrompt,
  parseGeminiDecision,
  VolatilityCircuitBreaker,
  type VolatilityAssessment,
} from '../../modules/volatility/analysisEngine';

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

function simulateGlobalChat(question: string, results: any[]): string {
  const q = question.toLowerCase();

  if (results.length === 0) {
    return "Hola. Actualmente no he detectado ningún reporte de evaluación en mi historial local. Te sugiero ir al Panel de Análisis de Volatilidad y realizar algunas corridas primero para que yo pueda analizar su viabilidad y darte respuestas detalladas.";
  }

  const foundResult = results.find(r => q.includes(r.ticker.toLowerCase()));

  if (foundResult) {
    const strategy = foundResult.scores.toLowerCase().includes('condor') ? 'Iron Condor' : 'Butterfly Spread';
    if (q.includes('por qué') || q.includes('porque') || q.includes('justific') || q.includes('razon')) {
      return `Analizando el reporte para **${foundResult.ticker}**: La decisión de viabilidad fue **${foundResult.decision}**.
Esto se determinó debido a que los scores ingresados (${foundResult.scores.replace(/\n/g, ', ')}) mostraron que ${foundResult.decision === 'SÍ' ? 'la volatilidad implícita está en niveles óptimos para una estrategia de rango (recolectar prima), con bajo riesgo de ruptura.' : 'existe un fuerte momentum direccional o riesgo de noticias macro inminente que anula la premisa de rango lateral.'}
Esta justificación técnica es exactamente la que figura en el reporte PDF exportado.`;
    }

    if (q.includes('riesgo') || q.includes('cobertura') || q.includes('indicador')) {
      return `Para el reporte de **${foundResult.ticker}** con viabilidad **${foundResult.decision}**, el principal indicador a vigilar es el balance de scores.
Con los scores actuales, se determinó un perfil de riesgo ${foundResult.decision === 'SÍ' ? 'favorable' : 'desfavorable'}.
En caso de operar un ${strategy}, se aconseja establecer stops basados en delta del activo subyacente o cobertura con puts/calls externas en las colas.`;
    }

    return `He localizado el reporte de **${foundResult.ticker}** en el historial (de fecha ${new Date(foundResult.date).toLocaleDateString()}).
Su estado es **VIABLE: ${foundResult.decision}** y la justificación técnica fue: "${foundResult.justification}".
¿Deseas profundizar en alguna métrica en particular o revisar cómo optimizar los stops para este activo?`;
  }

  if (q.includes('resumen') || q.includes('compar') || q.includes('historial') || q.includes('cuántos') || q.includes('cuantos') || q.includes('tabla') || q.includes('evalua')) {
    const siCount = results.filter(r => r.decision === 'SÍ').length;
    const noCount = results.filter(r => r.decision === 'NO').length;
    return `Revisando el historial de reportes de la tabla de evaluación:
- He analizado un total de **${results.length} activos**.
- **${siCount}** resultaron con veredicto **SÍ (Viable)**.
- **${noCount}** resultaron con veredicto **NO (No Viable)**.

Los activos evaluados son: ${results.map(r => `${r.ticker} (${r.decision})`).join(', ')}.
¿Hay algún activo en particular del que desees que comparemos los scores técnicos o las justificaciones?`;
  }

  return `Hola. Como analista cuantitativo con 24 años de experiencia en mercados y coberturas, he revisado el historial de reportes. Veo que tenemos reportes de volatilidad para: ${results.map(r => r.ticker).join(', ')}.
Ante tu pregunta: "${question}", te recomiendo evaluar si los scores de opciones superan el percentil 75 para considerar viable la venta de prima. ¿Te gustaría saber más sobre las desviaciones técnicas de alguno de estos activos?`;
}


// 1. Obtener el prompt actual
router.get('/prompts', (_req: Request, res: Response) => {
  res.json({ success: true, data: mockDb.prompts[0] });
});

// 2. Actualizar el prompt
router.put('/prompts/:id', (req: Request, res: Response) => {
  const { basePrompt } = req.body;
  if (!basePrompt) {
    return res.status(400).json({ error: 'El prompt es requerido' });
  }

  mockDb.prompts[0].basePrompt = basePrompt;
  res.json({ success: true, message: 'Prompt actualizado dinámicamente', data: mockDb.prompts[0] });
});

// 3. Ejecutar Análisis
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
      rawText = buildDeterministicFallback(assessment);
    }

    const parsedDecision = parseGeminiDecision(rawText);
    const decision = parsedDecision.decision ?? assessment.decision;
    const justification = parsedDecision.justification || assessment.rationale;

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

    mockDb.results.unshift(newResult);

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
        console.warn('Error en mini-chat, activando fallback:', err);
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

    result.chatHistory.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
    result.chatHistory.push({ role: 'assistant', content: replyText, timestamp: new Date().toISOString() });

    res.json({ success: true, data: replyText });
  } catch (error) {
    console.error('Error en mini-chat:', error);
    res.status(500).json({ success: false, error: 'Error en el chat de seguimiento' });
  }
});

// 6. Catálogo de instrumentos
router.get('/instruments', (_req: Request, res: Response) => {
  res.json({ success: true, data: mockDb.instruments });
});

// 7. Chat global basado en todo el historial
router.post('/global-chat', async (req: Request, res: Response) => {
  try {
    const { message, model } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'El mensaje es requerido' });
    }

    const modelType = model === 'fallback' ? 'fallback' : 'primary';

    const results = mockDb.results;
    let resultsContext = '';

    if (results.length === 0) {
      resultsContext = 'No hay reportes de análisis previos registrados aún en la tabla de evaluación.';
    } else {
      resultsContext = results.map((r, i) => {
        return `Reporte #${i + 1}:
- Símbolo (Ticker): ${r.ticker}
- Fecha: ${new Date(r.date).toLocaleString()}
- Scores Analizados: ${r.scores.replace(/\n/g, ' | ')}
- Decisión de Viabilidad: ${r.decision}
- Justificación Técnica: ${r.justification}
- Chat de Seguimiento Previo: ${r.chatHistory.length === 0 ? 'Ninguna' : r.chatHistory.map(h => `${h.role === 'user' ? 'Usuario' : 'IA'}: ${h.content}`).join(' | ')}`;
      }).join('\n\n');
    }

    const contextPrompt = `Eres un analista financiero cuantitativo y desarrollador senior con 24 años de experiencia.
A continuación se presenta el historial de resultados de tus análisis de volatilidad realizados.
El usuario te hará preguntas sobre este historial o temas relacionados. Tu misión es responder con un tono experto, profesional y en español.

HISTORIAL DE EVALUACIÓN DE VOLATILIDAD:
${resultsContext}

PREGUNTA DEL USUARIO:
${message}`;

    let replyText = '';
    let usedModel = '';
    const geminiService = getGeminiService();

    if (!geminiService.isEnabled()) {
      replyText = simulateGlobalChat(message, results);
      usedModel = modelType === 'primary' ? 'Gemma 4 31B (Simulado)' : 'Gemma 4 26B (Simulado Fallback)';
    } else {
      try {
        const response = await geminiService.generateSimpleResponse(contextPrompt, modelType);
        replyText = response.text || '';
        usedModel = response.model;
      } catch (err: any) {
        console.warn('Error en generateSimpleResponse, activando fallback:', err);
        replyText = simulateGlobalChat(message, results);
        usedModel = `${modelType === 'primary' ? 'Gemma 4 31B' : 'Gemma 4 26B'} (Simulado por Error)`;
      }
    }

    res.json({
      success: true,
      data: {
        text: replyText,
        model: usedModel
      }
    });

  } catch (error) {
    console.error('Error en global-chat:', error);
    res.status(500).json({ success: false, error: 'Error en el chat global de volatilidad' });
  }
});

export default router;
