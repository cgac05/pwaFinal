import React, { useState } from 'react';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { sendFollowUpChat, type MockResult, type ChatMessage } from '../../services/ai/volatilityAnalysisApi';
import { Send, FileText, X, MessageSquare, Award, Clock } from 'lucide-react';

interface AnalysisDetailsModalProps {
  result: MockResult;
  onClose: () => void;
}

export function AnalysisDetailsModal({ result, onClose }: AnalysisDetailsModalProps) {
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(result.chatHistory || []);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExportPDF = () => {
    const element = document.getElementById('pdf-content');
    if (!element) return;

    const opt = {
      margin: 10,
      filename: `Reporte_Analisis_${result.ticker}_${new Date(result.date).getTime()}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };

    // Temporarily apply printable styles for exporting
    const originalStyle = element.style.cssText;
    element.style.color = '#1f2937';
    element.style.background = '#ffffff';
    element.style.padding = '20px';
    element.style.fontFamily = 'Arial, sans-serif';

    html2pdf()
      .set(opt)
      .from(element)
      .save()
      .then(() => {
        element.style.cssText = originalStyle;
      })
      .catch((err: any) => {
        console.error('Error generating PDF:', err);
      });
  };

  const handleSendChat = async () => {
    if (!chatMessage.trim() || chatLoading) return;
    setError(null);
    setChatLoading(true);
    
    const userMsg = chatMessage.trim();
    // Add user message to UI immediately
    const updatedHistory: ChatMessage[] = [
      ...chatHistory,
      { role: 'user', content: userMsg, timestamp: new Date().toISOString() }
    ];
    setChatHistory(updatedHistory);
    setChatMessage('');

    try {
      const reply = await sendFollowUpChat(result.id, userMsg);
      setChatHistory([
        ...updatedHistory,
        { role: 'assistant', content: reply, timestamp: new Date().toISOString() }
      ]);
    } catch (err) {
      console.error(err);
      setError('No se pudo enviar la pregunta de seguimiento.');
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendChat();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(10, 15, 23, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{ 
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '850px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--color-border)',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Award size={20} color="var(--color-accent)" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--color-text)', textTransform: 'none', letterSpacing: 'normal' }}>
              Resultados de Evaluación IA
            </h2>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'transparent', 
              color: 'var(--color-text-muted)', 
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {/* Exportable PDF Content Wrapper */}
          <div id="pdf-content" style={{
            background: 'rgba(255, 255, 255, 0.01)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text)' }}>
                  {result.ticker}
                </span>
                <span style={{
                  color: result.decision === 'SÍ' ? 'var(--color-buy)' : 'var(--color-sell)', 
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  padding: '0.3rem 0.8rem',
                  borderRadius: 'var(--radius-pill)',
                  background: result.decision === 'SÍ' ? 'rgba(63, 185, 80, 0.15)' : 'rgba(248, 81, 73, 0.15)',
                  border: `1px solid ${result.decision === 'SÍ' ? 'var(--color-buy)' : 'var(--color-sell)'}`,
                  letterSpacing: '0.05em'
                }}>
                  VIABLE: {result.decision}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                <Clock size={14} />
                <span>{new Date(result.date).toLocaleString()}</span>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '1rem 0' }} />
            
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Justificación Técnica Completa
            </h3>
            <p style={{ 
              whiteSpace: 'pre-wrap', 
              color: 'var(--color-text)', 
              fontSize: '0.95rem', 
              lineHeight: 1.6,
              background: 'rgba(255, 255, 255, 0.01)',
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              borderLeft: `3px solid ${result.decision === 'SÍ' ? 'var(--color-buy)' : 'var(--color-sell)'}`
            }}>
              {result.justification}
            </p>

            {(result.analysisSummary || result.recommendedStrategy || result.popEstimate !== undefined || result.warnings?.length || result.scoreSnapshot) && (
              <>
                <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '1rem 0' }} />

                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  Diagnóstico Estructurado
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Estrategia sugerida</div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{result.recommendedStrategy ?? 'N/D'}</div>
                  </div>

                  <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Riesgo</div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{result.riskLevel ?? 'MEDIUM'}</div>
                  </div>

                  <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>POP estimada</div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{typeof result.popEstimate === 'number' ? `${result.popEstimate}%` : 'N/D'}</div>
                  </div>

                  <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Confianza</div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{typeof result.confidence === 'number' ? `${Math.round(result.confidence * 100)}%` : 'N/D'}</div>
                  </div>

                  <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Origen</div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{result.analysisSource ?? 'gemini'}</div>
                  </div>
                </div>

                {result.analysisSummary ? (
                  <p style={{ margin: '0 0 0.75rem 0', color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                    {result.analysisSummary}
                  </p>
                ) : null}

                {result.scoreSnapshot ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {[
                      ['Financiero', result.scoreSnapshot.financial],
                      ['Técnico', result.scoreSnapshot.technical],
                      ['Noticias', result.scoreSnapshot.news],
                      ['Opciones', result.scoreSnapshot.options],
                      ['Ponderado', result.scoreSnapshot.weighted],
                    ].map(([label, value]) => (
                      <div key={label} style={{ padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'rgba(255, 255, 255, 0.02)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{label}</div>
                        <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{typeof value === 'number' ? value.toFixed(2) : 'N/D'}</div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {result.warnings && result.warnings.length > 0 ? (
                  <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(248, 81, 73, 0.25)', background: 'rgba(248, 81, 73, 0.08)', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                      Advertencias
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--color-text)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                      {result.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '1rem 0' }} />
            
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Scores Analizados en la Corrida
            </h3>
            <pre style={{ 
              fontFamily: 'monospace', 
              fontSize: '0.85rem', 
              color: 'var(--color-accent)', 
              background: 'rgba(0, 0, 0, 0.2)', 
              padding: '1rem', 
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              margin: 0
            }}>{result.scores}</pre>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginBottom: '2rem' }}>
            <button 
              className="btn-ghost" 
              onClick={handleExportPDF} 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: 'var(--color-border)' }}
            >
              <FileText size={16} />
              Exportar a PDF
            </button>
            <button className="btn-primary" onClick={onClose}>
              Cerrar Detalle
            </button>
          </div>

          {/* Follow-up Interactive Chat */}
          <div style={{ 
            borderTop: '1px solid var(--color-border)', 
            paddingTop: '1.5rem',
            background: 'rgba(255, 255, 255, 0.01)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            border: '1px solid var(--color-border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <MessageSquare size={18} color="var(--color-accent)" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
                Chat de Seguimiento (Auditoría del Maestro)
              </h3>
            </div>
            
            {/* Chat History Box */}
            <div style={{ 
              maxHeight: '220px', 
              overflowY: 'auto', 
              marginBottom: '1rem', 
              padding: '1rem', 
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              {chatHistory.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
                  Hazle preguntas técnicas de seguimiento a la IA sobre esta simulación (ej. "¿Por qué no elegiste Iron Condor?").
                </p>
              ) : (
                chatHistory.map((msg, i) => (
                  <div key={i} style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    lineHeight: 1.4,
                    background: msg.role === 'user' ? 'rgba(56, 139, 253, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${msg.role === 'user' ? 'rgba(56, 139, 253, 0.3)' : 'var(--color-border)'}`,
                    color: 'var(--color-text)'
                  }}>
                    <div style={{ fontWeight: 700, fontSize: '0.7rem', color: msg.role === 'user' ? 'var(--color-accent-hover)' : 'var(--color-text-muted)', marginBottom: '0.2rem' }}>
                      {msg.role === 'user' ? 'TÚ (OPERADOR)' : 'IA QUANT SENIOR (24 AÑOS EXP.)'}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  </div>
                ))
              )}

              {chatLoading && (
                <div style={{
                  alignSelf: 'flex-start',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <div className="skeleton" style={{ width: '8px', height: '8px', borderRadius: '50%' }} />
                  <span>Analizando scores e historial...</span>
                </div>
              )}

              {error && (
                <p style={{ margin: 0, color: 'var(--color-sell)', fontSize: '0.8rem', textAlign: 'center' }}>
                  {error}
                </p>
              )}
            </div>

            {/* Chat Input */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                value={chatMessage} 
                onChange={(e) => setChatMessage(e.target.value)} 
                onKeyDown={handleKeyDown}
                placeholder="Ej. ¿Por qué consideras que el factor de noticias invalida el canal?" 
                disabled={chatLoading}
                style={{ 
                  flex: 1,
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.875rem'
                }}
              />
              <button 
                className="btn-primary" 
                onClick={handleSendChat} 
                disabled={chatLoading || !chatMessage.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.25rem' }}
              >
                <Send size={14} />
                <span>Preguntar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
