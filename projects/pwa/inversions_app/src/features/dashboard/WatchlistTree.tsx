// FIC: Watchlist tree component — Tailwind replaced with CSS vars, price/% change via useWatchlistPrices.
// FIC: Componente árbol de watchlist — Tailwind reemplazado con CSS vars, precio/% cambio via useWatchlistPrices.

import React, { useState, useEffect } from "react";
import { ChevronRight, Star, Plus, X } from "lucide-react";
import { useSignalStore } from "../../store/signals";
import { getAuthHeaders } from "../../services/signals/signalApi";
import { useWatchlistPrices } from "../../services/signals/marketApi";
import { useAnimatedValue } from "../../hooks/useAnimatedValue";

interface WatchlistCategory {
  id: string;
  name: string;
  icon?: string;
}

interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  category: string;
  isFavorite: boolean;
}

interface PriceDisplayProps {
  price: number | undefined;
  changePercent: number | undefined;
}

function PriceDisplay({ price, changePercent }: PriceDisplayProps) {
  const animatedPrice = useAnimatedValue(price ?? 0, { decimals: 2 });
  const animatedChange = useAnimatedValue(changePercent ?? 0, { decimals: 2 });

  if (price === undefined) {
    return <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>—</span>;
  }

  const changeColor = (changePercent ?? 0) >= 0 ? "var(--color-buy)" : "var(--color-sell)";

  return (
    <div style={{ textAlign: "right", lineHeight: 1.3 }}>
      <div style={{ fontSize: "var(--font-size-xs)", fontWeight: "var(--font-weight-emphasis)", color: "var(--color-text)" }}>
        {animatedPrice.toFixed(2)}
      </div>
      <div style={{ fontSize: "var(--font-size-xs)", color: changeColor }}>
        {(animatedChange >= 0 ? "+" : "")}{animatedChange.toFixed(2)}%
      </div>
    </div>
  );
}

interface TreeNodeProps {
  category: WatchlistCategory;
  items: WatchlistItem[];
  isExpanded: boolean;
  onToggle: (categoryId: string) => void;
  onSelectItem: (item: WatchlistItem) => void;
  onAddItem: (categoryId: string) => void;
  onRemoveItem: (itemId: string) => void;
  selectedSymbol?: string;
  prices: Record<string, { price: number; changePercent: number }>;
}

