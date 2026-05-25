import React, { useState, useEffect } from 'react';
import { AnalysisDetailsModal } from './AnalysisDetailsModal';
import { 
  fetchPrompts, 
  updatePrompt, 
  fetchResults, 
  fetchInstruments, 
  runAnalysis, 
  type MockResult, 
  type MockInstrument 
} from '../../services/ai/volatilityAnalysisApi';
import { 
  Activity, 
  Sliders, 
  Play, 
  Table, 
  Calendar, 
  CheckCircle, 
  AlertCircle, 
  ChevronRight, 
  TrendingUp, 
  Layers, 
  BookOpen 
} from 'lucide-react';

const SCORE_TEMPLATES = [
  {
    name: 'Template: Iron Condor (Alta Viabilidad)',
    ticker: 'SPY',
    scores: `Score Financiero: 75/100 (Liquidez óptima, bajo spread bid-ask)
Score Técnico: 38/100 (Baja volatilidad histórica, canal lateral consolidado)
Score Noticias: 22/100 (Sentimiento neutral, sin eventos macro de impacto en 72h)
Score Opciones: 85/100 (IV Rank en percentil favorable para recolectar primas)`
  },
  {
    name: 'Template: Butterfly Spread (Riesgo por Cola - NO Viable)',
    ticker: 'AAPL',
    scores: `Score Financiero: 55/100 (Volumen institucional promedio)
Score Técnico: 82/100 (Direccionalidad con fuerte momentum alcista/sobrecompra)
Score Noticias: 78/100 (Alertas por anuncio trimestral de ganancias en 24h)
Score Opciones: 42/100 (IV Rank deprimido, sin colchón de volatilidad implícita)`
  }
];

const DEFAULT_SCORES: Record<string, string> = {
  SPY: `Score Financiero: 75/100 (Liquidez óptima, bajo spread bid-ask)
Score Técnico: 38/100 (Baja volatilidad histórica, canal lateral consolidado)
Score Noticias: 22/100 (Sentimiento neutral, sin eventos macro de impacto en 72h)
Score Opciones: 85/100 (IV Rank en percentil favorable para recolectar primas)`,

  AAPL: `Score Financiero: 55/100 (Volumen institucional promedio)
Score Técnico: 82/100 (Direccionalidad con fuerte momentum alcista/sobrecompra)
Score Noticias: 78/100 (Alertas por anuncio trimestral de ganancias en 24h)
Score Opciones: 42/100 (IV Rank deprimido, sin colchón de volatilidad implícita)`,

  TSLA: `Score Financiero: 68/100 (Alto volumen de retail y creación de mercado)
Score Técnico: 79/100 (Fuerte sobreventa de corto plazo, posible rebote)
Score Noticias: 60/100 (Especulación moderada en prensa por evento regulatorio)
Score Opciones: 92/100 (Volatilidad implícita extremadamente inflada, ideal para venta de primas)`,

  NVDA: `Score Financiero: 80/100 (Excelente volumen diario y spread mínimo)
Score Técnico: 50/100 (Consolidación tras máximos históricos)
Score Noticias: 45/100 (Sentimiento general positivo sin noticias de cola en corto)
Score Opciones: 70/100 (IV Rank moderado, rentabilidad decente en spreads estructurados)`
};

