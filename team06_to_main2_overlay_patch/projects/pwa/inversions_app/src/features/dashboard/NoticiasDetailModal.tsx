import { ContentModal } from "../../components/ui/ContentModal";
import type { ConfluenceSignalRow } from "../../services/signals/confluenceTableApi";
import { ObservationsTab } from "./ObservationsTab";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  ticker: string;
  signalRow?: ConfluenceSignalRow;
  activeStrategy?: string;
}

function formatResolvedTime(value?: string): string {
  if (!value) return "hora no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "hora no disponible";
  return date.toLocaleTimeString();
}

export function NoticiasDetailModal({ isOpen, onClose, ticker, signalRow, activeStrategy }: Props) {
  if (!signalRow) return null;

  const subtitle = `Estado: ${signalRow.estado} · Resuelto: ${formatResolvedTime(signalRow.computed_at)}`;

  return (
    <ContentModal
      isOpen={isOpen}
      onClose={onClose}
      title={`${ticker} — ANÁLISIS DE NOTICIAS`}
      subtitle={subtitle}
      width="980px"
    >
      <ObservationsTab row={signalRow} activeStrategy={activeStrategy} />
    </ContentModal>
  );
}

export default NoticiasDetailModal;
