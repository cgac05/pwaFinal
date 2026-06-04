// FIC: Tradier API client — stub arquitectural. Activar configurando TRADIER_API_KEY en .env. (EN)
// FIC: Cliente de API Tradier — stub arquitectural. Activar configurando TRADIER_API_KEY en .env. (ES)

const TRADIER_TIMEOUT_MS = 5_000;
const TRADIER_RETRY_WAIT_MS = 500;

export class TradierNotConfiguredError extends Error {
  constructor() {
    super("TRADIER_API_KEY not set in environment — see .env.example for setup instructions");
    this.name = "TradierNotConfiguredError";
  }
}

export class TradierRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string
  ) {
    super(`Tradier request failed: ${status} on ${path}`);
    this.name = "TradierRequestError";
  }
}

// FIC: Returns true when TRADIER_API_KEY is present — used to select data source at runtime. (EN)
// FIC: Retorna true cuando TRADIER_API_KEY está presente — usado para seleccionar fuente de datos en runtime. (ES)
export function isTradierConfigured(): boolean {
  return Boolean(process.env.TRADIER_API_KEY);
}

function buildUrl(path: string, params?: Record<string, string>): string {
  const base = (process.env.TRADIER_BASE_URL ?? "https://sandbox.tradier.com/v1").replace(/\/$/, "");
  const url = new URL(`${base}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

async function doRequest<T>(path: string, params?: Record<string, string>): Promise<T> {
  const apiKey = process.env.TRADIER_API_KEY;
  if (!apiKey) throw new TradierNotConfiguredError();

  const url = buildUrl(path, params);
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };

  for (let attempt = 0; attempt <= 1; attempt++) {
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), TRADIER_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers, signal: ac.signal });
      if (res.ok) {
        return (await res.json()) as T;
      }
      // FIC: Retry once on 429 (rate limit) or 5xx (server error). (EN)
      // FIC: Reintenta una vez en 429 (rate limit) o 5xx (error del servidor). (ES)
      if ((res.status === 429 || res.status >= 500) && attempt === 0) {
        await new Promise((r) => setTimeout(r, TRADIER_RETRY_WAIT_MS));
        continue;
      }
      throw new TradierRequestError(res.status, path);
    } finally {
      clearTimeout(tid);
    }
  }

  throw new TradierRequestError(0, path);
}

// FIC: Main Tradier GET helper — throws TradierNotConfiguredError if key absent, TradierRequestError on HTTP failure. (EN)
// FIC: Helper GET principal de Tradier — lanza TradierNotConfiguredError si falta la key, TradierRequestError en fallo HTTP. (ES)
export async function tradierGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  return doRequest<T>(path, params);
}
