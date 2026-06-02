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

Recibirás un bloque de datos concatenados con múltiples 'scores' sobre un activo.

REGLAS DE RESPUESTA:
1. Tu respuesta debe comenzar OBLIGATORIAMENTE con la palabra 'SÍ' o 'NO', indicando si la estrategia es viable.
2. Inmediatamente después del SÍ o NO, redacta una explicación técnica y detallada del porqué de tu decisión, citando los scores.
3. Identifica y lista de forma explícita las salidas/señales más relevantes (máximo 10) al final de tu justificación. Debes usar exactamente el siguiente formato en líneas individuales para cada una de las señales relevantes:
SALIDAS RELEVANTES (Máximo 10):
* CORE: [NombreCore] | INDICADOR: [Indicador/Pata] | SEÑAL: [CALL/PUT/HOLD] | SCORE: [ScoreNum] | DETALLE: [Explicación en una frase]
(Por ejemplo: * CORE: A_TECNICO | INDICADOR: EMA50 | SEÑAL: CALL | SCORE: 0.80 | DETALLE: Rebote dinámico alcista en EMA de 50 periodos)
4. Mantén un tono profesional.`
    }
  ] as MockPrompt[],

  results: [
    {
      id: 'res_seed_1',
      ticker: 'SPY',
      decision: 'SÍ',
      justification: 'Los scores de opciones (85/100) y de financiamiento (65/100) confirman un canal de volatilidad comprimido. La baja volatilidad implícita relativa a la volatilidad histórica apoya la estructura de Iron Condor permitiendo recolectar prima con bajo riesgo de ruptura de strikes externos.',
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
      justification: 'El Score Técnico (82/100) muestra un impulso direccional de sobrecompra muy elevado y el Score de Noticias (75/100) advierte sobre un inminente anuncio de producto con alto impacto. Esto viola la premisa de estabilidad requerida para un Butterfly spread en el strike central actual, elevando drásticamente el riesgo de pérdidas por cola.',
      date: new Date(Date.now() - 3600000 * 5).toISOString(), // 5 hours ago
      scores: 'Score Financiero: 55/100\nScore Técnico: 82/100\nScore Noticias: 75/100\nScore Opciones: 40/100',
      chatHistory: []
    }
  ] as MockResult[]
};
