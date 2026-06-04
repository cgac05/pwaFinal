// FIC: Yahoo Finance crumb/cookie session manager — singleton with 15-min TTL and in-flight dedup. (EN)
// FIC: Gestor de sesión crumb/cookie de Yahoo Finance — singleton con TTL de 15 min y dedup de in-flight. (ES)

const YAHOO_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// FIC: Use finance.yahoo.com home to get cookies — fc.yahoo.com is a Cloudflare challenge that fails in Node.js. (EN)
// FIC: Usar finance.yahoo.com para obtener cookies — fc.yahoo.com es un challenge de Cloudflare que falla en Node.js. (ES)
const YAHOO_HOME_URL = "https://finance.yahoo.com/";

// FIC: Try query1 first, query2 as fallback — both serve the same crumb endpoint. (EN)
// FIC: Intentar query1 primero, query2 como respaldo — ambos sirven el mismo endpoint de crumb. (ES)
const YAHOO_CRUMB_URLS = [
  "https://query1.finance.yahoo.com/v1/test/getcrumb",
  "https://query2.finance.yahoo.com/v1/test/getcrumb",
];

const CRUMB_TTL_MS = 900_000; // 15 minutes / 15 minutos

export interface YahooSession {
  crumb: string;
  cookie: string;
  expiresAt: number;
}

// FIC: Module-level singletons for session caching and in-flight dedup. (EN)
// FIC: Singletons a nivel de módulo para caché de sesión y dedup de in-flight. (ES)
let sessionCache: YahooSession | null = null;
let sessionPromise: Promise<YahooSession> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// FIC: Parse all Set-Cookie headers into a single cookie string suitable for use as a Cookie header. (EN)
// FIC: Parsea todos los headers Set-Cookie en un string cookie para usar como header Cookie. (ES)
function parseCookiesFromHeaders(headers: Headers): string {
  // Node 18+ exposes getSetCookie() which returns all Set-Cookie values as an array.
  // Older runtimes fall back to headers.get("set-cookie") which may return a comma-joined string.
  const setCookies: string[] =
    typeof (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : (headers.get("set-cookie") ?? "")
          .split(/,(?=[^ ])/g) // split on commas not followed by a space (date separator)
          .filter(Boolean);

  // Take only "Name=Value" from each directive (discard Path, Domain, Max-Age, etc.)
  return setCookies
    .map((raw) => raw.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

// FIC: Acquire a fresh Yahoo Finance session: cookies from homepage → crumb from API. (EN)
// FIC: Adquiere una sesión Yahoo Finance fresca: cookies de la página principal → crumb de la API. (ES)
async function acquireSession(fetchImpl: typeof globalThis.fetch): Promise<YahooSession> {
  // Step 1: GET finance.yahoo.com to obtain session cookies
  const homeRes = await fetchImpl(YAHOO_HOME_URL, {
    headers: {
      "User-Agent": YAHOO_USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
    },
  });

  const cookie = parseCookiesFromHeaders(homeRes.headers);

  // Step 2: Fetch crumb — try query1 then query2
  let crumb = "";
  for (const url of YAHOO_CRUMB_URLS) {
    try {
      const crumbRes = await fetchImpl(url, {
        headers: {
          "User-Agent": YAHOO_USER_AGENT,
          Cookie: cookie,
          Accept: "text/plain, */*",
        },
      });
      if (crumbRes.ok) {
        const text = (await crumbRes.text()).trim();
        // Crumb is a short alphanumeric/symbol string (never a JSON object or HTML page)
        if (text && !text.startsWith("{") && !text.startsWith("<") && text.length < 200) {
          crumb = text;
          break;
        }
      }
    } catch {
      // try next URL
    }
  }

  if (!crumb) throw new Error("Yahoo Finance crumb empty — session acquisition failed");

  return { crumb, cookie, expiresAt: Date.now() + CRUMB_TTL_MS };
}

// FIC: Returns a valid Yahoo Finance session (crumb + cookie), reusing cached or in-flight if available. (EN)
// FIC: Retorna una sesión válida de Yahoo Finance (crumb + cookie), reutilizando caché o in-flight si disponible. (ES)
export async function getYahooSession(
  fetchImpl: typeof globalThis.fetch = globalThis.fetch
): Promise<YahooSession> {
  const now = Date.now();

  // Return cached session if still valid
  if (sessionCache && now < sessionCache.expiresAt) return sessionCache;

  // Return in-flight promise to avoid concurrent duplicate requests
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async (): Promise<YahooSession> => {
    try {
      let lastErr: unknown;
      // FIC: Retry up to 3 times with linear backoff: 1s, 2s. (EN)
      // FIC: Reintenta hasta 3 veces con backoff lineal: 1s, 2s. (ES)
      // FIC: 2 attempts with 500ms pause — fast enough for real-time requests. (EN)
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const session = await acquireSession(fetchImpl);
          sessionCache = session;
          return session;
        } catch (err) {
          lastErr = err;
          if (attempt < 1) await sleep(500);
        }
      }
      throw lastErr ?? new Error("Yahoo session failed after 3 attempts");
    } finally {
      sessionPromise = null;
    }
  })();

  return sessionPromise;
}

// FIC: Invalidate cached session — forces a fresh crumb fetch on next call. (EN)
// FIC: Invalida la sesión en caché — fuerza un nuevo crumb fetch en la próxima llamada. (ES)
export function invalidateYahooSession(): void {
  sessionCache = null;
  sessionPromise = null;
}

export { YAHOO_USER_AGENT };
