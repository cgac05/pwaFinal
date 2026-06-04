// FIC: WatchlistView — sidebar-adapted watchlist with inline add/remove and error feedback (FR-004, FR-014).
// FIC: WatchlistView — watchlist adaptado al sidebar con agregar/quitar inline y feedback de errores (FR-004, FR-014).

import React, { useState, useEffect } from "react";
import { Search, Plus, X } from "lucide-react";
import { useSignalStore } from "../../../store/signals";
import { useWatchlistPrices } from "../../../services/signals/marketApi";
import { getAuthHeaders } from "../../../services/signals/signalApi";
import { useAnimatedValue } from "../../../hooks/useAnimatedValue";

interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  category: string;
  isFavorite: boolean;
}

function PriceRow({ symbol, price, changePercent }: { symbol: string; price?: number; changePercent?: number }) {
  const animatedPrice = useAnimatedValue(price ?? 0, { decimals: 2 });
  const animatedChange = useAnimatedValue(changePercent ?? 0, { decimals: 2 });

  if (price === undefined) {
    return <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>—</span>;
  }

  const color = (changePercent ?? 0) >= 0 ? "var(--color-buy)" : "var(--color-sell)";
  return (
    <span style={{ fontSize: "var(--font-size-xs)", color, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      {animatedPrice} {(changePercent ?? 0) >= 0 ? "+" : ""}{animatedChange}%
    </span>
  );
}

export function WatchlistView() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const { setSelectedInstrument } = useSignalStore();
  const symbols = items.map((i) => i.symbol);
  const quotesMap = useWatchlistPrices(symbols);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/watchlist", { headers: getAuthHeaders() });
        if (!res.ok) throw new Error("No se pudo cargar el watchlist");
        const data = await res.json() as { items?: WatchlistItem[] };
        setItems(data.items ?? []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filteredItems = search
    ? items.filter((i) => i.symbol.toLowerCase().includes(search.toLowerCase()) || i.name?.toLowerCase().includes(search.toLowerCase()))
    : items;

  const handleAdd = async () => {
    const sym = search.trim().toUpperCase();
    if (!sym) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ symbol: sym, category: "equities" }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as Record<string, unknown>;
        const apiMsg = (errBody.message ?? errBody.error ?? errBody.detail ?? errBody.msg) as string | undefined;
        setAddError(apiMsg ?? `Error ${res.status} al agregar ${sym}`);
        return;
      }
      const newItem = await res.json() as WatchlistItem;
      if (items.some((i) => i.symbol === newItem.symbol)) {
        setAddError(`${newItem.symbol} ya está en tu watchlist`);
        return;
      }
      setItems((prev) => [...prev, newItem]);
      setSearch("");
    } catch {
      setAddError("Error de red. Intenta de nuevo.");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    // FIC: Default items (id starts with "default-") are removed only from local state — no API call needed. (EN)
    // FIC: Ítems por defecto (id empieza con "default-") se quitan solo del estado local — sin llamada al API. (ES)
    if (id.startsWith("default-")) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    try {
      const res = await fetch(`/api/watchlist/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      if (!res.ok) return;
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      // silent — item remains in list
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "var(--space-md)", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", textAlign: "center" }}>
        Cargando watchlist…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}>
      {/* Search / Add field */}
      <div style={{ padding: "var(--space-sm)", borderBottom: "1px solid var(--color-border-subtle)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "var(--space-xs)", alignItems: "center" }}>
          <Search size={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
            placeholder="Buscar o agregar ticker…"
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              color: "var(--color-text)",
              fontSize: "var(--font-size-sm)",
              minWidth: 0,
            }}
          />
          <button
            onClick={() => void handleAdd()}
            disabled={adding || !search.trim()}
            aria-label="Agregar ticker"
            style={{
              background: "none",
              border: "none",
              color: "var(--color-accent)",
              cursor: "pointer",
              padding: "2px",
              opacity: adding || !search.trim() ? 0.4 : 1,
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <Plus size={16} />
          </button>
        </div>
        {/* Inline error for FR-014 */}
        {addError && (
          <p style={{ color: "var(--color-sell)", fontSize: "var(--font-size-xs)", marginTop: "var(--space-xs)", lineHeight: 1.3 }}>
            {addError}
          </p>
        )}
      </div>

      {/* Items list */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {filteredItems.length === 0 && (
          <div style={{ padding: "var(--space-md)", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", textAlign: "center" }}>
            {search ? `Sin resultados para "${search}"` : "Tu watchlist está vacío"}
          </div>
        )}
        {filteredItems.map((item) => {
          const q = quotesMap[item.symbol];
          return (
            <div
              key={item.id}
              onClick={() => setSelectedInstrument({ symbol: item.symbol, name: item.name, category: item.category })}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--space-xs) var(--space-sm)",
                cursor: "pointer",
                borderBottom: "1px solid var(--color-border-subtle)",
                minWidth: 0,
                gap: "var(--space-xs)",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: "var(--font-weight-emphasis)", fontSize: "var(--font-size-sm)", color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.symbol}
                </div>
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.name}
                </div>
              </div>
              <PriceRow symbol={item.symbol} price={q?.price} changePercent={q?.changePercent} />
              <button
                onClick={(e) => { e.stopPropagation(); void handleRemove(item.id); }}
                aria-label={`Quitar ${item.symbol}`}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-text-muted)",
                  cursor: "pointer",
                  padding: "2px",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
