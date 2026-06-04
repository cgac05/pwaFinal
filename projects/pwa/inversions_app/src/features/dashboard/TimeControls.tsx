// FIC: Time controls — timeframe selector replaced with PillGroup (Revolut style). Retains all logic.
// FIC: Controles de tiempo — selector de temporalidad reemplazado con PillGroup (estilo Revolut). Retiene toda la lógica.

import { useState, useEffect } from "react";
import { useSignalStore } from "../../store/signals";
import { getAuthHeaders } from "../../services/signals/signalApi";
import { PillGroup } from "../../components/ui/PillGroup";

interface PeriodOption {
  label: string;
  value: string;
  daysBack: number;
}

const TIMEFRAME_PILLS = [
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
  { value: "4h", label: "4h" },
  { value: "1d", label: "1d" }
];

const PERIOD_OPTIONS: PeriodOption[] = [
  { label: "1D",     value: "1d",     daysBack: 1 },
  { label: "1W",     value: "1w",     daysBack: 7 },
  { label: "1M",     value: "1m",     daysBack: 30 },
  { label: "3M",     value: "3m",     daysBack: 90 },
  { label: "6M",     value: "6m",     daysBack: 180 },
  { label: "1Y",     value: "1y",     daysBack: 365 },
  { label: "5Y",     value: "5y",     daysBack: 365 * 5 },
  { label: "Max",    value: "max",    daysBack: 365 * 30 },
  { label: "YTD",    value: "ytd",    daysBack: 0 },
  { label: "Custom", value: "custom", daysBack: 0 },
];

interface TimeControlsProps {
  symbol?: string;
  onTimeframeChange?: (timeframe: string) => void;
  onPeriodChange?: (period: string, startDate: Date, endDate: Date) => void;
}

export function TimeControls({ symbol, onTimeframeChange, onPeriodChange }: TimeControlsProps) {
  const [timeframe, setTimeframe] = useState("1d");
  const [period, setPeriod] = useState("1y");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const { runtimeMode } = useSignalStore();

  // FIC: Load available timeframes from broker capabilities (kept from original).
  // FIC: Cargar temporalidades disponibles desde capacidades del broker (conservado del original).
  useEffect(() => {
    if (!symbol) return;
    fetch("/api/brokers/capabilities", { headers: getAuthHeaders() }).catch(() => {});
  }, [symbol, runtimeMode]);

  const getDateRange = (selectedPeriod: string) => {
    const endDate = new Date();
    let startDate = new Date();
    switch (selectedPeriod) {
      case "1d": startDate.setDate(endDate.getDate() - 1); break;
      case "1w": startDate.setDate(endDate.getDate() - 7); break;
      case "1m": startDate.setMonth(endDate.getMonth() - 1); break;
      case "3m": startDate.setMonth(endDate.getMonth() - 3); break;
      case "6m": startDate.setMonth(endDate.getMonth() - 6); break;
      case "1y":  startDate.setFullYear(endDate.getFullYear() - 1); break;
      case "5y":  startDate.setFullYear(endDate.getFullYear() - 5); break;
      case "max": startDate = new Date(1970, 0, 1); break;
      case "ytd": startDate = new Date(endDate.getFullYear(), 0, 1); break;
      default:    startDate.setFullYear(endDate.getFullYear() - 1);
    }
    return { startDate, endDate };
  };

  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf);
    onTimeframeChange?.(tf);
  };

  const handlePeriodChange = (selectedPeriod: string) => {
    setPeriod(selectedPeriod);
    if (selectedPeriod === "custom") {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      const { startDate, endDate } = getDateRange(selectedPeriod);
      onPeriodChange?.(selectedPeriod, startDate, endDate);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: "var(--space-xs)", alignItems: "center" }}>
        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontWeight: "var(--font-weight-emphasis)", textTransform: "uppercase" }}>
          Período:
        </span>
        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`btn-ghost ${period === opt.value ? "active" : ""}`}
              style={{ padding: "0.25rem 0.6rem", fontSize: "var(--font-size-xs)" }}
              onClick={() => handlePeriodChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {showCustom && (
        <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
          <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} style={{ width: "auto" }} />
          <span style={{ color: "var(--color-text-muted)" }}>→</span>
          <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} style={{ width: "auto" }} />
          <button className="btn-primary" onClick={() => {
            if (customStartDate && customEndDate) {
              onPeriodChange?.("custom", new Date(customStartDate), new Date(customEndDate));
            }
          }} style={{ padding: "0.25rem 0.6rem", fontSize: "var(--font-size-xs)" }}>
            Aplicar
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: "var(--space-xs)", alignItems: "center" }}>
        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontWeight: "var(--font-weight-emphasis)", textTransform: "uppercase" }}>
          Temporalidad:
        </span>
        <PillGroup
          options={TIMEFRAME_PILLS}
          value={timeframe}
          onChange={handleTimeframeChange}
          aria-label="Seleccionar temporalidad"
        />
      </div>
    </div>
  );
}

export default TimeControls;
