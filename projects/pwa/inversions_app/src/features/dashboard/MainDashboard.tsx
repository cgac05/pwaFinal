// FIC: Main operational dashboard — AppShell 4-zone layout with ActivityBar, LeftPanel, and ChatPanel.
// FIC: Dashboard operativo principal — layout AppShell de 4 zonas con ActivityBar, LeftPanel y ChatPanel.

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Trash2 } from "lucide-react";
import { GlobalChatDrawer } from "../../pages/ai/GlobalChatDrawer";
import { SuperChart } from "./SuperChart";
import { OptionChainTableConnected } from "../options/OptionChainTable";

import { TimeControls } from "./TimeControls";
import { ConfluenceSignalsTable } from "./ConfluenceSignalsTable";
import { SimulationControlPanel } from "./simulation/SimulationControlPanel";
import { SimulatorStrategySection } from "./simulation/SimulatorStrategySection";
import { FundamentalAnalysisPanel } from "./FundamentalAnalysisPanel";
import { NewsSection } from "./NewsSection";
import type { CoverageModalParams } from "./simulation/CoverageParamsModal";
import type { OptionStrategyAnalysis } from "./simulation/OptionStrategyParamsModal";
import type { WheelModalParams } from "./simulation/WheelParamsModal";
import type { SpreadModalParams } from "./simulation/SpreadParamsModal";
import { TechnicalAnalysisExtendedSection } from "./TechnicalAnalysisExtendedSection";
import { AppShell } from "../../layouts/AppShell";
import { ActivityBar } from "../../components/ui/ActivityBar";
import { LeftPanel } from "../sidebar/LeftPanel";
import { Badge } from "../../components/ui/Badge";
import type { ConfluenceSignalRow, SimulationResponse, CoreId, SignalMetrics } from "../../services/signals/confluenceTableApi";
import { buildComplexStrategyRows, STRATEGY_CORE } from "../../services/strategies/buildStrategyRows";
import { ComplexStrategyModal } from "./simulation/ComplexStrategyModal";
import type { FromChainResponse } from "../../services/strategies/strategyApi";
import { useSignalStore } from "../../store/signals";
import { useAppShellStore } from "../../store/appShell";
import { useInstitutionalStore, setInstitutionalLoading, setInstitutionalResult, setInstitutionalError } from "../../store/institutional";
import { getInstitutionalAnalysis } from "../../services/institutional/institutionalApi";
import type { FundamentalAnalysisResponse } from "../../services/fundamental/fundamentalApi";
import { formatCurrency } from "../../utils/format";
import { Tooltip } from "../../components/ui/Tooltip";
// FIC: US-5 — compact buy/sell/hold counter chip shown above the confluence table. (EN)
// FIC: US-5 — chip compacto de conteo compra/venta/hold mostrado sobre la tabla. (ES)
function SignalMetricChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "6px",
      padding: "5px 12px", borderRadius: "var(--radius-pill)",
      border: `1px solid ${color}`, background: "var(--color-surface-raised)",
      fontSize: "var(--font-size-xs)", fontWeight: "var(--font-weight-emphasis)" as any,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block" }} />
      <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <strong style={{ color, fontVariantNumeric: "tabular-nums" }}>{value}</strong>
    </span>
  );
}

