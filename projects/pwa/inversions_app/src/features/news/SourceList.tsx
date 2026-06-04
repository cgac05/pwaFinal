/**
 * src/features/news/SourceList.tsx
 * FIC: Componente para mostrar lista expandible de fuentes agregadas
 */

import React from 'react';

interface NewsSource {
  id: string;
  url: string;
  status: 'pending' | 'valid' | 'invalid' | 'analyzed';
  addedAt: string;
}

interface SourceListProps {
  sources: NewsSource[];
  onRemove: (id: string) => void;
  loading: boolean;
}

const getStatusIcon = (status: NewsSource['status']): string => {
  switch (status) {
    case 'pending':
      return '⏳';
    case 'valid':
      return '✅';
    case 'invalid':
      return '❌';
    case 'analyzed':
      return '✓✓';
    default:
      return '•';
  }
};

const getStatusLabel = (status: NewsSource['status']): string => {
  switch (status) {
    case 'pending':
      return 'Validando...';
    case 'valid':
      return 'Válida';
    case 'invalid':
      return 'Inválida';
    case 'analyzed':
      return 'Analizada';
    default:
      return status;
  }
};

export const SourceList: React.FC<SourceListProps> = ({
  sources,
  onRemove,
  loading,
}) => {
  const getNormalizedUrl = (url: string): string => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://${url}`;
  };

  return (
    <div className="source-list">
      {sources.map((source) => {
        const normalizedUrl = getNormalizedUrl(source.url);
        const hostname = new URL(normalizedUrl).hostname || source.url;
        
        return (
          <div key={source.id} className={`source-item source-item-${source.status}`}>
            <div className="source-item-header">
              <span className="source-status-icon">{getStatusIcon(source.status)}</span>
              <span className="source-status-label">{getStatusLabel(source.status)}</span>
            </div>

            <p className="source-url-display" title={source.url}>
              {hostname}
            </p>

            <p className="source-url-full">{source.url}</p>

            <button
              onClick={() => onRemove(source.id)}
              disabled={loading}
              className="btn-remove-source"
              title="Eliminar fuente"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
};
