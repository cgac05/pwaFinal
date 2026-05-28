// FIC: Generic in-memory cache with configurable TTL — no React dependencies. (EN)
// FIC: Caché en memoria genérico con TTL configurable — sin dependencias de React. (ES)

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes / 5 minutos

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

// FIC: Retrieve a cached value if present and not expired. Returns undefined on miss or expiry. (EN)
// FIC: Recupera un valor del caché si está presente y no ha expirado. Devuelve undefined en miss o expiración. (ES)
export function getCached<T>(key: string): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

// FIC: Store a value with an optional TTL (defaults to 5 minutes). (EN)
// FIC: Almacena un valor con TTL opcional (por defecto 5 minutos). (ES)
export function setCache<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// FIC: Remove a specific entry from the cache. (EN)
// FIC: Elimina una entrada específica del caché. (ES)
export function invalidateCache(key: string): void {
  store.delete(key);
}

// FIC: Clear all entries — useful in tests and logout flows. (EN)
// FIC: Limpia todas las entradas — útil en tests y flujos de logout. (ES)
export function clearCache(): void {
  store.clear();
}