export function MainDashboard() {
  const isTestEnv = import.meta.env.MODE === "test";
  const [timeframe, setTimeframe] = useState("1d");
  const [periodRange, setPeriodRange] = useState<{ startDate: Date; endDate: Date } | null>(null);
  const [simulationRows, setSimulationRows] = useState<ConfluenceSignalRow[] | undefined>(undefined);
  const [simulationVerdict, setSimulationVerdict] = useState<{ verdict?: unknown; score?: number; degraded?: boolean } | null>(null);
  const [activeSimulationStrategy, setActiveSimulationStrategy] = useState("");
  const [coverageRequest, setCoverageRequest] = useState<{ params: CoverageModalParams; kind: string } | null>(null);
  const [optionStrategyAnalysis, setOptionStrategyAnalysis] = useState<OptionStrategyAnalysis | null>(null);
  const [fundamentalAnalysis, setFundamentalAnalysis] = useState<FundamentalAnalysisResponse | null>(null);
  const [fundamentalAutoRunKey, setFundamentalAutoRunKey] = useState(0);
  const [wheelSummary, setWheelSummary] = useState<WheelModalParams | null>(null);
  const [termResult, setTermResult] = useState<any | null>(null);
  const [complexResult, setComplexResult] = useState<FromChainResponse | null>(null);
  const [strategyModalRow, setStrategyModalRow] = useState<ConfluenceSignalRow | null>(null);
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const [simulationMetrics, setSimulationMetrics] = useState<SignalMetrics | null>(null);
  const [institutionalCoreWasActive, setInstitutionalCoreWasActive] = useState(false);
  const [, setNewsDateRange] = useState<string | undefined>(undefined);
  const [spreadRequest, setSpreadRequest] = useState<{ params: SpreadModalParams; kind: string } | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [selectedStrikeData, setSelectedStrikeData] = useState<{
    strike: number; type: "call" | "put"; premium: number; iv: number;
    expiration?: string; underlyingPrice?: number; estimatedRiskFreeRate?: number;
  } | null>(null);
  const [activeChartTab, setActiveChartTab] = useState<"chart" | "chain">("chart");

  const { selectedInstrument, selectedStrike, runtimeMode, operationalMode, setSelectedStrike } = useSignalStore();
  const { setAnalysisCategory } = useAppShellStore();
  const { results: institutionalResults, loading: institutionalLoading, errors: institutionalErrors } = useInstitutionalStore();

  const selectedSymbol = selectedInstrument?.symbol ?? "SPY";

  // FIC: Clear simulation results and institutional flag when the user selects a new ticker. (EN)
  // FIC: Limpiar resultados de simulación y flag institucional cuando el usuario selecciona un nuevo ticker. (ES)
  const prevSymbolRef = useRef(selectedSymbol);
  useEffect(() => {
    if (prevSymbolRef.current !== selectedSymbol) {
      prevSymbolRef.current = selectedSymbol;
      setSimulationRows(undefined);
      setSimulationVerdict(null);
      setSimulationMetrics(null);
      setNewsDateRange(undefined);
      setInstitutionalCoreWasActive(false);
      setOptionStrategyAnalysis(null);
      setFundamentalAnalysis(null);
      setWheelSummary(null);
      setTermResult(null);
      setComplexResult(null);
      setSelectedStrikeData(null);
      setSelectedStrike(undefined);
    }
  }, [selectedSymbol, setSelectedStrike]);

  const handleSimulationResult = useCallback((result: SimulationResponse) => {
    setSimulationRows((prev) => {
      // Preserve any A_ESTRATEGIA rows (from complex strategy execution) that were
      // added by handleComplexResult, since onResult fires after onComplexResult.
      const existing = prev ?? [];
      const strategyRows = existing.filter((r) => r.core === STRATEGY_CORE);
      return [...result.table, ...strategyRows];
    });
    setSimulationVerdict(result.verdict);
    // FIC: US-5 — prefer backend-computed metrics; fall back to a client-side count. (EN)
    if (result.signalMetrics) {
      setSimulationMetrics(result.signalMetrics);
    } else {
      const rows = result.table ?? [];
      setSimulationMetrics({
        buy: rows.filter((r) => r.tipoSenal === "CALL").length,
        sell: rows.filter((r) => r.tipoSenal === "PUT").length,
        hold: rows.filter((r) => r.tipoSenal === "HOLD").length,
        total: rows.length,
      });
    }
  }, []);

  // FIC: US-1 / US-3 — clear the results table and its derived state on demand. (EN)
  // FIC: US-1 / US-3 — limpia la tabla de resultados y su estado derivado a demanda. (ES)
  const handleClearTable = useCallback(() => {
    setSimulationRows(undefined);
    setSimulationVerdict(null);
    setSimulationMetrics(null);
    setSpreadRequest(null);
    setInstitutionalCoreWasActive(false);
  }, []);

  const handleCoverageConfirmed = useCallback(
    (params: CoverageModalParams, kind: string) => setCoverageRequest({ params, kind }),
    []
  );

  const handleSpreadConfirmed = useCallback(
    (params: SpreadModalParams, kind: string) => setSpreadRequest({ params, kind }),
    []
  );

  const handleOptionStrategyCalculated = useCallback((analysis: OptionStrategyAnalysis) => {
    setOptionStrategyAnalysis(analysis);
    setActiveSimulationStrategy(analysis.strategy);
  }, []);

  const handleWheelConfirmed = useCallback((params: WheelModalParams) => {
    setWheelSummary(params);
  }, []);

  const handleTermResult = useCallback((data: any) => {
    setTermResult(data);
  }, []);

  const handleComplexResult = useCallback((result: FromChainResponse, strategy: string, timeframe?: string) => {
    setComplexResult(result);
    setActiveSimulationStrategy(strategy);
    setStrategyError(null);
    try {
      const payload = buildComplexStrategyRows(result, strategy, selectedSymbol, timeframe);
      setSimulationRows((prev) => {
        const existing = prev ?? [];
        const filtered = existing.filter((r) => r.core !== STRATEGY_CORE);
        return [...filtered, ...payload.rows];
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido al procesar la estrategia";
      setStrategyError(msg);
    }
  }, [selectedSymbol]);

  const handleStrategyRowClick = useCallback((row: ConfluenceSignalRow) => {
    setStrategyModalRow(row);
  }, []);

  const handleCloseStrategyModal = useCallback(() => {
    setStrategyModalRow(null);
  }, []);

  // FIC: Writes selected strike to global store so CoverageStrategyModal can read it from anywhere. (EN)
  // FIC: Escribe el strike seleccionado en el store global para que CoverageStrategyModal lo lea desde cualquier lugar. (ES)
  const handleStrikeSelect = useCallback(
    (
      strike: number,
      type: "call" | "put",
      premium: number,
      iv: number,
      meta?: {
        expiration: string;
        underlyingPrice: number;
        callPremium: number;
        putPremium: number;
        estimatedRiskFreeRate?: number;
      }
    ) => {
      const selected = { strike, type, premium, iv, ...meta };
      setSelectedStrikeData(selected);
      setSelectedStrike(selected);
    },
    [setSelectedStrike]
  );

  // FIC: Called when user clicks Execute — fires institutional analysis if A_INSTITUCIONAL core is active. (EN)
  // FIC: Llamado cuando el usuario hace clic en Ejecutar — dispara análisis institucional si el core A_INSTITUCIONAL está activo. (ES)
  const handleSimulationExecute = useCallback((activeCoreIds: CoreId[]) => {
    const institutionalActive = activeCoreIds.includes("A_INSTITUCIONAL");
    setInstitutionalCoreWasActive(institutionalActive);

    if (activeCoreIds.includes("A_FUNDAMENTAL")) {
      setFundamentalAutoRunKey((key) => key + 1);
    }

    // Activate institutional columns in the confluence table immediately
    if (institutionalActive) setAnalysisCategory("institutional");

    if (!institutionalActive || !selectedSymbol) return;

    const controller = new AbortController();
    setInstitutionalLoading(selectedSymbol, true);
    getInstitutionalAnalysis(selectedSymbol, "daily", "medium", controller.signal)
      .then((data) => setInstitutionalResult(selectedSymbol, data))
      .catch((err) => {
        if ((err as Error).name !== "AbortError") {
          setInstitutionalError(selectedSymbol, (err as Error).message);
        }
      });
    return () => controller.abort();
  }, [selectedSymbol, setAnalysisCategory]);

  // FIC: Badge color for runtime mode — cobalt for demo, warning for real, muted for offline. (EN)
  const modeBadgeColor =
    runtimeMode === "offline" ? "var(--color-text-muted)" :
    operationalMode === "real" ? "var(--color-warning)" :
    "var(--color-accent)";

  const modeBadgeLabel =
    runtimeMode === "offline" ? "Offline" :
    operationalMode === "real" ? "Real" :
    "Demo";

  // FIC: Placeholder section shown for analyses not yet implemented in this sprint. (EN)
  // FIC: Sección placeholder para análisis no implementados aún en este sprint. (ES)
  const PlaceholderSection = ({ title, description }: { title: string; description: string }) => (
    <section className="card" style={{ padding: "var(--space-lg)", opacity: 0.5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
        <h2 style={{ margin: 0, fontSize: "var(--font-size-base)" }}>{title}</h2>
        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", background: "var(--color-surface-raised)", padding: "2px 8px", borderRadius: "var(--radius-xs)" }}>
          Próximamente
        </span>
      </div>
      <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>{description}</p>
    </section>
  );

  const instData = institutionalResults[selectedSymbol.toUpperCase()];
  const instIsLoading = institutionalLoading[selectedSymbol.toUpperCase()];
  const instError = institutionalErrors[selectedSymbol.toUpperCase()];
  const showInstitutionalSection = institutionalCoreWasActive;

  const mainContent = (
    <div style={{ padding: "var(--space-lg)", display: "grid", gap: "var(--space-lg)" }}>

      {/* ── Top bar: logo + mode badge only */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <Badge label="FIC" color="var(--color-accent)" size="sm" />
          <span style={{ fontWeight: "var(--font-weight-bold)", fontSize: "var(--font-size-base)" }}>Inversions</span>
          {selectedInstrument && (
            <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
              — {selectedInstrument.symbol}
              {selectedInstrument.name && ` · ${selectedInstrument.name}`}
            </span>
          )}
        </div>
        <Badge
          label={modeBadgeLabel}
          color={modeBadgeColor}
          pulse={operationalMode === "real" && runtimeMode !== "offline"}
        />
      </div>

      {/* ── Chart + Cadena de Opciones (tabs dentro de la misma card) ──── */}
      {!isTestEnv && (
        <div style={{ display: "grid", gap: "var(--space-sm)" }}>
          <div className="card" style={{ overflow: "hidden" }}>
            {/* Tab bar */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "2px",
              padding: "var(--space-xs) var(--space-sm)",
              borderBottom: "1px solid var(--color-border)",
              background: "var(--color-surface)",
            }}>
              {(["chart", "chain"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveChartTab(tab)}
                  style={{
                    background: activeChartTab === tab ? "var(--color-surface-raised)" : "transparent",
                    color: activeChartTab === tab ? "var(--color-text)" : "var(--color-text-muted)",
                    border: activeChartTab === tab ? "1px solid var(--color-border)" : "1px solid transparent",
                    borderRadius: "var(--radius-xs)",
                    padding: "0.25rem 0.85rem",
                    fontSize: "var(--font-size-xs)",
                    fontWeight: activeChartTab === tab ? "var(--font-weight-bold)" as any : "normal",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {tab === "chart" ? "Gráfico" : "Cadena de Opciones"}
                </button>
              ))}

              {/* TimeControls integrado en la barra de tabs */}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
                <TimeControls
                  symbol={selectedSymbol}
                  onTimeframeChange={(tf) => setTimeframe(tf)}
                  onPeriodChange={(_p, startDate, endDate) => setPeriodRange({ startDate, endDate })}
                />
              </div>

              {/* Strike seleccionado — visible en ambos tabs */}
              {(() => {
                const sd = selectedStrikeData ?? selectedStrike;
                if (!sd) return null;
                const isCall = sd.type === "call";
                return (
                  <span style={{
                    marginLeft: "var(--space-sm)",
                    fontSize: "var(--font-size-xs)",
                    color: isCall ? "var(--color-buy)" : "var(--color-sell)",
                    display: "flex", alignItems: "center", gap: "var(--space-sm)",
                  }}>
                    <span>Strike: ${sd.strike} {sd.type.toUpperCase()}</span>
                    <span>Prima: ${sd.premium.toFixed(2)}</span>
                    <span>IV: {(sd.iv * 100).toFixed(1)}%</span>
                  </span>
                );
              })()}
            </div>

            {/* Chart tab */}
            <div style={{ display: activeChartTab === "chart" ? "block" : "none", minHeight: 380 }}>
              <SuperChart symbol={selectedSymbol} timeframe={timeframe} startDate={periodRange?.startDate} endDate={periodRange?.endDate} />
            </div>

            {/* Chain tab */}
            <div style={{
              display: activeChartTab === "chain" ? "flex" : "none",
              flexDirection: "column",
              height: 420,
              padding: "var(--space-md)",
            }}>
              <OptionChainTableConnected onSelectStrike={handleStrikeSelect} activeStrategy={activeSimulationStrategy} />
            </div>
          </div>

        </div>
      )}

      {/* ── Strategy detail modal (triggered by clicking A_ESTRATEGIA rows in the confluence table) */}
      <ComplexStrategyModal
        isOpen={strategyModalRow !== null}
        onClose={handleCloseStrategyModal}
        row={strategyModalRow}
        result={complexResult}
      />

      {/* ── Simulation control — cores + indicators + execute */}
      <SimulationControlPanel
        ticket={selectedSymbol}
        onResult={handleSimulationResult}
        onExecute={handleSimulationExecute}
        onStrategyChange={setActiveSimulationStrategy}
        onCoverageParamsConfirmed={handleCoverageConfirmed}
        onSpreadParamsConfirmed={handleSpreadConfirmed}
        onOptionStrategyCalculated={handleOptionStrategyCalculated}
        onWheelParamsConfirmed={handleWheelConfirmed}
        onTermResult={handleTermResult}
        onComplexResult={handleComplexResult}
      />

      {/* ── Strategy error (from buildComplexStrategyRows validation) */}
      {strategyError && (
        <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", background: "rgba(248,81,73,0.08)", border: "1px solid var(--color-sell)", padding: "var(--space-md)" }}>
          <strong style={{ color: "var(--color-sell)" }}>Error de estrategia:</strong>
          <span style={{ color: "var(--color-sell)", fontSize: "0.85rem" }}>{strategyError}</span>
        </div>
      )}

      {/* ── Simulation verdict */}
      {simulationVerdict && (
        <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <strong>Verdict derivado:</strong>
          <span>
            {String(simulationVerdict.verdict)} (score {Number(simulationVerdict.score ?? 0).toFixed(3)})
            {simulationVerdict.degraded && <em style={{ color: "var(--color-text-muted)" }}> · degradado</em>}
          </span>
        </div>
      )}

      {/* ── Confluence table — empty state until simulation runs */}
      {simulationRows === undefined ? (
        <section className="card" style={{ padding: "var(--space-xl)", textAlign: "center", color: "var(--color-text-muted)" }}>
          <p style={{ fontWeight: "var(--font-weight-emphasis)", marginBottom: "var(--space-xs)" }}>
            Selecciona un instrumento y ejecuta la simulación
          </p>
          <p style={{ fontSize: "var(--font-size-sm)" }}>
            Configura los cores y presiona Ejecutar para ver la tabla de confluencia.
          </p>
        </section>
      ) : (
        <ConfluenceSignalsTable
          symbol={selectedSymbol}
          rows={simulationRows}
          activeStrategy={activeSimulationStrategy}
          fundamentalAnalysis={fundamentalAnalysis}
          onStrategyRowClick={handleStrategyRowClick}
        />
      )}

      {/* ── Institutional analysis section */}
      {showInstitutionalSection && (
        <section className="card" style={{ padding: "var(--space-lg)" }}>
          <h2 style={{ margin: "0 0 var(--space-md)" }}>Análisis Institucional — {selectedSymbol}</h2>
          {instIsLoading && (
            <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
              Cargando análisis institucional…
            </p>
          )}
          {instError && !instIsLoading && (
            <p style={{ color: "var(--color-sell)", fontSize: "var(--font-size-sm)" }}>
              Error: {instError}
            </p>
          )}
          {instData && !instIsLoading && (() => {
            const uniqueSources = [
              ...new Map(instData.sourceReports.map((s) => [s.sourceId, s])).values(),
            ];
            const ownershipPct = instData.metrics?.fundsOwnershipPct ?? 0;
            const ownershipColor =
              ownershipPct >= 70 ? "var(--color-buy)" : ownershipPct >= 40 ? "var(--color-hold)" : "var(--color-sell)";
            const ownershipLabel = ownershipPct >= 70 ? "Alto" : ownershipPct >= 40 ? "Medio" : "Bajo";
            const netFlow = instData.metrics?.netFlow ?? 0;
            const days = instData.expiration?.daysToNextOpex ?? 0;
            const opexDate = new Date(Date.now() + days * 86_400_000);
            const opexStr = opexDate.toLocaleDateString(undefined, { day: "numeric", month: "short" });
            const visibleSources = uniqueSources.slice(0, 3);
            const hiddenSources = uniqueSources.slice(3);
            const trendDir = instData.trends?.direction;
            const trendColor =
              trendDir === "bullish" ? "var(--color-buy)" :
              trendDir === "bearish" ? "var(--color-sell)" :
              "var(--color-text-muted)";

            return (
              <>
                {/* Row 1 — key metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, marginBottom: "var(--space-md)" }}>
                  {/* Tendencia */}
                  <div style={{ paddingRight: "var(--space-md)", borderRight: "1px solid var(--color-border-subtle)" }}>
                    <p style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 4px", fontWeight: 600 }}>Tendencia</p>
                    <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: trendColor }}>
                      {trendDir === "bullish" ? "▲ Bullish" : trendDir === "bearish" ? "▼ Bearish" : instData.trends ? "— Neutral" : "—"}
                    </p>
                  </div>

                  {/* Zonas detectadas */}
                  <div style={{ paddingLeft: "var(--space-md)", paddingRight: "var(--space-md)", borderRight: "1px solid var(--color-border-subtle)" }}>
                    <p style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 4px", fontWeight: 600 }}>Zonas detectadas</p>
                    <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                      {instData.zones ? `${instData.zones.support.length}S · ${instData.zones.resistance.length}R` : "—"}
                    </p>
                  </div>

                  {/* Ownership institucional */}
                  <div style={{ paddingLeft: "var(--space-md)", paddingRight: "var(--space-md)", borderRight: "1px solid var(--color-border-subtle)" }}>
                    <p style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 4px", fontWeight: 600 }}>Ownership inst.</p>
                    <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>
                      {ownershipPct.toFixed(1)}%{" "}
                      <span style={{ fontSize: 10, fontWeight: 600, color: ownershipColor }}>{ownershipLabel}</span>
                    </p>
                    <div style={{ width: "100%", height: 4, backgroundColor: "var(--color-surface-raised)", borderRadius: "var(--radius-pill)", overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(ownershipPct, 100)}%`, height: "100%", backgroundColor: ownershipColor, borderRadius: "var(--radius-pill)" }} />
                    </div>
                  </div>

                  {/* Net Flow */}
                  <div style={{ paddingLeft: "var(--space-md)" }}>
                    <p style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 4px", fontWeight: 600 }}>Net Flow</p>
                    <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: netFlow >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}>
                      {netFlow >= 0 ? "▲ " : "▼ "}{formatCurrency(netFlow)}
                    </p>
                  </div>
                </div>

                {/* Row 2 — metadata */}
                <div style={{ display: "flex", gap: "var(--space-xl)", borderTop: "1px solid var(--color-border-subtle)", paddingTop: "var(--space-sm)", alignItems: "center", flexWrap: "wrap" }}>
                  {instData.expiration && (
                    <div>
                      <p style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 2px", fontWeight: 600 }}>Próximo OpEx</p>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{opexStr} · {days}d</p>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", fontWeight: 600, marginRight: "var(--space-xs)" }}>
                      Fuentes
                    </span>
                    {visibleSources.map((s) => {
                      const label =
                        s.sourceId === "yahoo_chart" ? "Chart" :
                        s.sourceId === "sec_edgar_13f" ? "SEC 13F" :
                        s.sourceId === "finra_short_interest" ? "FINRA" :
                        s.sourceId === "yahoo_options_flow" ? "Options" :
                        s.sourceId === "yahoo_institutional" ? "Inst." :
                        s.sourceId.split("_")[0];
                      const borderColor =
                        s.status === "ok" ? "var(--color-buy)" :
                        s.status === "partial" ? "var(--color-warning)" :
                        "var(--color-border)";
                      const bg =
                        s.status === "ok" ? "rgba(0,168,126,0.10)" :
                        s.status === "partial" ? "rgba(236,126,0,0.10)" :
                        "rgba(255,255,255,0.04)";
                      const color =
                        s.status === "ok" ? "var(--color-buy)" :
                        s.status === "partial" ? "var(--color-warning)" :
                        "var(--color-text-muted)";
                      return (
                        <span
                          key={s.sourceId}
                          style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", padding: "2px 6px", borderRadius: "var(--radius-xs)", border: `1px solid ${borderColor}`, backgroundColor: bg, color, fontWeight: 600, lineHeight: "1.5" }}
                        >
                          {label}
                        </span>
                      );
                    })}
                    {hiddenSources.length > 0 && (
                      <Tooltip
                        content={hiddenSources.map((s) =>
                          s.sourceId === "yahoo_chart" ? "Chart" :
                          s.sourceId === "sec_edgar_13f" ? "SEC 13F" :
                          s.sourceId === "finra_short_interest" ? "FINRA" :
                          s.sourceId === "yahoo_options_flow" ? "Options" :
                          s.sourceId === "yahoo_institutional" ? "Inst." :
                          s.sourceId.split("_")[0]
                        ).join("\n")}
                      >
                        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", padding: "2px 6px", borderRadius: "var(--radius-xs)", border: "1px solid var(--color-border)", backgroundColor: "rgba(255,255,255,0.04)", color: "var(--color-text-muted)", fontWeight: 600, cursor: "default", lineHeight: "1.5" }}>
                          +{hiddenSources.length}
                        </span>
                      </Tooltip>
                    )}
                    <Tooltip content="Haz clic en una fila de la tabla de confluencia para ver el detalle completo.">
                      <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", marginLeft: "var(--space-xs)", cursor: "default" }}>
                        ⓘ
                      </span>
                    </Tooltip>
                  </div>
                </div>
              </>
            );
          })()}
        </section>
      )}

      {/* ── Strategy breakdown section — only visible after simulation has run */}
      {simulationRows !== undefined && (
        <SimulatorStrategySection
          ticker={selectedSymbol}
          activeStrategy={activeSimulationStrategy}
          coverageRequest={coverageRequest}
          spreadRequest={spreadRequest}
          optionStrategyAnalysis={optionStrategyAnalysis}
          wheelSummary={wheelSummary}
          termResult={termResult}
          complexResult={complexResult}
        />
      )}

      {/* ── Placeholder sections — reserved for other teams */}
      <TechnicalAnalysisExtendedSection symbol={selectedSymbol} timeframe={timeframe} />
      <FundamentalAnalysisPanel
        optionStrategyAnalysis={optionStrategyAnalysis}
        autoRunKey={fundamentalAutoRunKey}
        onAnalysisComplete={setFundamentalAnalysis}
      />
<NewsSection symbol={selectedSymbol} />
    </div>
  );

  return (
    <>
      <AppShell
        activityBar={<ActivityBar />}
        leftPanel={<LeftPanel />}
        main={mainContent}
      />

      {/* FAB — Copilot IA */}
      <style>{`.fab-btn:hover{transform:scale(1.08);box-shadow:0 6px 20px rgba(73,79,223,0.55)}@media(prefers-reduced-motion:reduce){.fab-btn{transition:none!important}}`}</style>
      <button
        className="fab-btn"
        onClick={() => setCopilotOpen(true)}
        title="Abrir Copilot IA"
        style={{
          position: "fixed",
          bottom: "1.5rem",
          right: "1.5rem",
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "var(--color-accent)",
          color: "#ffffff",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(73, 79, 223, 0.5)",
          zIndex: 900,
          transition: "transform var(--duration-normal) var(--easing-standard), box-shadow var(--duration-normal) var(--easing-standard)"
        }}
      >
        <MessageSquare size={24} />
      </button>

      {/* FIC: GlobalChatDrawer restored — was missing from JSX after file repair. (EN) */}
      {/* FIC: GlobalChatDrawer restaurado — faltaba en el JSX tras la reparación del archivo. (ES) */}
      <GlobalChatDrawer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
      />
    </>
  );
}

export default MainDashboard;
