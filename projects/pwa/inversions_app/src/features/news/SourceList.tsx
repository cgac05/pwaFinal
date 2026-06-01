import type { NewsSourceInput } from "../../services/news/newsApi";

interface SourceListProps {
  sources: NewsSourceInput[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function SourceList({ sources, onRemove, onClear }: SourceListProps) {
  if (sources.length === 0) {
    return <p className="tnmt-empty">No hay fuentes manuales. Puedes analizar solo noticias automáticas del ticker o agregar tus propias fuentes.</p>;
  }

  return (
    <div className="tnmt-source-list">
      <div className="tnmt-source-list__top">
        <strong>Fuentes agregadas ({sources.length})</strong>
        <button type="button" onClick={onClear}>Limpiar</button>
      </div>
      {sources.map((source) => (
        <div key={source.id ?? source.url ?? source.title} className="tnmt-source-item">
          <div>
            <strong>{source.title || source.url || "Fuente sin título"}</strong>
            <p>{source.url || source.text?.slice(0, 140) || "Sin contenido"}</p>
          </div>
          <button type="button" onClick={() => onRemove(source.id ?? source.url ?? source.title ?? "")}>Quitar</button>
        </div>
      ))}
    </div>
  );
}

