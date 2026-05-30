// FIC: Runtime mode switches — Tailwind removed, CSS vars applied, Modal replaces window.confirm.
// FIC: Switches de modo runtime — Tailwind eliminado, CSS vars aplicados, Modal reemplaza window.confirm.

import React, { useState, useEffect } from "react";
import { useSignalStore } from "../../store/signals";
import { Wifi, WifiOff, Zap, AlertTriangle } from "lucide-react";
import { getAuthHeaders } from "../../services/signals/signalApi";
import { Modal } from "../../components/ui/Modal";

interface RuntimeModeProps {
  onModeChange?: (online: boolean, mode: "demo" | "real") => void;
}

export const RuntimeModeSwitches: React.FC<RuntimeModeProps> = ({ onModeChange }) => {
  const { runtimeMode, setRuntimeMode, operationalMode, setOperationalMode } = useSignalStore();
  const [connStatus, setConnStatus] = useState<"connected" | "disconnected" | "checking">("checking");
  const [showWarning, setShowWarning] = useState(false);
  const [realModeModalOpen, setRealModeModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      try {
        setConnStatus("checking");
        const response = await fetch("/api/health", { signal: controller.signal, headers: getAuthHeaders() });
        setConnStatus(response.ok ? "connected" : "disconnected");
      } catch {
        setConnStatus("disconnected");
      } finally {
        clearTimeout(timeoutId);
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleOnline = async () => {
    setErrorMsg(null);
    const newMode = runtimeMode === "online" ? "offline" : "online";
    try {
      const response = await fetch("/api/runtime/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ mode: newMode, operationalMode })
      });
      if (!response.ok) { setErrorMsg(`Error: ${response.statusText}`); return; }
      setRuntimeMode(newMode as "online" | "offline");
      onModeChange?.(newMode === "online", operationalMode);
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 3000);
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleToggleOperationalMode = () => {
    if (operationalMode === "demo") {
      // FIC: Show explicit Modal confirmation before switching to real trading mode.
      // FIC: Mostrar Modal de confirmación explícita antes de cambiar a modo de trading real.
      setRealModeModalOpen(true);
    } else {
      void applyOperationalMode("demo");
    }
  };

  const applyOperationalMode = async (newOpMode: "demo" | "real") => {
    setErrorMsg(null);
    try {
      const response = await fetch("/api/runtime/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ mode: runtimeMode, operationalMode: newOpMode })
      });
      if (!response.ok) { setErrorMsg(`Error: ${response.statusText}`); return; }
      setOperationalMode(newOpMode);
      onModeChange?.(runtimeMode === "online", newOpMode);
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 3000);
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  // FIC: Connection status color using CSS vars.
  // FIC: Color de estado de conexión usando CSS vars.
  const connColor =
    connStatus === "connected" ? "var(--color-buy)" :
    connStatus === "disconnected" ? "var(--color-sell)" :
    "var(--color-text-muted)";

  const ConnIcon = connStatus === "connected" ? Wifi : connStatus === "disconnected" ? WifiOff : Wifi;

  return (
    <>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-md)",
        padding: "var(--space-sm) var(--space-md)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        flexWrap: "wrap"
      }}>
        {/* FIC: Connection indicator */}
        {/* FIC: Indicador de conexión */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
          <ConnIcon size={14} style={{ color: connColor }} />
          <span style={{ fontSize: "var(--font-size-xs)", fontWeight: "var(--font-weight-emphasis)", color: connColor }}>
            {connStatus === "connected" ? "Conectado" : connStatus === "disconnected" ? "Offline" : "Verificando…"}
          </span>
        </div>

        {/* FIC: Online/Offline toggle */}
        {/* FIC: Toggle online/offline */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontWeight: "var(--font-weight-emphasis)", textTransform: "uppercase" }}>
            Modo:
          </span>
          <button
            onClick={handleToggleOnline}
            style={{
              background: runtimeMode === "online" ? "var(--color-accent-subtle)" : "var(--color-surface-raised)",
              color: runtimeMode === "online" ? "var(--color-accent)" : "var(--color-text-muted)",
              border: `1px solid ${runtimeMode === "online" ? "var(--color-accent)" : "var(--color-border)"}`,
              borderRadius: "var(--radius-pill)",
              padding: "0.25rem 0.75rem",
              fontSize: "var(--font-size-xs)",
              fontWeight: "var(--font-weight-emphasis)",
              cursor: "pointer"
            }}
          >
            {runtimeMode === "online" ? "ONLINE" : "OFFLINE"}
          </button>
        </div>

        {/* FIC: Demo/Real toggle — Real mode shows warning badge color (--color-warning). */}
        {/* FIC: Toggle demo/real — modo Real muestra color de badge warning (--color-warning). */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontWeight: "var(--font-weight-emphasis)", textTransform: "uppercase" }}>
            Operativo:
          </span>
          <button
            onClick={handleToggleOperationalMode}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-xs)",
              background: operationalMode === "demo" ? "var(--color-accent-subtle)" : "var(--color-warning-subtle)",
              color: operationalMode === "demo" ? "var(--color-accent)" : "var(--color-warning)",
              border: `1px solid ${operationalMode === "demo" ? "var(--color-accent)" : "var(--color-warning)"}`,
              borderRadius: "var(--radius-pill)",
              padding: "0.25rem 0.75rem",
              fontSize: "var(--font-size-xs)",
              fontWeight: "var(--font-weight-emphasis)",
              cursor: "pointer"
            }}
          >
            {operationalMode === "demo" ? <Zap size={12} /> : <AlertTriangle size={12} />}
            {operationalMode === "demo" ? "DEMO" : "REAL"}
          </button>
        </div>

        {showWarning && (
          <div style={{
            fontSize: "var(--font-size-xs)",
            color: "var(--color-accent)",
            background: "var(--color-accent-subtle)",
            borderRadius: "var(--radius-sm)",
            padding: "0.25rem 0.75rem",
            border: "1px solid var(--color-border)"
          }}>
            ✓ Modo actualizado
          </div>
        )}

        {operationalMode === "real" && (
          <div style={{
            marginLeft: "auto",
            fontSize: "var(--font-size-xs)",
            color: "var(--color-warning)",
            background: "var(--color-warning-subtle)",
            borderRadius: "var(--radius-sm)",
            padding: "0.25rem 0.75rem",
            border: "1px solid var(--color-warning)"
          }}>
            ⚠️ TRADING REAL activo — revisa órdenes antes de aprobar
          </div>
        )}

        {errorMsg && (
          <p style={{ color: "var(--color-sell)", fontSize: "var(--font-size-sm)", marginTop: "var(--space-xs)", margin: 0 }}>
            {errorMsg}
          </p>
        )}
      </div>

      {/* FIC: Explicit confirmation modal for switching to real mode. */}
      {/* FIC: Modal de confirmación explícita para cambiar a modo real. */}
      <Modal
        isOpen={realModeModalOpen}
        onConfirm={() => {
          setRealModeModalOpen(false);
          void applyOperationalMode("real");
        }}
        onCancel={() => setRealModeModalOpen(false)}
        title="⚠️ Cambiar a modo REAL"
        message="Estás a punto de activar el modo TRADING REAL. Las órdenes se ejecutarán con dinero real. ¿Entiendes y aceptas los riesgos?"
        confirmLabel="Activar modo Real"
        cancelLabel="Cancelar"
        variant="warning"
      />
    </>
  );
};

export default RuntimeModeSwitches;
