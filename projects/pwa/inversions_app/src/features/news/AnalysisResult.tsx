/**
 * src/features/news/AnalysisResult.tsx
 * FIC: Componente para mostrar resultados del análisis consolidado con veredicto
 */

import React from 'react';

interface AnalysisResultProps {
  result: {
    company: string;
    verdict: 'BUY' | 'SELL' | 'HOLD';
    score: number;
    confidence: number;
    reasoning: string;
    keyPoints: string[];
    timestamp: string;
  };
}

const getVerdictColor = (verdict: 'BUY' | 'SELL' | 'HOLD'): string => {
  switch (verdict) {
    case 'BUY':
      return '#3fb950'; // green
    case 'SELL':
      return '#f85149'; // red
    case 'HOLD':
      return '#d29922'; // orange
    default:
      return '#8b949e'; // gray
  }
};

const getVerdictLabel = (verdict: 'BUY' | 'SELL' | 'HOLD'): string => {
  switch (verdict) {
    case 'BUY':
      return '📈 COMPRAR';
    case 'SELL':
      return '📉 VENDER';
    case 'HOLD':
      return '➡️ MANTENER';
    default:
      return verdict;
  }
};

export const AnalysisResult: React.FC<AnalysisResultProps> = ({ result }) => {
  const verdictColor = getVerdictColor(result.verdict);
  const scorePercent = Math.round(((result.score + 1) / 2) * 100); // Convierte -1 a 1 en 0 a 100

  const formattedTime = new Date(result.timestamp).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="analysis-result">
      {/* ── Veredicto principal ────────────────────────────────────────────── */}
      <div className="result-verdict-card" style={{ borderLeftColor: verdictColor }}>
        <div className="verdict-header">
          <h3 className="verdict-company">{result.company}</h3>
          <span className="verdict-timestamp">{formattedTime}</span>
        </div>

        <div className="verdict-action" style={{ backgroundColor: verdictColor }}>
          <span className="verdict-label">{getVerdictLabel(result.verdict)}</span>
        </div>
      </div>

      {/* ── Métricas ────────────────────────────────────────────── */}
      <div className="result-metrics">
        <div className="metric-item">
          <label>Sentimiento</label>
          <div className="metric-bar">
            <div
              className="metric-fill"
              style={{
                width: `${scorePercent}%`,
                backgroundColor: verdictColor,
              }}
            />
          </div>
          <span className="metric-value">{result.score.toFixed(2)}</span>
        </div>

        <div className="metric-item">
          <label>Confianza</label>
          <div className="metric-bar">
            <div
              className="metric-fill"
              style={{
                width: `${Math.round(result.confidence * 100)}%`,
                backgroundColor: '#388bfd',
              }}
            />
          </div>
          <span className="metric-value">{(result.confidence * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* ── Razonamiento ────────────────────────────────────────────── */}
      <div className="result-reasoning">
        <h4>Análisis</h4>
        <p>{result.reasoning}</p>
      </div>

      {/* ── Puntos clave ────────────────────────────────────────────── */}
      <div className="result-key-points">
        <h4>Factores Clave</h4>
        <ul>
          {result.keyPoints.map((point, idx) => (
            <li key={idx}>
              <span className="point-icon">•</span>
              {point}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
