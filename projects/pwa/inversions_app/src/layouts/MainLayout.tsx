import React, { useState } from "react";
import { Outlet, Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { GlobalChatDrawer } from "../pages/ai/GlobalChatDrawer";

export const MainLayout: React.FC = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-bg)" }}>
      {/* Sidebar */}
      <aside className="card" style={{
        width: "250px",
        margin: "1rem",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        height: "fit-content"
      }}>
        <h2 style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", margin: "0 0 0.5rem 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Navegación
        </h2>
        <nav style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <Link to="/" style={{ color: "var(--color-text)", textDecoration: "none", padding: "0.5rem", borderRadius: "var(--radius-sm)", display: "block" }}>Dashboard</Link>
          <Link to="/institutional/analysis" style={{ color: "var(--color-text)", textDecoration: "none", padding: "0.5rem", borderRadius: "var(--radius-sm)", display: "block" }}>Análisis Institucional</Link>
          <Link to="/institutional/positions" style={{ color: "var(--color-text)", textDecoration: "none", padding: "0.5rem", borderRadius: "var(--radius-sm)", display: "block" }}>Posiciones Reg.</Link>
          <Link to="/coverage/strategies" style={{ color: "var(--color-text)", textDecoration: "none", padding: "0.5rem", borderRadius: "var(--radius-sm)", display: "block" }}>Coberturas</Link>
          <Link to="/ai/evaluacion-tabla" style={{ color: "var(--color-text)", textDecoration: "none", padding: "0.5rem", borderRadius: "var(--radius-sm)", display: "block" }}>Panel de Análisis (Tabla)</Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflowY: "auto", padding: "1rem 1rem 1rem 0" }}>
        <Outlet />
      </main>

      {/* Floating Action Button (FAB) for global IA Copilot chat drawer */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        style={{
          position: "fixed",
          right: "2rem",
          bottom: "2rem",
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--color-accent, #ffd43b) 0%, #ff9800 100%)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 15px rgba(255, 152, 0, 0.4)",
          zIndex: 900,
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: isChatOpen ? "rotate(135deg) scale(0.95)" : "scale(1)"
        }}
        title="Copilot IA"
      >
        <Sparkles size={24} color="#000" style={{ transform: isChatOpen ? "rotate(-135deg)" : "none", transition: "transform 0.3s" }} />
      </button>

      {/* Global Slide drawer */}
      <GlobalChatDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
};
