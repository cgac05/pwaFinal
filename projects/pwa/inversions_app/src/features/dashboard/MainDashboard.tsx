// FIC: Main operational dashboard — AppShell 4-zone layout with ActivityBar, LeftPanel, and ChatPanel.
// FIC: Dashboard operativo principal — layout AppShell de 4 zonas con ActivityBar, LeftPanel y ChatPanel.

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { GlobalChatDrawer } from "../../pages/ai/GlobalChatDrawer";
import { SuperChart } from "./SuperChart";

import { TimeControls } from "./TimeControls";
import { IndicatorsMenu } from "./IndicatorsMenu";
import { ConfluenceSignalsTable } from "./ConfluenceSignalsTable";
import { SimulationControlPanel } from "./simulation/SimulationControlPanel";
import { SimulatorStrategySection } from "./simulation/SimulatorStrategySection";
import type { CoverageModalParams } from "./simulation/CoverageParamsModal";
import { AppShell } from "../../layouts/AppShell";
import { ActivityBar } from "../../components/ui/ActivityBar";
import { LeftPanel } from "../sidebar/LeftPanel";
import { Badge } from "../../components/ui/Badge";
import type { ConfluenceSignalRow, SimulationResponse, CoreId } from "../../services/signals/confluenceTableApi";
import { useSignalStore } from "../../store/signals";
import { useAppShellStore } from "../../store/appShell";
import { useInstitutionalStore, setInstitutionalLoading, setInstitutionalResult, setInstitutionalError } from "../../store/institutional";
import { getInstitutionalAnalysis } from "../../services/institutional/institutionalApi";