function TreeNode({ category, items, isExpanded, onToggle, onSelectItem, onAddItem, onRemoveItem, selectedSymbol, prices }: TreeNodeProps) {
  return (
    <div style={{ marginBottom: "var(--space-xs)" }}>
      {/* FIC: Category header row with chevron toggle. */}
      {/* FIC: Fila de encabezado de categoría con toggle de chevron. */}
      <div
        onClick={() => onToggle(category.id)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-xs)",
          padding: "0.4rem var(--space-sm)",
          cursor: "pointer",
          borderRadius: "var(--radius-sm)",
          color: "var(--color-text-muted)",
          transition: "background var(--duration-fast) var(--easing-standard)"
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-raised)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <ChevronRight
          size={14}
          style={{ transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform var(--duration-fast) var(--easing-standard)", flexShrink: 0 }}
        />
        <span style={{ fontWeight: "var(--font-weight-emphasis)", fontSize: "var(--font-size-sm)", flex: 1 }}>{category.name}</span>
        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>({items.length})</span>
        <button
          style={{ background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", padding: "2px", borderRadius: "var(--radius-xs)" }}
          onClick={(e) => { e.stopPropagation(); onAddItem(category.id); }}
        >
          <Plus size={12} />
        </button>
      </div>

      {isExpanded && (
        <div style={{ borderLeft: "1px solid var(--color-border-subtle)", marginLeft: "var(--space-md)" }}>
          {items.map((item) => {
            const isSelected = selectedSymbol === item.symbol;
            const quote = prices[item.symbol];
            return (
              <div
                key={item.id}
                onClick={() => onSelectItem(item)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-xs)",
                  padding: "0.4rem var(--space-sm)",
                  cursor: "pointer",
                  borderRadius: "var(--radius-sm)",
                  background: isSelected ? "var(--color-accent-subtle)" : "transparent",
                  color: isSelected ? "var(--color-text)" : "var(--color-text-muted)",
                  fontSize: "var(--font-size-sm)"
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--color-surface-raised)"; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
              >
                <button
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: item.isFavorite ? "#f5a623" : "var(--color-text-muted)", flexShrink: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Star size={12} fill={item.isFavorite ? "currentColor" : "none"} />
                </button>
                <span style={{ flex: 1, fontFamily: "monospace", fontWeight: isSelected ? "var(--font-weight-bold)" : "var(--font-weight-body)", color: isSelected ? "var(--color-accent)" : "var(--color-text)" }}>
                  {item.symbol}
                </span>
                <PriceDisplay price={quote?.price} changePercent={quote?.changePercent} />
                <button
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--color-text-muted)", opacity: 0, flexShrink: 0 }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                  onClick={(e) => { e.stopPropagation(); onRemoveItem(item.id); }}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const WatchlistTree: React.FC = () => {
  const [categories, setCategories] = useState<WatchlistCategory[]>([]);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedSymbol, setSelectedSymbol] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { setSelectedInstrument } = useSignalStore();
  const symbols = watchlistItems.map((item) => item.symbol);
  const quotesMap = useWatchlistPrices(symbols);

  // FIC: Adapt MarketQuote to price/changePercent shape for TreeNode.
  // FIC: Adaptar MarketQuote a shape precio/changePercent para TreeNode.
  const prices: Record<string, { price: number; changePercent: number }> = {};
  for (const [sym, q] of Object.entries(quotesMap)) {
    prices[sym] = { price: q.price, changePercent: q.changePercent };
  }

  useEffect(() => {
    const loadWatchlist = async () => {
      try {
        setLoading(true);
        setError(null);
        const catRes = await fetch("/api/catalogs/instruments", { headers: getAuthHeaders() });
        if (!catRes.ok) throw new Error("Failed to load instrument categories");
        const catData = await catRes.json();

        const wlRes = await fetch("/api/watchlist", { headers: getAuthHeaders() });
        if (!wlRes.ok) throw new Error("Failed to load watchlist");
        const wlData = await wlRes.json();

        setCategories(catData.categories || []);
        setWatchlistItems(wlData.items || []);
      } catch (err) {
        setError((err as Error).message);
        console.error("Watchlist load error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadWatchlist();
  }, []);

  const handleToggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) newExpanded.delete(categoryId);
    else newExpanded.add(categoryId);
    setExpandedCategories(newExpanded);
  };

  const handleSelectItem = (item: WatchlistItem) => {
    setSelectedSymbol(item.symbol);
    setSelectedInstrument({ symbol: item.symbol, name: item.name, category: item.category });
  };

  const handleAddItem = async (categoryId: string) => {
    const symbol = prompt("Enter symbol (e.g., AAPL, GC=F):");
    if (!symbol) return;
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ symbol, category: categoryId })
      });
      if (!res.ok) throw new Error("Failed to add item");
      const newItem = await res.json();
      setWatchlistItems([...watchlistItems, newItem]);
    } catch (err) {
      alert(`Error adding item: ${(err as Error).message}`);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      const res = await fetch(`/api/watchlist/${itemId}`, { method: "DELETE", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to remove item");
      setWatchlistItems(watchlistItems.filter((item) => item.id !== itemId));
    } catch (err) {
      alert(`Error removing item: ${(err as Error).message}`);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "var(--space-lg)", color: "var(--color-text-muted)", textAlign: "center", fontSize: "var(--font-size-sm)" }}>
        Cargando watchlist…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "var(--space-lg)", color: "var(--color-sell)", textAlign: "center", fontSize: "var(--font-size-sm)" }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* FIC: Watchlist header with instrument count. */}
      {/* FIC: Encabezado de watchlist con contador de instrumentos. */}
      <div style={{ padding: "var(--space-md)", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
        <h2 style={{ fontWeight: "var(--font-weight-bold)", fontSize: "var(--font-size-base)", color: "var(--color-text)" }}>Watchlist</h2>
        <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "2px" }}>
          {watchlistItems.length} instrumentos
        </p>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "var(--space-sm)" }}>
        {categories.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "var(--space-lg)", fontSize: "var(--font-size-sm)" }}>
            Sin categorías disponibles
          </div>
        ) : (
          categories.map((category) => (
            <TreeNode
              key={category.id}
              category={category}
              items={watchlistItems.filter((item) => item.category === category.id)}
              isExpanded={expandedCategories.has(category.id)}
              onToggle={handleToggleCategory}
              onSelectItem={handleSelectItem}
              onAddItem={handleAddItem}
              onRemoveItem={handleRemoveItem}
              selectedSymbol={selectedSymbol}
              prices={prices}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default WatchlistTree;
