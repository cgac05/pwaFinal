export interface MockInstrument {
  id: string;
  ticker: string;
  classification: string;
  mediaPlan: string;
  updates: string;
}

export interface MockPrompt {
  id: string;
  basePrompt: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface MockResult {
  id: string;
  ticker: string;
  decision: 'SÍ' | 'NO';
  justification: string;
  date: string;
  scores: string;
  chatHistory: ChatMessage[];
  analysisSummary?: string;
  recommendedStrategy?: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  popEstimate?: number;
  confidence?: number;
  warnings?: string[];
  scoreSnapshot?: {
    financial: number | null;
    technical: number | null;
    news: number | null;
    options: number | null;
    weighted: number | null;
    completeness: number;
  };
  analysisSource?: 'gemini' | 'fallback';
}

// Base de datos en memoria (Singleton)
export const mockDb = {
  instruments: [
    { id: '1', ticker: 'SPY', classification: 'Alta Liquidez', mediaPlan: 'Cobertura Semanal', updates: 'Aprobado' },
    { id: '2', ticker: 'AAPL', classification: 'Tech Mega-cap', mediaPlan: 'Monitoreo Diario', updates: 'Pendiente' },
    { id: '3', ticker: 'TSLA', classification: 'Alta Volatilidad', mediaPlan: 'Cobertura Mensual agresiva', updates: 'Aprobado' },
    { id: '4', ticker: 'NVDA', classification: 'Semiconductores High-Beta', mediaPlan: 'Cobertura de Rango Corto', updates: 'Pendiente' }
  ] as MockInstrument[],

  prompts: [
    {
      id: 'default_1',
      basePrompt: `Eres un analista financiero institucional y desarrollador experto (Senior Quant) con 24 años de experiencia en mercados bursátiles, estrategias de opciones complejas y análisis de sentimiento. Conoces a la perfección todas las fuentes de información financiera.

Recibirás datos consolidados de múltiples cores (Técnico, Institucional, Fundamental, Noticias, Indicadores, etc.) sobre un activo.

REGLAS DE RESPUESTA OBLIGATORIAS:

1. DECISIÓN (CALL / PUT / HOLD)
   Tu respuesta DEBE indicar UNA decisión inicial (SÍ, NO, HOLD):
   - SÍ (CALL): Comprar o abrir posición alcista
   - NO (PUT): Vender o abrir posición bajista
   - HOLD/MANTENER: No hacer nada o mantener posición actual
   
   LIBERTAD TOTAL para elegir HOLD: Tienes estricta libertad para concluir que la mejor decisión 
   es 'No hacer nada' (HOLD) si las condiciones del mercado no son claras o el riesgo es alto. 
   NO estás obligado a sugerir operaciones a la alza o a la baja por presión alguna.

2. JUSTIFICACIÓN TÉCNICA DESGLOSADA
   Inmediatamente después de tu decisión, redacta una explicación detallada que incluya:
   - Un resumen general (1-2 líneas) de tu veredicto.
   - Un desglose CORE por CORE citando los scores numéricos (Técnico, Institucional, Fundamental, Noticias).

3. IDENTIFICACIÓN DE SEÑALES CLAVE Y FORMATO CANÓNICO
   Identifica y lista de forma explícita las salidas/señales más relevantes (máximo 10) al final de tu justificación. Debes usar exactamente el siguiente formato estricto en líneas individuales para que el parser funcione:
   SALIDAS RELEVANTES (Máximo 10):
   * CORE: [NombreCore] | INDICADOR: [Indicador/Pata] | SEÑAL: [CALL/PUT/HOLD] | SCORE: [ScoreNum] | DETALLE: [Explicación en una frase]
   (Por ejemplo: * CORE: A_TECNICO | INDICADOR: EMA50 | SEÑAL: CALL | SCORE: 0.80 | DETALLE: Rebote dinámico alcista en EMA de 50 periodos)

4. TONO Y PROFESIONALISMO
   Mantén un tono profesional, técnico pero accesible.`
    }
  ] as MockPrompt[],

  results: [
    {
      id: 'res_seed_1',
      ticker: 'SPY',
      decision: 'SÍ',
      justification: 'Los scores de opciones (85/100) y de financiamiento (65/100) confirman un canal de volatilidad comprimido. La baja volatilidad implícita relativa a la volatilidad histórica apoya la estructura de Iron Condor permitiendo recolectar prima con bajo riesgo de ruptura de strikes externos.\n\nSALIDAS RELEVANTES (Máximo 10):\n* CORE: A_TECNICO | INDICADOR: EMA50 | SEÑAL: CALL | SCORE: 0.80 | DETALLE: Rebote dinámico alcista en EMA de 50 periodos\n* CORE: A_OPCIONES | INDICADOR: IV Rank | SEÑAL: PUT | SCORE: -0.65 | DETALLE: Contracción de volatilidad esperada\n* CORE: A_INSTITUCIONAL | INDICADOR: Dark Pools | SEÑAL: HOLD | SCORE: 0.10 | DETALLE: Flujo mixto sin direccionalidad clara',
      date: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
      scores: 'Score Financiero: 65/100\nScore Técnico: 42/100\nScore Noticias: 30/100\nScore Opciones: 85/100',
      chatHistory: [
        { role: 'user', content: '¿Qué pasaría si la volatilidad implícita sube bruscamente?', timestamp: new Date(Date.now() - 3600000 * 1.9).toISOString() },
        { role: 'assistant', content: 'Un pico abrupto en la volatilidad implícita depreciará temporalmente el valor de las opciones vendidas debido a la vega positiva del portafolio global. Se sugiere mantener la posición si se encuentra lejos de los puntos de equilibrio o comprar un contrato de cobertura externo.', timestamp: new Date(Date.now() - 3600000 * 1.8).toISOString() }
      ]
    },
    {
      id: 'res_seed_2',
      ticker: 'AAPL',
      decision: 'NO',
      justification: 'El Score Técnico (82/100) muestra un impulso direccional de sobrecompra muy elevado y el Score de Noticias (75/100) advierte sobre un inminente anuncio de producto con alto impacto. Esto viola la premisa de estabilidad requerida para un Butterfly spread en el strike central actual, elevando drásticamente el riesgo de pérdidas por cola.\n\nSALIDAS RELEVANTES (Máximo 10):\n* CORE: A_TECNICO | INDICADOR: RSI | SEÑAL: PUT | SCORE: -0.90 | DETALLE: Divergencia bajista extrema\n* CORE: A_NOTICIAS | INDICADOR: Sentimiento | SEÑAL: PUT | SCORE: -0.75 | DETALLE: Alerta de downgrade inminente\n* CORE: A_FUNDAMENTAL | INDICADOR: PE Ratio | SEÑAL: HOLD | SCORE: -0.15 | DETALLE: Valuación por encima de la media histórica',
      date: new Date(Date.now() - 3600000 * 5).toISOString(), // 5 hours ago
      scores: 'Score Financiero: 55/100\nScore Técnico: 82/100\nScore Noticias: 75/100\nScore Opciones: 40/100',
      chatHistory: []
    }
  ] as MockResult[]
};