export function VolatilityAnalysisPage() {
  const [prompt, setPrompt] = useState('');
  const [results, setResults] = useState<MockResult[]>([]);
  const [instruments, setInstruments] = useState<MockInstrument[]>([]);
  const [ticker, setTicker] = useState('SPY');
  const [scores, setScores] = useState(DEFAULT_SCORES.SPY);
  const [loading, setLoading] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<MockResult | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleTickerChange = (newTicker: string) => {
    setTicker(newTicker);
    const upper = newTicker.toUpperCase();
    if (DEFAULT_SCORES[upper]) {
      setScores(DEFAULT_SCORES[upper]);
    }
  };

  // Load backend seed data on startup
  useEffect(() => {
    fetchPrompts()
      .then(data => setPrompt(data.basePrompt))
      .catch(err => console.error('Error fetching prompts:', err));

    fetchResults()
      .then(data => setResults(data))
      .catch(err => console.error('Error fetching results:', err));

    fetchInstruments()
      .then(data => setInstruments(data))
      .catch(err => console.error('Error fetching instruments:', err));
  }, []);

  const handleUpdatePrompt = async () => {
    setPromptLoading(true);
    setFeedbackMsg(null);
    try {
      await updatePrompt('default_1', prompt);
      showFeedback('Prompt base actualizado con éxito en la base de datos (Mock)', 'success');
    } catch (err) {
      showFeedback('Error al actualizar el prompt base', 'error');
    } finally {
      setPromptLoading(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!ticker.trim() || !scores.trim()) return;
    setLoading(true);
    setFeedbackMsg(null);
    try {
      const data = await runAnalysis(ticker, scores);
      setResults(prev => [data, ...prev]); // Prepend new simulation to history
      showFeedback(`Corrida ejecutada con éxito. Conclusión: ${data.decision}`, 'success');
    } catch (err) {
      showFeedback('Error al ejecutar la corrida de análisis', 'error');
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (templateIndex: number) => {
    const template = SCORE_TEMPLATES[templateIndex];
    setTicker(template.ticker);
    setScores(template.scores);
    showFeedback(`Plantilla aplicada: ${template.name}`, 'success');
  };

  const showFeedback = (text: string, type: 'success' | 'error') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4500);
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
        <Activity size={28} color="var(--color-accent)" />
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
            Panel de Análisis de Volatilidad IA
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            Módulo de evaluación institucional para maestros y administradores (Rúbrica Estricta de Opciones).
          </p>
        </div>
      </div>

      {feedbackMsg && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.875rem',
          fontWeight: 600,
          background: feedbackMsg.type === 'success' ? 'rgba(63, 185, 80, 0.15)' : 'rgba(248, 81, 73, 0.15)',
          color: feedbackMsg.type === 'success' ? 'var(--color-buy)' : 'var(--color-sell)',
          border: `1px solid ${feedbackMsg.type === 'success' ? 'var(--color-buy)' : 'var(--color-sell)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {feedbackMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Grid columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        
        {/* SECCIÓN 1: EDITOR DE PROMPT PARAMETRIZADO */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
            <Sliders size={18} color="var(--color-hold)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
              1. Tabla de Parámetros: Prompt Base Parametrizado
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Exigencia del Profesor: El prompt base NO se lee del archivo `.env`, sino de un renglón parametrizado editable.
          </p>
          <textarea 
            value={prompt} 
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
            style={{ 
              width: '100%', 
              padding: '0.6rem', 
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              lineHeight: 1.4,
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-text)',
              resize: 'vertical'
            }}
          />
          <button 
            className="btn-primary" 
            onClick={handleUpdatePrompt}
            disabled={promptLoading || !prompt.trim()}
            style={{ alignSelf: 'flex-start', padding: '0.45rem 1.25rem' }}
          >
            {promptLoading ? 'Guardando...' : 'Actualizar Prompt Base'}
          </button>
        </div>

        {/* SECCIÓN 2: SIMULADOR DE SCORES DE ESTRATEGIAS */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
            <Layers size={18} color="var(--color-accent)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
              2. Simulador de Scores & Corrida
            </h3>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', marginRight: '0.5rem' }}>
              Cargar plantillas rápidas:
            </span>
            <button className="btn-ghost" onClick={() => applyTemplate(0)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>
              Iron Condor (SÍ)
            </button>
            <button className="btn-ghost" onClick={() => applyTemplate(1)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>
              Butterfly Spread (NO)
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Ticker selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '150px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Símbolo (Ticker)</label>
              <select 
                value={ticker} 
                onChange={(e) => handleTickerChange(e.target.value)}
                style={{ height: '38px', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text)', padding: '0.45rem' }}
              >
                {instruments.map(inst => (
                  <option key={inst.id} value={inst.ticker}>
                    {inst.ticker} - {inst.classification}
                  </option>
                ))}
              </select>
            </div>

            {/* Scores text box */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '280px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Concatenación de Scores (Datos de entrada)</label>
              <textarea 
                value={scores} 
                onChange={(e) => setScores(e.target.value)} 
                rows={4} 
                placeholder="Inserta el chorizo de scores concatenados..."
                style={{ 
                  padding: '0.5rem', 
                  background: 'var(--color-surface-raised)', 
                  border: '1px solid var(--color-border)', 
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text)',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace'
                }}
              />
            </div>
          </div>

          <button 
            className="btn-primary" 
            onClick={handleRunAnalysis} 
            disabled={loading || !ticker.trim() || !scores.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', alignSelf: 'flex-end', padding: '0.5rem 1.5rem', marginTop: '0.5rem' }}
          >
            <Play size={16} />
            {loading ? 'Analizando con Gemini...' : 'Ejecutar Análisis IA (Corrida)'}
          </button>
        </div>

        {/* SECCIÓN 3: LA TABLA DE RESULTADOS DE TAREAS */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
            <Table size={18} color="var(--color-buy)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
              3. Tabla de Resultados de Tareas (Historial)
            </h3>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: '600px' }}>
              <thead>
                <tr>
                  <th><div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Calendar size={12} /> Fecha</div></th>
                  <th>Símbolo</th>
                  <th>Scores Analizados</th>
                  <th>Decisión Viable</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-muted)' }}>
                      No se han registrado corridas de análisis aún. Usa el simulador de arriba para correr el modelo.
                    </td>
                  </tr>
                ) : (
                  results.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        {new Date(item.date).toLocaleString()}
                      </td>
                      <td>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--color-text)' }}>
                          {item.ticker}
                        </strong>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px' }}>
                        {item.scores.replace(/\n/g, ' | ')}
                      </td>
                      <td>
                        <span style={{ 
                          color: item.decision === 'SÍ' ? 'var(--color-buy)' : 'var(--color-sell)', 
                          fontWeight: 800,
                          padding: '0.2rem 0.6rem',
                          borderRadius: 'var(--radius-pill)',
                          background: item.decision === 'SÍ' ? 'rgba(63, 185, 80, 0.12)' : 'rgba(248, 81, 73, 0.12)',
                          fontSize: '0.8rem',
                          border: `1px solid ${item.decision === 'SÍ' ? 'rgba(63, 185, 80, 0.25)' : 'rgba(248, 81, 73, 0.25)'}`
                        }}>
                          {item.decision}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn-ghost" 
                          onClick={() => setSelectedResult(item)}
                          style={{ 
                            padding: '0.25rem 0.65rem', 
                            fontSize: '0.8rem', 
                            borderColor: 'var(--color-border)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          Ver Reporte & Chat
                          <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* DETALLES Y CHAT MODAL */}
      {selectedResult && (
        <AnalysisDetailsModal 
          result={selectedResult} 
          onClose={() => setSelectedResult(null)} 
        />
      )}
    </div>
  );
}
export default VolatilityAnalysisPage;
