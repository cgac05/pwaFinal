import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * FIC: Robust Error Boundary to catch UI rendering crashes and show them gracefully with high-fidelity diagnostics.
 * FIC: Error Boundary robusto para capturar fallos de renderizado de UI y mostrarlos con diagnósticos detallados.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught React Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: "2rem",
          maxWidth: "800px",
          margin: "4rem auto",
          background: "#161b22",
          border: "1px solid #f85149",
          borderRadius: "8px",
          color: "#e6edf3",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        }}>
          <h1 style={{ color: "#f85149", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>⚠️</span> Error de Renderizado en React
          </h1>
          <p style={{ marginBottom: "1rem", color: "#8b949e", fontSize: "0.95rem" }}>
            La interfaz gráfica del dashboard operativo ha detectado una excepción crítica en el árbol de componentes.
          </p>
          
          <div style={{
            background: "#0d1117",
            padding: "1rem",
            borderRadius: "6px",
            border: "1px solid #30363d",
            overflowX: "auto",
            marginBottom: "1.5rem",
            fontSize: "0.9rem",
            color: "#ff7b72"
          }}>
            <strong>Mensaje de Error:</strong> {this.state.error?.toString()}
          </div>
          
          {this.state.errorInfo && (
            <div style={{ marginBottom: "1.5rem" }}>
              <strong style={{ display: "block", marginBottom: "0.5rem", color: "#8b949e", fontSize: "0.85rem", textTransform: "uppercase" }}>
                Pila de Componentes (Component Stack):
              </strong>
              <pre style={{
                background: "#0d1117",
                padding: "1rem",
                borderRadius: "6px",
                border: "1px solid #30363d",
                overflowX: "auto",
                fontSize: "0.8rem",
                color: "#8b949e",
                whiteSpace: "pre-wrap"
              }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </div>
          )}

          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "#388bfd",
                color: "white",
                padding: "0.6rem 1.5rem",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
                border: "none",
                fontSize: "0.9rem"
              }}
            >
              🔄 Recargar Aplicación
            </button>
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.localStorage.clear();
                  window.location.reload();
                }
              }}
              style={{
                background: "#21262d",
                color: "#e6edf3",
                padding: "0.6rem 1.5rem",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
                border: "1px solid #30363d",
                fontSize: "0.9rem"
              }}
            >
              🧹 Limpiar LocalStorage y Recargar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
