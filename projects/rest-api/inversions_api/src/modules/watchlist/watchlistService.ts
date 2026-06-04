// FIC: Watchlist service with per-user CRUD and Supabase fallback.
// FIC: Servicio de watchlist con CRUD por usuario y fallback local.

import { randomUUID } from "crypto";
import { supabaseClient } from "../../database/supabase/client";

export interface WatchlistItem {
  id: string;
  user_id: string;
  symbol: string;
  name: string;
  category: string;
  is_favorite: boolean;
  created_at: string;
}

type NewWatchlistItem = Pick<WatchlistItem, "user_id" | "symbol" | "category"> &
  Partial<Pick<WatchlistItem, "name" | "is_favorite">>;

const fallbackStore = new Map<string, WatchlistItem[]>();

// FIC: Build default watchlist items from DEFAULT_WATCHLIST_SYMBOLS env var. (EN)
// FIC: Construye ítems por defecto del watchlist desde la variable de entorno DEFAULT_WATCHLIST_SYMBOLS. (ES)
function buildDefaultItems(userId: string): WatchlistItem[] {
  const raw = process.env.DEFAULT_WATCHLIST_SYMBOLS ?? "";
  if (!raw.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .map((symbol, idx) => ({
      id: `default-${symbol.toLowerCase()}`,
      user_id: userId,
      symbol,
      name: symbol,
      category: "equities",
      is_favorite: false,
      created_at: new Date(Date.now() - idx * 1000).toISOString(),
    }));
}

function symbolToName(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export class WatchlistService {
  async listByUser(userId: string): Promise<WatchlistItem[]> {
    try {
      const { data, error } = await supabaseClient
        .from("watchlist_items")
        .select("id,user_id,symbol,name,category,is_favorite,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const items = (data as WatchlistItem[]) ?? [];
      // FIC: Return env-configured defaults when user has no saved items. (EN)
      return items.length > 0 ? items : buildDefaultItems(userId);
    } catch {
      const local = fallbackStore.get(userId) ?? [];
      return local.length > 0 ? local : buildDefaultItems(userId);
    }
  }

  async add(input: NewWatchlistItem): Promise<WatchlistItem> {
    const payload = {
      user_id: input.user_id,
      symbol: input.symbol.trim().toUpperCase(),
      name: input.name ?? symbolToName(input.symbol),
      category: input.category,
      is_favorite: input.is_favorite ?? false
    };

    try {
      const { data, error } = await supabaseClient
        .from("watchlist_items")
        .insert(payload)
        .select("id,user_id,symbol,name,category,is_favorite,created_at")
        .single();

      if (error) {
        throw error;
      }

      return data as WatchlistItem;
    } catch {
      const item: WatchlistItem = {
        id: randomUUID(),
        created_at: new Date().toISOString(),
        ...payload
      };
      const current = fallbackStore.get(payload.user_id) ?? [];
      fallbackStore.set(payload.user_id, [item, ...current]);
      return item;
    }
  }

  async remove(userId: string, id: string): Promise<boolean> {
    try {
      const { error } = await supabaseClient
        .from("watchlist_items")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) {
        throw error;
      }

      return true;
    } catch {
      const current = fallbackStore.get(userId) ?? [];
      const next = current.filter((item) => item.id !== id);
      fallbackStore.set(userId, next);
      return current.length !== next.length;
    }
  }
}
