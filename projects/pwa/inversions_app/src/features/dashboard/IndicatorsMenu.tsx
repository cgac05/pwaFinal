// FIC: Indicators menu — Tailwind removed, CSS vars applied. Logic and structure unchanged.
// FIC: Menú de indicadores — Tailwind eliminado, CSS vars aplicados. Lógica y estructura sin cambios.

import React, { useState, useEffect } from "react";
import { Search, X, TrendingUp } from "lucide-react";

interface Indicator {
  id: string;
  name: string;
  category: string;
  description?: string;
  available: boolean;
}

interface IndicatorsMenuProps {
  onIndicatorsSelected?: (indicators: Indicator[]) => void;
  maxVisibleQuick?: number;
}

export const IndicatorsMenu: React.FC<IndicatorsMenuProps> = ({
  onIndicatorsSelected,
  maxVisibleQuick = 3
}) => {
  const [allIndicators, setAllIndicators] = useState<Indicator[]>([]);
  const [selectedIndicators, setSelectedIndicators] = useState<Indicator[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadIndicators = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/indicators/catalog");
        if (!response.ok) throw new Error("Failed to load indicators");
        const data = await response.json();
        setAllIndicators(data.indicators || []);
      } catch (err) {
        console.error("Failed to load indicators:", err);
      } finally {
        setLoading(false);
      }
    };
    loadIndicators();
  }, []);

  const filteredIndicators = allIndicators.filter(
    (ind) =>
      ind.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ind.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectIndicator = (indicator: Indicator) => {
    const isSelected = selectedIndicators.some((ind) => ind.id === indicator.id);
    const updated = isSelected
      ? selectedIndicators.filter((ind) => ind.id !== indicator.id)
      : [...selectedIndicators, indicator];
    setSelectedIndicators(updated);
    onIndicatorsSelected?.(updated);
  };

  const quickAccessIndicators = allIndicators.slice(0, maxVisibleQuick);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
      {/* FIC: Quick access buttons */}
      {/* FIC: Botones de acceso rápido */}
      {quickAccessIndicators.map((ind) => {
        const isSelected = selectedIndicators.some((s) => s.id === ind.id);
        return (
          <button
            key={ind.id}
            title={ind.description}
            onClick={() => handleSelectIndicator(ind)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-xs)",
              background: isSelected ? "var(--color-accent-subtle)" : "var(--color-surface-raised)",
              color: isSelected ? "var(--color-accent)" : "var(--color-text-muted)",
              border: `1px solid ${isSelected ? "var(--color-accent)" : "var(--color-border)"}`,
              borderRadius: "var(--radius-pill)",
              padding: "0.3rem 0.75rem",
              fontSize: "var(--font-size-xs)",
              fontWeight: "var(--font-weight-emphasis)",
              cursor: "pointer"
            }}
          >
            <TrendingUp size={12} />
            {ind.name}
          </button>
        );
      })}

      {allIndicators.length > maxVisibleQuick && (
        <button
          title="More indicators"
          onClick={() => setShowModal(true)}
          style={{
            background: "var(--color-surface-raised)",
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-pill)",
            padding: "0.3rem 0.75rem",
            fontSize: "var(--font-size-xs)",
            cursor: "pointer"
          }}
        >
          ⋯
        </button>
      )}

      {/* FIC: Indicator search modal — CSS vars replace Tailwind. */}
      {/* FIC: Modal de búsqueda de indicadores — CSS vars reemplazan Tailwind. */}
      {showModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            maxWidth: 600,
            width: "90%",
            maxHeight: "80vh",
            display: "flex",
            flexDirection: "column"
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-md) var(--space-lg)", borderBottom: "1px solid var(--color-border)" }}>
              <h2 style={{ fontWeight: "var(--font-weight-bold)", fontSize: "var(--font-size-base)" }}>Technical Indicators</h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontSize: "1.25rem", padding: "var(--space-xs)" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Search */}
            <div style={{ padding: "var(--space-md) var(--space-lg)", borderBottom: "1px solid var(--color-border)" }}>
              <div style={{ position: "relative" }}>
                <Search size={16} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search indicators..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  style={{ paddingLeft: "2.25rem" }}
                />
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflow: "auto", padding: "var(--space-md) var(--space-lg)" }}>
              {loading ? (
                <div style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "var(--space-xl)", fontSize: "var(--font-size-sm)" }}>
                  Cargando indicadores…
                </div>
              ) : filteredIndicators.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "var(--space-xl)", fontSize: "var(--font-size-sm)" }}>
                  Sin indicadores encontrados
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
                  {filteredIndicators.map((ind) => {
                    const isSelected = selectedIndicators.some((s) => s.id === ind.id);
                    return (
                      <button
                        key={ind.id}
                        disabled={!ind.available}
                        onClick={() => ind.available && handleSelectIndicator(ind)}
                        style={{
                          background: isSelected ? "var(--color-accent-subtle)" : "var(--color-surface)",
                          border: `1px solid ${isSelected ? "var(--color-accent)" : "var(--color-border)"}`,
                          borderRadius: "var(--radius-md)",
                          padding: "var(--space-sm) var(--space-md)",
                          textAlign: "left",
                          cursor: ind.available ? "pointer" : "not-allowed",
                          opacity: ind.available ? 1 : 0.5
                        }}
                      >
                        <div style={{ fontWeight: "var(--font-weight-emphasis)", fontSize: "var(--font-size-sm)", color: isSelected ? "var(--color-accent)" : "var(--color-text)" }}>
                          {ind.name}
                        </div>
                        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{ind.category}</div>
                        {!ind.available && (
                          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-sell)", marginTop: "2px" }}>No disponible en modo offline</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-md) var(--space-lg)", borderTop: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
              <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
                {selectedIndicators.length} seleccionado{selectedIndicators.length !== 1 ? "s" : ""}
              </span>
              <button className="btn-primary" onClick={() => setShowModal(false)} style={{ padding: "0.4rem 1rem", fontSize: "var(--font-size-sm)" }}>
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndicatorsMenu;
