import React, { useState, useEffect, useRef } from "react";
import {
  BarChart2, BookOpen, TrendingUp, Building2, Newspaper,
  Cpu, Play, ChevronDown, Calendar,
} from "lucide-react";
import { getMarketQuotes } from "../../../services/signals/marketApi";
import {
  runSimulation,
  ALL_CORES,
  ALL_SUBCORES,
  CANONICAL_ESTRATEGIAS,
  type CoreId,
  type SubCoreIndicador,
  type SimulationRequestPayload,
  type SimulationResponse,
} from "../../../services/signals/confluenceTableApi";
import { TermStrategyModal, type TermStrategyParams } from "./TermStrategyModal";
import { CoverageParamsModal, type CoverageModalParams } from "./CoverageParamsModal";
import { WheelParamsModal, type WheelModalParams } from "./WheelParamsModal";
import { useSignalStore } from "../../../store/signals";

// ─── Panel CSS ─────────────────────────────────────────────────────────────────
// Uses only real Revolut design-system tokens from tokens.css.
const PANEL_CSS = `
  .sim-panel { font-family: var(--font-family); }

  /* ── Custom select trigger ── */
  .sim-trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 7px 10px;
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text);
    font-family: var(--font-family);
    font-size: var(--font-size-xs);
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    outline: none;
    transition: border-color var(--duration-fast) var(--easing-standard),
                box-shadow var(--duration-fast) var(--easing-standard);
  }
  .sim-trigger:hover { border-color: rgba(255,255,255,0.26); }
  .sim-trigger.is-open,
  .sim-trigger:focus {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px var(--color-accent-subtle);
  }

  /* ── Dropdown list ── */
  .sim-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    z-index: 300;
    box-shadow: 0 8px 28px rgba(0,0,0,0.65);
    max-height: 220px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .sim-dropdown::-webkit-scrollbar { width: 4px; }
  .sim-dropdown::-webkit-scrollbar-track { background: transparent; }
  .sim-dropdown::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 2px; }

  .sim-dd-item {
    padding: 7px 10px;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    cursor: pointer;
    user-select: none;
    transition: background var(--duration-fast) var(--easing-standard),
                color var(--duration-fast) var(--easing-standard);
  }
  .sim-dd-item:hover { background: rgba(255,255,255,0.06); color: var(--color-text); }
  .sim-dd-item.active {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
    font-weight: 600;
  }

  /* ── Date input ── */
  .sim-date {
    width: 100%;
    padding: 7px 10px;
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text);
    font-family: var(--font-family);
    font-size: var(--font-size-xs);
    font-weight: 500;
    outline: none;
    color-scheme: dark;
    -webkit-appearance: none;
    transition: border-color var(--duration-fast) var(--easing-standard),
                box-shadow var(--duration-fast) var(--easing-standard);
  }
  .sim-date::-webkit-calendar-picker-indicator {
    filter: invert(0.7);
    cursor: pointer;
    opacity: 0.6;
  }
  .sim-date::-webkit-calendar-picker-indicator:hover { opacity: 1; }
  .sim-date:focus {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px var(--color-accent-subtle);
  }
  .sim-date:hover:not(:focus) { border-color: rgba(255,255,255,0.26); }

  /* ── Chips ── */
  .sim-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px 5px 8px;
    border-radius: var(--radius-pill);
    cursor: pointer;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-emphasis);
    font-family: var(--font-family);
    border-width: 1px;
    border-style: solid;
    transition: background var(--duration-fast) var(--easing-standard),
                border-color var(--duration-fast) var(--easing-standard),
                color var(--duration-fast) var(--easing-standard),
                opacity var(--duration-fast) var(--easing-standard);
  }
  .sim-chip:hover { opacity: 0.8; }

  /* ── Segmented control buttons ── */
  .sim-seg {
    flex: 1;
    padding: 8px 12px;
    border: none;
    font-weight: var(--font-weight-emphasis);
    font-size: var(--font-size-xs);
    cursor: pointer;
    font-family: var(--font-family);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    transition: background var(--duration-fast) var(--easing-standard),
                color var(--duration-fast) var(--easing-standard);
  }

  /* ── Execute button ── */
  .sim-exec {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 20px;
    background: var(--color-accent);
    color: #fff;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-family);
    font-weight: var(--font-weight-bold);
    font-size: var(--font-size-xs);
    letter-spacing: 0.03em;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background var(--duration-fast) var(--easing-standard),
                transform var(--duration-fast) var(--easing-standard);
  }
  .sim-exec:hover:not(:disabled) { background: var(--color-accent-hover); transform: translateY(-1px); }
  .sim-exec:active:not(:disabled) { transform: translateY(0); }
  .sim-exec:disabled { opacity: 0.6; cursor: not-allowed; }
`;

