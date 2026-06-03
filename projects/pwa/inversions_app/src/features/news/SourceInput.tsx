/**
 * src/features/news/SourceInput.tsx
 * FIC: Componente para agregar nuevas fuentes financieras (dominios principales)
 * El sistema automáticamente buscará noticias de la compañía en esos sitios
 */

import React, { useState } from 'react';

interface SourceInputProps {
  onAddSource: (url: string) => void;
  loading: boolean;
}

export const SourceInput: React.FC<SourceInputProps> = ({ onAddSource, loading }) => {
  const [urlInput, setUrlInput] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleAdd = () => {
    const trimmed = urlInput.trim();

    // FIC: Validación de entrada
    if (!trimmed) {
      setError('El dominio no puede estar vacío');
      return;
    }

    // FIC: Valida formato - puede ser dominio o URL completa
    let normalizedUrl = trimmed;

    // Si no tiene protocolo, asume https://
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      normalizedUrl = `https://${trimmed}`;
    }

    try {
      const urlObj = new URL(normalizedUrl);
      
      // FIC: Extrae solo el dominio principal (host)
      const domain = urlObj.hostname || '';

      if (!domain) {
        setError('Dominio inválido');
        return;
      }

      // FIC: Todo OK, agrega la fuente
      onAddSource(domain);
      setUrlInput('');
      setError('');
    } catch {
      setError('Formato de dominio inválido');
      return;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleAdd();
    }
  };

  return (
    <div className="source-input-container">
      <label htmlFor="url-input" className="nsa-label">
        Agregar Fuente Financiera
      </label>

      <div className="source-input-wrapper">
        <input
          id="url-input"
          type="text"
          placeholder="nasdaq.com, investing.com, cnbc.com, etc."
          value={urlInput}
          onChange={(e) => {
            setUrlInput(e.target.value);
            setError('');
          }}
          onKeyPress={handleKeyPress}
          disabled={loading}
          className="source-url-input"
        />
        <button
          onClick={handleAdd}
          disabled={loading || !urlInput.trim()}
          className="btn-add-source"
          title="Agregar fuente"
        >
          +
        </button>
      </div>

      {error && <span className="source-input-error">{error}</span>}

      <p className="source-input-hint">
        💡 Solo dominio (ej: nasdaq.com) • El sistema buscará automáticamente noticias de tu compañía
      </p>
    </div>
  );
};
