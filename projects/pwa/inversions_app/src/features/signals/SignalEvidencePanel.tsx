import type { SourceVerdict } from "../../services/signals/signalApi";

interface SignalEvidencePanelProps {
  evidence: SourceVerdict[];
}

export function SignalEvidencePanel({ evidence }: SignalEvidencePanelProps) {
  if (evidence.length === 0) {
    return <p>No hay evidencia para mostrar.</p>;
  }

  return (
    <section>
      <h2>Evidencia por fuente</h2>
      <ul>
        {evidence.map((item) => (
          <li key={item.sourceId}>
            <strong>{item.sourceId}</strong>: {item.verdict} ({Math.round(item.confidence * 100)}%) - {item.rationale}
          </li>
        ))}
      </ul>
    </section>
  );
}