// ─── Metadata ─────────────────────────────────────────────────────────────────
const CORE_META: Record<CoreId, { label: string; icon: React.ReactNode; tooltip: string }> = {
  A_INDICADORES:  { label: "Indicadores",   icon: <BarChart2 size={13} />,  tooltip: "Señales técnicas clásicas (RSI, MACD, EMA). Analiza momentum y tendencia a través de indicadores matemáticos." },
  A_FUNDAMENTAL:  { label: "Fundamental",   icon: <BookOpen size={13} />,   tooltip: "Datos de balance, ingresos y valoración. Evalúa la salud económica y el valor intrínseco de la empresa." },
  A_TECNICO:      { label: "Técnico",       icon: <TrendingUp size={13} />, tooltip: "Patrones de precio y volumen en el chart. Detecta soportes, resistencias y formaciones técnicas clave." },
  A_INSTITUCIONAL:{ label: "Institucional", icon: <Building2 size={13} />,  tooltip: "Actividad de grandes capitales: fondos, opciones institucionales y flujo de dinero inteligente (smart money)." },
  A_NOTICIAS:     { label: "Noticias",      icon: <Newspaper size={13} />,  tooltip: "Sentimiento del mercado basado en noticias y eventos recientes que afectan directamente al ticker." },
  A_IA:           { label: "IA",            icon: <Cpu size={13} />,        tooltip: "Motor de inteligencia artificial que sintetiza señales multi-fuente y detecta patrones no lineales." },
};

const SUBCORE_TOOLTIP: Record<string, string> = {
  RSI:  "Relative Strength Index — mide si el activo está sobrecomprado (>70) o sobrevendido (<30).",
  MACD: "Moving Average Convergence/Divergence — señal de cambio de tendencia por cruce de medias exponenciales.",
  EMA:  "Exponential Moving Average — media dinámica que pondera más el precio reciente para reducir el ruido.",
  ADX:  "Average Directional Index — cuantifica la fuerza de la tendencia sin importar su dirección.",
  BB:   "Bandas de Bollinger — mide volatilidad y marca niveles dinámicos de soporte y resistencia.",
};

// ─── Sub-components ────────────────────────────────────────────────────────────
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div style={{
          position: "absolute",
          bottom: "calc(100% + 8px)",
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--color-surface-raised)",
          color: "var(--color-text)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          padding: "0.45rem 0.65rem",
          fontSize: "var(--font-size-xs)",
          lineHeight: 1.5,
          whiteSpace: "normal",
          width: "180px",
          textAlign: "center",
          zIndex: 100,
          pointerEvents: "none",
          boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
        }}>
          {text}
          <div style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderTop: "5px solid var(--color-border)",
          }} />
        </div>
      )}
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <span style={{
        fontSize: "var(--font-size-xs)",
        fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.1em",
        color: "var(--color-text-muted)",
        opacity: 0.72,
      }}>
        {label}
      </span>
      {children}
    </div>
  );
}

// ─── Custom select dropdown ────────────────────────────────────────────────────
interface SelectOption { value: string; label: string }

function CustomSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className={`sim-trigger${open ? " is-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedLabel}
        </span>
        <ChevronDown
          size={12}
          style={{
            flexShrink: 0,
            color: "var(--color-text-muted)",
            transition: `transform var(--duration-fast) var(--easing-standard)`,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && (
        <div className="sim-dropdown" role="listbox">
          {options.map((opt) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={value === opt.value}
              className={`sim-dd-item${value === opt.value ? " active" : ""}`}
              onPointerDown={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Date input (color-scheme: dark forces correct chrome rendering) ───────────
function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      <input
        type="date"
        className="sim-date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ─── Segmented risk control ────────────────────────────────────────────────────
const RISK_OPTS: Array<{
  key: "BAJO" | "MEDIO" | "ALTO";
  label: string;
  activeColor: string;
  activeBg: string;
}> = [
  { key: "BAJO",  label: "Bajo",  activeColor: "var(--color-buy)",     activeBg: "rgba(0,168,126,0.15)" },
  { key: "MEDIO", label: "Medio", activeColor: "var(--color-accent)",  activeBg: "var(--color-accent-subtle)" },
  { key: "ALTO",  label: "Alto",  activeColor: "var(--color-warning)", activeBg: "rgba(236,126,0,0.15)" },
];

function RiskSegmented({
  value,
  onChange,
}: {
  value: "BAJO" | "MEDIO" | "ALTO";
  onChange: (v: "BAJO" | "MEDIO" | "ALTO") => void;
}) {
  return (
    <div style={{ display: "flex", gap: "6px" }}>
      {RISK_OPTS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          className="sim-seg"
          onClick={() => onChange(opt.key)}
          aria-pressed={value === opt.key}
          style={{
            flex: 1,
            borderRadius: "var(--radius-sm)",
            border: `1px solid ${value === opt.key ? opt.activeColor : "var(--color-border)"}`,
            background: value === opt.key ? opt.activeBg : "var(--color-surface-raised)",
            color: value === opt.key ? opt.activeColor : "var(--color-text-muted)",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Chip button ───────────────────────────────────────────────────────────────
function ChipButton({
  active,
  onClick,
  icon,
  label,
  tooltip,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  tooltip: string;
}) {
  return (
    <Tooltip text={tooltip}>
      <button
        type="button"
        className="sim-chip"
        onClick={onClick}
        aria-pressed={active}
        style={{
          background:  active ? "var(--color-accent-subtle)" : "var(--color-surface-raised)",
          borderColor: active ? "var(--color-accent)" : "var(--color-border)",
          color:       active ? "var(--color-accent)" : "var(--color-text-muted)",
        }}
      >
        <span style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: active ? "var(--color-accent)" : "var(--color-border)",
          flexShrink: 0,
          display: "inline-block",
          transition: `background var(--duration-fast) var(--easing-standard)`,
        }} />
        {icon && <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>}
        {label}
      </button>
    </Tooltip>
  );
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const TERM_STRATEGIES = new Set(["CALENDAR_SPREAD", "DIAGONAL_SPREAD"]);
function isTermStrategy(e: string)     { return TERM_STRATEGIES.has(e); }
function isCoverageStrategy(e: string) { return e === "COVERED_CALL"; }
function isWheelStrategy(e: string)    { return e === "WHEEL"; }

const DEFAULT_TERM_PARAMS: TermStrategyParams = {
  optionStyle: "CALL",
  strikeShort: 0,
  strikeLong: 0,
  expirationShort: new Date().toISOString().slice(0, 10),
  expirationLong: new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10),
  premiumShort: 0,
  premiumLong: 0,
  contracts: 1,
  riskFreeRate: 0.05,
};

const DEFAULT_COVERAGE_PARAMS: CoverageModalParams = {
  currentPrice: 0,
  shares: 100,
  riskTolerancePct: 0.05,
};

// FIC: Default params for Wheel modal — isolated from CoverageModalParams. (EN)
// FIC: Parámetros por defecto para el modal Wheel — aislados de CoverageModalParams. (ES)
const DEFAULT_WHEEL_PARAMS: WheelModalParams = {
  csp: {
    ticker: "",
    currentPrice: 0,
    capitalDisponible: 0,
    strikePut: 0,
    primaPut: 0,
    contratos: 1,
  },
  cc: {
    acciones: 100,
    costoPromedio: 0,
    strikeCall: 0,
    primaCall: 0,
    contratos: 1,
  },
};

type Preset = "2A" | "1A" | "6M" | "3M" | "1M";
const PRESETS: Preset[] = ["2A", "1A", "6M", "3M", "1M"];
const TIMEFRAMES: Array<"1m" | "5m" | "15m" | "1h" | "4h" | "1d"> = ["1m", "5m", "15m", "1h", "4h", "1d"];

const PRESET_OPTIONS: SelectOption[]    = PRESETS.map((p) => ({ value: p, label: p }));
const TIMEFRAME_OPTIONS: SelectOption[] = TIMEFRAMES.map((t) => ({ value: t, label: t }));
const STRATEGY_OPTIONS: SelectOption[]  = CANONICAL_ESTRATEGIAS.map((s) => ({
  value: s,
  label: s.replace(/_/g, " "),
}));

function isoToday(): string       { return new Date().toISOString().slice(0, 10); }
function isoPlusDays(n: number)   { return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10); }

// ─── Section label style (shared) ─────────────────────────────────────────────
const sectionLabelStyle: React.CSSProperties = {
  fontSize: "var(--font-size-xs)",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "var(--color-text-muted)",
  opacity: 0.72,
  display: "block",
  marginBottom: "8px",
};

// ─── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  ticket: string;
  onResult: (result: SimulationResponse) => void;
  onExecute?: (activeCoreIds: CoreId[]) => void;
  onStrategyChange?: (estrategia: string) => void;
  onCoverageParamsConfirmed?: (params: CoverageModalParams, kind: string) => void;
  // FIC: Callback fired when user clicks "Analizar Wheel" — lifts params to MainDashboard. (EN)
  // FIC: Callback al hacer click en "Analizar Wheel" — sube params a MainDashboard. (ES)
  onWheelParamsConfirmed?: (params: WheelModalParams) => void;
}

// ─── Main component ────────────────────────────────────────────────────────────
export function SimulationControlPanel({
  ticket,
  onResult,
  onExecute,
  onStrategyChange,
  onCoverageParamsConfirmed,
  onWheelParamsConfirmed,
}: Props) {
  const { incrementSimulationRunCount } = useSignalStore();
  const [preset, setPreset]               = useState<Preset>("3M");
  const [estrategiaFrom, setEstrategiaFrom] = useState(isoToday());
  const [estrategiaTo, setEstrategiaTo]   = useState(isoPlusDays(30));
  const [temporalidad, setTemporalidad]   = useState<"1m" | "5m" | "15m" | "1h" | "4h" | "1d">("1h");
  const [estrategia, setEstrategia]       = useState("IRON_CONDOR");
  const [tolerancia, setTolerancia]       = useState<"BAJO" | "MEDIO" | "ALTO">("MEDIO");
  const [coresOn, setCoresOn]             = useState<Record<CoreId, boolean>>(
    ALL_CORES.reduce((acc, c) => ({ ...acc, [c]: true }), {} as Record<CoreId, boolean>)
  );
  const [indicadoresOn, setIndicadoresOn] = useState<Record<SubCoreIndicador, boolean>>(
    ALL_SUBCORES.reduce((acc, s) => ({ ...acc, [s]: true }), {} as Record<SubCoreIndicador, boolean>)
  );
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [termModalOpen, setTermModalOpen] = useState(false);
  const [termParams, setTermParams]       = useState<TermStrategyParams>(DEFAULT_TERM_PARAMS);
  const [coverageModalOpen, setCoverageModalOpen] = useState(false);
  const [coverageParams, setCoverageParams]       = useState<CoverageModalParams>(DEFAULT_COVERAGE_PARAMS);
  // FIC: Wheel modal state — independent from Coverage modal state. (EN)
  // FIC: Estado del modal Wheel — independiente del estado del modal Coverage. (ES)
  const [wheelModalOpen, setWheelModalOpen]       = useState(false);
  const [wheelParams, setWheelParams]             = useState<WheelModalParams>({ ...DEFAULT_WHEEL_PARAMS, csp: { ...DEFAULT_WHEEL_PARAMS.csp, ticker: ticket } });

  useEffect(() => {
    if (!coverageModalOpen || coverageParams.currentPrice > 0) return;
    getMarketQuotes([ticket])
      .then((data) => {
        const q = data.quotes.find((qt) => qt.symbol === ticket.toUpperCase());
        if (q && q.price > 0) setCoverageParams((prev) => ({ ...prev, currentPrice: q.price }));
      })
      .catch(() => { /* user can enter manually */ });
  }, [coverageModalOpen, ticket, coverageParams.currentPrice]);

  // FIC: Fetch current price when Wheel modal opens, same pattern as Coverage modal. (EN)
  // FIC: Obtiene el precio actual al abrir el modal Wheel, mismo patrón que Coverage. (ES)
  useEffect(() => {
    if (!wheelModalOpen || wheelParams.csp.currentPrice > 0) return;
    getMarketQuotes([ticket])
      .then((data) => {
        const q = data.quotes.find((qt) => qt.symbol === ticket.toUpperCase());
        if (q && q.price > 0) setWheelParams((prev) => ({ ...prev, csp: { ...prev.csp, currentPrice: q.price } }));
      })
      .catch(() => { /* user can enter manually */ });
  }, [wheelModalOpen, ticket, wheelParams.csp.currentPrice]);

  const handleEstrategiaChange = (e: string) => {
    setEstrategia(e);
    onStrategyChange?.(e);
    if (isTermStrategy(e))          setTermModalOpen(true);
    else if (isCoverageStrategy(e)) setCoverageModalOpen(true);
    // FIC: Wheel opens its own independent modal — does not touch Coverage flow. (EN)
    // FIC: Wheel abre su propio modal independiente — no toca el flujo de Coverage. (ES)
    else if (isWheelStrategy(e))    setWheelModalOpen(true);
  };

  const toggleCore = (c: CoreId)          => setCoresOn((p) => ({ ...p, [c]: !p[c] }));
  const toggleSub  = (s: SubCoreIndicador) => setIndicadoresOn((p) => ({ ...p, [s]: !p[s] }));

  const run = async () => {
    setLoading(true);
    setError(null);
    const activeCoreIds = ALL_CORES.filter((c) => coresOn[c]);
    onExecute?.(activeCoreIds);
    try {
      const payload: SimulationRequestPayload = {
        ticket,
        rangoHistorico: preset,
        rangoEstrategia: { from: estrategiaFrom, to: estrategiaTo },
        temporalidad,
        runtimeMode: "OFFLINE",
        coresHabilitados: ALL_CORES.filter((c) => coresOn[c]),
        indicadoresHabilitados: ALL_SUBCORES.filter((s) => indicadoresOn[s]),
        estrategia,
        toleranciaRiesgo: tolerancia,
      };
      const result = await runSimulation(payload);
      onResult(result);
      incrementSimulationRunCount();
    } catch (err) {
      setError(err instanceof Error ? err.message : "simulation_failed");
    } finally {
      setLoading(false);
    }
  };

  const periodDays = Math.max(
    0,
    Math.round(
      (new Date(estrategiaTo).getTime() - new Date(estrategiaFrom).getTime()) / 86_400_000
    )
  );

  return (
    <>
      <style>{PANEL_CSS}</style>

      <section
        className="card sim-panel"
        style={{ padding: 0, overflow: "visible", display: "flex", flexDirection: "column" }}
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: "1px solid var(--color-border-subtle)",
        }}>
          <span style={{
            fontSize: "var(--font-size-xs)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--color-text-muted)",
          }}>
            Panel de control · Simulación
          </span>
          <span style={{
            fontSize: "var(--font-size-xs)",
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: "var(--radius-pill)",
            background: "rgba(0,168,126,0.18)",
            color: "var(--color-buy)",
            letterSpacing: "0.02em",
            maxWidth: "200px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {estrategia.replace(/_/g, " ")}
          </span>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────────── */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "14px", flex: 1 }}>

          {/* Row 1: Rango Histórico · Desde · Hasta */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <FieldLabel label="Rango Histórico">
              <CustomSelect
                value={preset}
                onChange={(v) => setPreset(v as Preset)}
                options={PRESET_OPTIONS}
              />
            </FieldLabel>

            <FieldLabel label="Estrategia Desde">
              <DateInput value={estrategiaFrom} onChange={setEstrategiaFrom} />
            </FieldLabel>

            <FieldLabel label="Estrategia Hasta">
              <DateInput value={estrategiaTo} onChange={setEstrategiaTo} />
            </FieldLabel>
          </div>

          {/* Row 2: Temporalidad · Estrategia · Tolerancia */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <FieldLabel label="Temporalidad">
              <CustomSelect
                value={temporalidad}
                onChange={(v) => setTemporalidad(v as typeof temporalidad)}
                options={TIMEFRAME_OPTIONS}
              />
            </FieldLabel>

            <FieldLabel label="Estrategia">
              <CustomSelect
                value={estrategia}
                onChange={handleEstrategiaChange}
                options={STRATEGY_OPTIONS}
              />
            </FieldLabel>

            <FieldLabel label="Tolerancia al Riesgo">
              <RiskSegmented value={tolerancia} onChange={setTolerancia} />
            </FieldLabel>
          </div>

          {/* Divider */}
          <hr style={{ border: "none", borderTop: "1px solid var(--color-border-subtle)", margin: "2px 0" }} />

          {/* Cores de Análisis */}
          <div>
            <span style={sectionLabelStyle}>Cores de Análisis</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {ALL_CORES.map((c) => {
                const { label, icon, tooltip } = CORE_META[c];
                return (
                  <ChipButton
                    key={c}
                    active={coresOn[c]}
                    onClick={() => toggleCore(c)}
                    icon={icon}
                    label={label}
                    tooltip={tooltip}
                  />
                );
              })}
            </div>
          </div>

          {/* Indicadores Técnicos */}
          <div>
            <span style={sectionLabelStyle}>Indicadores Técnicos</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {ALL_SUBCORES.map((s) => (
                <ChipButton
                  key={s}
                  active={indicadoresOn[s]}
                  onClick={() => toggleSub(s)}
                  label={s}
                  tooltip={SUBCORE_TOOLTIP[s] ?? s}
                />
              ))}
            </div>
          </div>

          {error && (
            <div style={{ color: "var(--color-sell)", fontSize: "var(--font-size-xs)", fontWeight: 500 }}>
              Error: {error}
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          borderTop: "1px solid var(--color-border-subtle)",
          background: "var(--color-surface-raised)",
          borderRadius: "0 0 var(--radius-lg) var(--radius-lg)",
          gap: "12px",
        }}>
          <span style={{
            fontSize: "var(--font-size-xs)",
            color: "var(--color-text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}>
            <Calendar size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
            Estrategia activa:{" "}
            <strong style={{ color: "var(--color-text)", fontWeight: 600 }}>
              {estrategia.replace(/_/g, " ")}
            </strong>
            <span style={{ opacity: 0.4 }}>·</span>
            Periodo:{" "}
            <strong style={{ color: "var(--color-text)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {periodDays} días
            </strong>
          </span>

          <button
            type="button"
            className="sim-exec"
            onClick={run}
            disabled={loading}
          >
            <span style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              borderRadius: "6px",
              background: "rgba(255,255,255,0.18)",
              flexShrink: 0,
            }}>
              <Play size={11} fill="currentColor" strokeWidth={0} />
            </span>
            {loading ? "Ejecutando…" : "Ejecutar Simulación"}
          </button>
        </div>
      </section>

      <TermStrategyModal
        open={termModalOpen}
        estrategia={estrategia}
        params={termParams}
        onChange={setTermParams}
        onClose={() => setTermModalOpen(false)}
      />
      <CoverageParamsModal
        open={coverageModalOpen}
        estrategia={estrategia}
        ticker={ticket}
        params={coverageParams}
        onChange={setCoverageParams}
        onClose={() => setCoverageModalOpen(false)}
        onConfirm={(params) => onCoverageParamsConfirmed?.(params, estrategia)}
      />
      {/* FIC: WheelParamsModal — coexists with CoverageParamsModal, fully independent. (EN) */}
      {/* FIC: WheelParamsModal — coexiste con CoverageParamsModal, completamente independiente. (ES) */}
      <WheelParamsModal
        open={wheelModalOpen}
        ticker={ticket}
        params={wheelParams}
        onChange={setWheelParams}
        onClose={() => setWheelModalOpen(false)}
        onConfirm={(params) => onWheelParamsConfirmed?.(params)}
      />
    </>
  );
}

export default SimulationControlPanel;
