import type { NewsSourceInput } from "../../services/newsTeam06/newsTeam06Api";

interface SourceListProps {
  sources: NewsSourceInput[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function SourceList({ sources, onRemove, onClear }: SourceListProps) {
  if (sources.length === 0) {
    return <p className="team06-empty">No hay fuentes manuales. Puedes analizar solo noticias automáticas del ticker o agregar tus propias fuentes.</p>;
  }

  return (
    <div className="team06-source-list">
      <div className="team06-source-list__top">
        <strong>Fuentes agregadas ({sources.length})</strong>
        <button type="button" onClick={onClear}>Limpiar</button>
      </div>
      {sources.map((source) => (
        <div key={source.id ?? source.url ?? source.title} className="team06-source-item">
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