export function MainDashboard() {
  const isTestEnv = import.meta.env.MODE === "test";
  const [timeframe, setTimeframe] = useState("1d");
  const [periodRange, setPeriodRange] = useState<{ startDate: Date; endDate: Date } | null>(null);
  const [simulationRows, setSimulationRows] = useState<ConfluenceSignalRow[] | undefined>(undefined);
  const [simulationVerdict, setSimulationVerdict] = useState<{ verdict?: unknown; score?: number; degraded?: boolean } | null>(null);
  const [activeSimulationStrategy, setActiveSimulationStrategy] = useState("IRON_CONDOR");
  const [coverageRequest, setCoverageRequest] = useState<{ params: CoverageModalParams; kind: string } | null>(null);
  const [institutionalCoreWasActive, setInstitutionalCoreWasActive] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const { selectedInstrument, runtimeMode, operationalMode } = useSignalStore();
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
      setInstitutionalCoreWasActive(false);
    }
  }, [selectedSymbol]);

  const handleSimulationResult = useCallback((result: SimulationResponse) => {
    setSimulationRows(result.table);
    setSimulationVerdict(result.verdict);
  }, []);

  const handleCoverageConfirmed = useCallback(
    (params: CoverageModalParams, kind: string) => setCoverageRequest({ params, kind }),
    []
  );

  // FIC: Called when user clicks Execute — fires institutional analysis if A_INSTITUCIONAL core is active. (EN)
  // FIC: Llamado cuando el usuario hace clic en Ejecutar — dispara análisis institucional si el core A_INSTITUCIONAL está activo. (ES)
  const handleSimulationExecute = useCallback((activeCoreIds: CoreId[]) => {
    const institutionalActive = activeCoreIds.includes("A_INSTITUCIONAL");
    setInstitutionalCoreWasActive(institutionalActive);

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

      {/* ── Chart + time/indicator controls */}
      {!isTestEnv && (
        <div style={{ display: "grid", gap: "var(--space-sm)" }}>
          <div className="card" style={{ minHeight: 380 }}>
            <SuperChart symbol={selectedSymbol} timeframe={timeframe} startDate={periodRange?.startDate} endDate={periodRange?.endDate} />
          </div>
          <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap" }}>
            <IndicatorsMenu />
            <TimeControls
              symbol={selectedSymbol}
              onTimeframeChange={(tf) => setTimeframe(tf)}
              onPeriodChange={(_p, startDate, endDate) => setPeriodRange({ startDate, endDate })}
            />
          </div>
        </div>
      )}

      {/* ── Simulation control — cores + indicators + execute */}
      <SimulationControlPanel
        ticket={selectedSymbol}
        onResult={handleSimulationResult}
        onExecute={handleSimulationExecute}
        onStrategyChange={setActiveSimulationStrategy}
        onCoverageParamsConfirmed={handleCoverageConfirmed}
      />

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
        <ConfluenceSignalsTable symbol={selectedSymbol} rows={simulationRows} activeStrategy={activeSimulationStrategy} />
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
          {instData && !instIsLoading && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-md)" }}>
                {instData.trends && (
                  <div>
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", margin: "0 0 4px" }}>Tendencia</p>
                    <p style={{ fontWeight: 600, margin: 0, color: instData.trends.direction === "bullish" ? "var(--color-buy)" : instData.trends.direction === "bearish" ? "var(--color-sell)" : "var(--color-text-muted)" }}>
                      {instData.trends.direction === "bullish" ? "🟢 Bullish" : instData.trends.direction === "bearish" ? "🔴 Bearish" : "⚫ Neutral"}
                    </p>
                  </div>
                )}
                {instData.zones && (
                  <div>
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", margin: "0 0 4px" }}>Zonas detectadas</p>
                    <p style={{ fontWeight: 600, margin: 0 }}>{instData.zones.support.length} soporte · {instData.zones.resistance.length} resistencia</p>
                  </div>
                )}
                {instData.expiration && (
                  <div>
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", margin: "0 0 4px" }}>Próximo OpEx</p>
                    <p style={{ fontWeight: 600, margin: 0 }}>{instData.expiration.daysToNextOpex} días</p>
                  </div>
                )}
                {instData.metrics && (
                  <div>
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", margin: "0 0 4px" }}>Ownership inst.</p>
                    <p style={{ fontWeight: 600, margin: 0 }}>{instData.metrics.fundsOwnershipPct.toFixed(1)}%</p>
                  </div>
                )}
                {instData.metrics && (
                  <div>
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", margin: "0 0 4px" }}>Net Flow</p>
                    <p style={{ fontWeight: 600, margin: 0, color: instData.metrics.netFlow >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}>
                      ${instData.metrics.netFlow.toLocaleString()}
                    </p>
                  </div>
                )}
                <div>
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", margin: "0 0 4px" }}>Fuentes</p>
                  <p style={{ fontSize: "var(--font-size-xs)", margin: 0 }}>
                    {instData.sourceReports.map((s) => (
                      <span key={s.sourceId} style={{ marginRight: "var(--space-xs)" }}>
                        {s.status === "ok" ? "✅" : s.status === "partial" ? "⚠️" : "❌"} {s.sourceId.split("_")[0]}
                      </span>
                    ))}
                  </p>
                </div>
              </div>
              <p style={{ marginTop: "var(--space-sm)", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                Haz clic en una fila de la tabla de confluencia para ver el detalle completo.
              </p>
            </>
          )}
        </section>
      )}

      {/* ── Strategy breakdown section — only visible after simulation has run */}
      {simulationRows !== undefined && (
        <SimulatorStrategySection
          ticker={selectedSymbol}
          activeStrategy={activeSimulationStrategy}
          coverageRequest={coverageRequest}
        />
      )}

      {/* ── Placeholder sections — reserved for other teams */}
      <PlaceholderSection
        title="Análisis Técnico Extendido"
        description="Señales de indicadores técnicos avanzados, patrones de velas y análisis de estructura de mercado."
      />
      <PlaceholderSection
        title="Análisis Fundamental"
        description="Métricas financieras, earnings, valuación y comparativa sectorial."
      />
      <PlaceholderSection
        title="Noticias y Sentimiento"
        description="Sentimiento del mercado, noticias relevantes y análisis de redes sociales."
      />
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
      <button
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
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(73, 79, 223, 0.5)",
          zIndex: 900,
          transition: "transform 0.2s ease, box-shadow 0.2s ease"
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(73, 79, 223, 0.7)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(73, 79, 223, 0.5)";
        }}
      >
        <MessageSquare size={24} color="#ffffff" />
      </button>

      <GlobalChatDrawer isOpen={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </>
  );
}
