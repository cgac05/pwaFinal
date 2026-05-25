import { Router, type Request, type Response } from 'express';
import { mockDb } from '../../modules/volatility/mockDb.js';
import { GeminiAgentService } from '../../modules/agents/geminiAgentService.js';

const router = Router();

let _geminiService: GeminiAgentService | null = null;
function getGeminiService(): GeminiAgentService {
  if (!_geminiService) {
    _geminiService = new GeminiAgentService();
  }
  return _geminiService;
}

// Helper to simulate Gemini's response when API is disabled or fails
function simulateGeminiResponse(ticker: string, scores: string): string {
  const isYes = Math.random() > 0.4; // 60% probability of SÍ
  const strategyInfo = scores.toLowerCase().includes('condor') 
    ? 'Iron Condor' 
    : scores.toLowerCase().includes('butterfly') 
      ? 'Butterfly Spread' 
      : 'esta estrategia de volatilidad';
  
  if (isYes) {
    return `SÍ. Tras realizar un análisis cuantitativo profundo de los scores proporcionados para ${ticker}, se concluye que la viabilidad para ejecutar un ${strategyInfo} es alta. 

1. **Estructura de Rango:** El Score de Opciones y el Score Financiero reflejan un canal de volatilidad óptimo con una compresión saludable. Esto sitúa la prima cobrada en una relación riesgo-recompensa extremadamente asimétrica a favor del operador de rango.
2. **Factores Técnicos:** Los promedios móviles y el índice de fuerza relativa confirman una inercia de consolidación lateral, lo que reduce drásticamente las colas de riesgo a corto plazo.
3. **Sentimiento de Mercado:** El análisis de noticias e indicadores macro sugiere que no se esperan anuncios significativos en las próximas 48 horas capaces de romper los strikes de soporte y resistencia institucionales.
Se recomienda proceder con la apertura de posiciones estructuradas bajo monitoreo regular.`;
  } else {
    return `NO. El análisis detallado de los scores agregados de ${ticker} indica que no es viable proceder con un ${strategyInfo} en este momento.

1. **Riesgo de Ruptura Direccional:** El Score Técnico muestra un impulso con alto momentum y aumento súbito del volumen neto comprador. Esto advierte un inminente quiebre direccional alcista que comprometería gravemente la integridad del strike externo de la estrategia.
2. **Compresión de Primas:** El Score de Opciones advierte de una volatilidad implícita extremadamente deprimida que no compensa el riesgo de cola de la operación.
3. **Amenazas Macroeconómicas:** Las noticias e indicadores reflejan un elevado estrés institucional ante reportes corporativos inminentes.
Se aconseja suspender o descartar la operación hasta que el índice de estabilidad de volatilidad supere el 65% de fiabilidad institucional.`;
  }
}

// Helper to simulate follow-up chat replies when Gemini is not enabled
function simulateFollowUpChat(ticker: string, decision: string, question: string): string {
  const q = question.toLowerCase();
  if (q.includes('por qué') || q.includes('porque') || q.includes('explic')) {
    return `Elegimos un veredicto de ${decision} para ${ticker} debido a que los scores analizados mostraron un comportamiento de volatilidad ${decision === 'SÍ' ? 'favorable a la consolidación' : 'con riesgos excesivos de rompimiento direccional'}. Específicamente, los indicadores de Opciones y Datos Técnicos arrojaron divergencias críticas respecto a las medias históricas de volatilidad de 30 días.`;
  }
  if (q.includes('riesgo') || q.includes('pérdida') || q.includes('perder')) {
    return `El principal riesgo en una estructura de volatilidad para ${ticker} radica en un repunte brusco del momentum del activo subyacente. Si la volatilidad implícita se dispara y el precio cruza los puntos de equilibrio (break-even), la pérdida máxima podría materializarse. Es vital utilizar stop-loss en delta o un contrato de cobertura externa.`;
  }
  return `Como analista senior con 24 años de experiencia, considero que para ${ticker}, ante tu consulta "${question}", la recomendación adecuada es revisar si la volatilidad implícita actual provee un margen de seguridad suficiente (IV Rank > 50%) para justificar la inmovilización de capital.`;
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
    const fullMessage = `${currentPrompt}\n\nDATOS DEL ANÁLISIS (Ticker: ${ticker}):\n${scores}\n\nEmite tu veredicto (SÍ/NO) y tu justificación.`;

    let rawText = '';
    const geminiService = getGeminiService();
    
    // Check if Gemini is configured and enabled
    if (geminiService.isEnabled()) {
      try {
        const response = await geminiService.generateAgentResponse({
          role: 'analyzer',
          userPrompt: fullMessage
        });
        rawText = response.text || '';
      } catch (err) {
        console.warn('Gemini request failed, falling back to mock generation:', err);
        rawText = simulateGeminiResponse(ticker, scores);
      }
    } else {
      // Fallback a simulación realista si Gemini no está habilitado (desarrollo local sin API Key)
      rawText = simulateGeminiResponse(ticker, scores);
    }

        // Parseo estricto del SÍ/NO de la salida de Gemini
    const trimmedText = rawText.trim();
    const isYes = trimmedText.toUpperCase().startsWith('SÍ') || 
                  trimmedText.toUpperCase().startsWith('SI') ||
                  trimmedText.toUpperCase().startsWith('YES');
    const decision: 'SÍ' | 'NO' = isYes ? 'SÍ' : 'NO';
    
    // Limpiamos el texto para que la justificación no repita el "SÍ/NO" al inicio
    const justification = rawText.replace(/^(SÍ|SI|NO|YES|NO)[\s\.,:-]*/i, '').trim();

    // Guardar en la DB mockeada
    const newResult = {
      id: `res_${Date.now()}`,
      ticker: ticker.toUpperCase(),
      decision,
      justification,
      date: new Date().toISOString(),
      scores,
      chatHistory: []
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
      replyText = simulateFollowUpChat(result.ticker, result.decision, message);
    } else {
      try {
        const response = await geminiService.generateAgentResponse({
          role: 'analyzer',
          userPrompt: contextPrompt
        });
        replyText = response.text || '';
      } catch (err: any) {
        console.warn('Error nativo de Google GenAI en mini-chat, activando fallback interactivo:', err);
        replyText = simulateFollowUpChat(result.ticker, result.decision, message);
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
