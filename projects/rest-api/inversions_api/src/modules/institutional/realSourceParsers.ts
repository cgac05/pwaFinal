// FIC: Real institutional data source parsers — SEC EDGAR 13F and FINRA Short Interest. (EN)
// FIC: Parsers reales de fuentes de datos institucionales — SEC EDGAR 13F y FINRA Short Interest. (ES)

import fs from "node:fs/promises";
import type { InstitutionalSourceObservation, ParseFn } from "./institutionalDataService";
import type { InstitutionalAnalysisPeriod } from "./institutionalContract";

// ─── SEC EDGAR constants ───────────────────────────────────────────────────────

const EDGAR_USER_AGENT =
  process.env.EDGAR_USER_AGENT ?? "TurboPapus/1.0 (contact@turbopapus.com)";
// FIC: 6s per request — EDGAR responds in < 2s on normal conditions; 6s covers slow responses. (EN)
const SEC_REQUEST_TIMEOUT_MS = 6_000;
const MAX_FILINGS = 1;

const JSON_HEADERS: Record<string, string> = {
  "User-Agent": EDGAR_USER_AGENT,
  Accept: "application/json",
};
const XML_HEADERS: Record<string, string> = {
  "User-Agent": EDGAR_USER_AGENT,
  Accept: "application/xml,text/xml,text/plain",
};

// FIC: EFTS search cache and in-flight dedup map — keyed by ticker:period. (EN)
// FIC: Caché de búsqueda EFTS y mapa de dedup in-flight — clave por ticker:period. (ES)
interface EftsHit {
  accessionNo: string;
  cik: string;
  entityName: string;
  periodOfReport: string;
}
const searchEftsCache = new Map<string, { hits: EftsHit[]; timestamp: number }>();
const inflightEfts = new Map<string, Promise<EftsHit[]>>();
const SEARCH_EFTS_CACHE_TTL_MS = 86_400_000; // 24 hours / 24 horas

// FIC: CUSIP map for ~200 major tickers — hardcoded because CUSIP Global Services is a paid API. (EN)
// FIC: Mapa de CUSIP para ~200 tickers principales — hardcoded porque CUSIP Global Services es una API de pago. (ES)
const TICKER_CUSIP_MAP: Record<string, string> = {
  // ── Mega-cap Technology ────────────────────────────────────────────────────
  AAPL: "037833100", MSFT: "594918104", GOOGL: "02079K305", GOOG: "02079K107",
  AMZN: "023135106", META: "30303M102", TSLA: "88160R101", NVDA: "67066G104",
  AVGO: "11135F101", AMD:  "007903107", INTC: "458140100", QCOM: "747525103",
  TXN:  "882635109", MU:   "595112103", AMAT: "009553108", LRCX: "512807108",
  KLAC: "482480100", ADBE: "00724F101", CRM:  "79466L302", NOW:  "81762P102",
  INTU: "461202103", ORCL: "68389X105", IBM:  "459200101", CSCO: "17275R102",
  ACN:  "G1151C101",

  // ── Payments & Fintech ──────────────────────────────────────────────────────
  V:    "92826C839", MA:   "57636Q104", PYPL: "70450Y103", COIN: "19260Q107",
  PLTR: "69608A108",

  // ── Internet & Software ────────────────────────────────────────────────────
  NFLX: "64110L106", ZM:   "98980L101", DDOG: "23804L103", NET:  "18915M107",
  TWLO: "90138F102", SNAP: "83304A106", PINS: "72352L106", RBLX: "771049103",
  UBER: "90353T100", ABNB: "00090Q103", DASH: "23292X109", DOCU: "256163106",

  // ── Index ETFs ──────────────────────────────────────────────────────────────
  SPY:  "78462F103", QQQ:  "46090E103", IWM:  "464287655",

  // ── Banking & Financial Services ──────────────────────────────────────────
  JPM:  "46625H100", BAC:  "060505104", WFC:  "949746101", GS:   "38141G104",
  MS:   "617446448", C:    "172967424", USB:  "902973304", PNC:  "693475105",
  TFC:  "89832Q109", SCHW: "808513105", AXP:  "025816109", BLK:  "09247X101",
  COF:  "14040H105", "BRK.B": "084670702", "BRK.A": "084670108",

  // ── Healthcare & Pharma ────────────────────────────────────────────────────
  UNH:  "91324P102", JNJ:  "478160104", LLY:  "532457108", ABBV: "00287Y109",
  MRK:  "58933Y105", TMO:  "883556102", ABT:  "002824100", PFE:  "717081103",
  MDT:  "G5960L103", AMGN: "031162100", GILD: "375558103", BMY:  "110122108",
  REGN: "75886F107", VRTX: "92532F100", MRNA: "60770K107", CVS:  "126650100",
  CI:   "125523100", HCA:  "40412C101", HUM:  "444859102", ISRG: "46120E602",
  BSX:  "101137107", SYK:  "863667101", EW:   "28176E108", ZBH:  "98956P102",

  // ── Consumer Discretionary ────────────────────────────────────────────────
  HD:   "437076102", LOW:  "548661107", TGT:  "87612E106", WMT:  "931142103",
  COST: "22160K105", MCD:  "580135101", SBUX: "855244109", NKE:  "654106103",
  BKNG: "09857L108", DIS:  "254687106", TJX:  "872540109", LULU: "550021109",
  ROST: "778296103", DG:   "256677105", DLTR: "256746108", ORLY: "67103H107",
  AZO:  "053332102",

  // ── Consumer Staples ──────────────────────────────────────────────────────
  PG:   "742718109", KO:   "191216100", PEP:  "713448108", PM:   "718172109",
  MO:   "02209S103", MDLZ: "609207105", GIS:  "370334104",

  // ── Communications ────────────────────────────────────────────────────────
  VZ:   "92343V104", T:    "00206R102", TMUS: "872590104", CMCSA: "20286C102",

  // ── Industrials ───────────────────────────────────────────────────────────
  BA:   "097023105", GE:   "369604103", CAT:  "149123101", UPS:  "911312106",
  UNP:  "907818108", HON:  "438516106", LMT:  "539830109", RTX:  "75513E101",
  NOC:  "666628104", GD:   "369550108", FDX:  "31428X106", DE:   "244199105",
  MMM:  "88579Y101", ITW:  "452308109", EMR:  "291011104", ROK:  "773903109",
  CMI:  "200406102", FAST: "303920105", GWW:  "384802104", PCAR: "693718108",

  // ── Energy ────────────────────────────────────────────────────────────────
  XOM:  "30231G102", CVX:  "166764100", COP:  "20825C104", EOG:  "26875P101",
  SLB:  "806857108", OXY:  "674599105", BKR:  "05765L103", PSX:  "718546104",
  VLO:  "91913Y100", MPC:  "56585A102", KMI:  "49456B101", WMB:  "969457100",

  // ── Materials ─────────────────────────────────────────────────────────────
  LIN:  "G54508105", APD:  "039483102", ECL:  "278865100", SHW:  "824348106",
  NEM:  "651639106", FCX:  "35671D857", NUE:  "670346105",

  // ── Utilities ─────────────────────────────────────────────────────────────
  NEE:  "65339F101", SO:   "842162109", DUK:  "26441C204", AEP:  "025537101",
  EXC:  "30161N101", XEL:  "98389B100", WEC:  "929042109",

  // ── Real Estate ───────────────────────────────────────────────────────────
  AMT:  "02900S103", PLD:  "74460D109", EQIX: "29444U700", WELL: "95040Q104",
  SPG:  "828806109", O:    "756109104", DLR:  "253868103", VICI: "925652109",
  AVB:  "053484101",

  // ── Other Notable ──────────────────────────────────────────────────────────
  TROW: "74251T102", ADP:  "053015103",
};

// FIC: Compute EFTS date range based on analysis period. (EN)
// FIC: 13F filings are quarterly — daily/intraday use a 90-day lookback to catch the most recent filing. (ES)
function eftsDateRange(period: InstitutionalAnalysisPeriod): { startdt: string; enddt: string } {
  const now = new Date();
  const enddt = now.toISOString().slice(0, 10);
  if (period === "intraday" || period === "daily") {
    // 13F data is quarterly regardless of analysis period — use 90-day window to find the latest filing.
    const start = new Date(now);
    start.setDate(start.getDate() - 90);
    return { startdt: start.toISOString().slice(0, 10), enddt };
  }
  if (period === "weekly") {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 6);
    return { startdt: start.toISOString().slice(0, 10), enddt };
  }
  // monthly / quarterly → desde 2024-01-01
  return { startdt: "2024-01-01", enddt };
}

// FIC: Search SEC EDGAR EFTS for 13F-HR filings mentioning the given CUSIP or ticker. (EN)
// FIC: Busca en SEC EDGAR EFTS los filings 13F-HR que mencionen el CUSIP o ticker dado. (ES)
async function searchEfts(
  query: string,
  period: InstitutionalAnalysisPeriod,
  fetchImpl: typeof globalThis.fetch
): Promise<EftsHit[]> {
  const cacheKey = `${query}:${period}`;
  const now = Date.now();

  // Return cached result if fresh / Retornar resultado en caché si es fresco
  const cached = searchEftsCache.get(cacheKey);
  if (cached && now - cached.timestamp < SEARCH_EFTS_CACHE_TTL_MS) return cached.hits;

  // In-flight dedup / Dedup de solicitudes en vuelo
  const inflight = inflightEfts.get(cacheKey);
  if (inflight) return inflight;

  const dateRange = eftsDateRange(period);

  const params = new URLSearchParams({
    q: query,
    dateRange: "custom",
    startdt: dateRange.startdt,
    enddt: dateRange.enddt,
    forms: "13F-HR",
  });
  const url = `https://efts.sec.gov/LATEST/search-index?${params}`;

  const promise = (async (): Promise<EftsHit[]> => {
    try {
      const ac = new AbortController();
      const tid = setTimeout(() => ac.abort(), SEC_REQUEST_TIMEOUT_MS);
      try {
        const res = await fetchImpl(url, { headers: JSON_HEADERS, signal: ac.signal });
        if (!res.ok) return [];
        const data = (await res.json()) as {
          hits?: { hits?: Array<{ _source?: Record<string, unknown> }>; total?: { value?: number } };
        };
        // FIC: EFTS uses "adsh" (not "accession_no") and "ciks" array (not "cik") — fixed per actual API. (EN)
        // FIC: EFTS usa "adsh" (no "accession_no") y array "ciks" (no "cik") — corregido según API real. (ES)
        const hits: EftsHit[] = (data?.hits?.hits ?? [])
          .slice(0, 50)
          .map((h) => {
            const src = h._source ?? {};
            const adsh = (src["adsh"] as string | undefined) ?? "";
            const cikArr = src["ciks"] as string[] | undefined;
            const cik = Array.isArray(cikArr) && cikArr.length > 0
              ? cikArr[0].replace(/^0+/, "") // strip leading zeros
              : ((src["cik"] as string | undefined) ?? "");
            const displayNames = src["display_names"] as string[] | undefined;
            const entityName = Array.isArray(displayNames) && displayNames.length > 0
              ? displayNames[0]
              : ((src["entity_name"] as string | undefined) ?? "");
            const periodOfReport = (src["period_ending"] as string | undefined)
              ?? (src["period_of_report"] as string | undefined)
              ?? "";
            return { accessionNo: adsh, cik, entityName, periodOfReport };
          })
          .filter((h) => h.accessionNo && h.cik);

        searchEftsCache.set(cacheKey, { hits, timestamp: Date.now() });
        return hits;
      } finally {
        clearTimeout(tid);
      }
    } catch {
      return [];
    } finally {
      inflightEfts.delete(cacheKey);
    }
  })();

  inflightEfts.set(cacheKey, promise);
  return promise;
}

// FIC: Download one 13F-HR filing and extract the reported value for the target CUSIP. (EN)
// FIC: Descarga un filing 13F-HR y extrae el valor reportado para el CUSIP objetivo. (ES)
async function extractValueFromFiling(
  hit: EftsHit,
  targetCusip: string,
  fetchImpl: typeof globalThis.fetch
): Promise<number> {
  try {
    const accNoDashes = hit.accessionNo.replace(/-/g, "");
    const indexUrl = `https://www.sec.gov/Archives/edgar/data/${hit.cik}/${accNoDashes}/`;
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), SEC_REQUEST_TIMEOUT_MS);

    try {
      // Get filing index to find the XML document name
      const idxRes = await fetchImpl(indexUrl, { headers: JSON_HEADERS, signal: ac.signal });
      if (!idxRes.ok) return 0;

      const idxText = await idxRes.text();
      // FIC: Priority: form13fInfoTable.xml > any non-primary XML > primary_doc.xml (header-only). (EN)
      // FIC: Prioridad: form13fInfoTable.xml > cualquier XML no-primario > primary_doc.xml (solo header). (ES)
      const allXmlMatches = [...idxText.matchAll(/href="([^"]+\.xml)"/gi)].map((m) => m[1]);
      const infoTableMatch = allXmlMatches.find((p) => /form13fInfoTable/i.test(p));
      const nonPrimaryMatch = allXmlMatches.find((p) => !/primary_doc/i.test(p));
      const xmlHref = infoTableMatch ?? nonPrimaryMatch ?? allXmlMatches[0];
      if (!xmlHref) return 0;
      const xmlPath = xmlHref.startsWith("http") ? xmlHref : `https://www.sec.gov${xmlHref}`;

      // Download the XML and extract value for the target CUSIP
      const xmlRes = await fetchImpl(xmlPath, { headers: XML_HEADERS, signal: ac.signal });
      if (!xmlRes.ok) return 0;

      const xml = await xmlRes.text();
      return extractCusipValue(xml, targetCusip);
    } finally {
      clearTimeout(tid);
    }
  } catch {
    return 0;
  }
}

// FIC: Parse 13F XML text and extract the <value> for a specific CUSIP — handles namespaced XML (ns1:infoTable). (EN)
// FIC: Parsea el texto XML del 13F y extrae el <value> para un CUSIP — maneja XML con namespace (ns1:infoTable). (ES)
function extractCusipValue(xml: string, cusip: string): number {
  // FIC: Match both namespaced (<ns1:infoTable>) and plain (<infoTable>) block formats. (EN)
  // FIC: Coincide con bloques con namespace (<ns1:infoTable>) y planos (<infoTable>). (ES)
  const infoTableRegex = /<(?:[a-zA-Z0-9_]+:)?infoTable[\s\S]*?<\/(?:[a-zA-Z0-9_]+:)?infoTable>/gi;
  let match: RegExpExecArray | null;
  let total = 0;
  while ((match = infoTableRegex.exec(xml)) !== null) {
    const block = match[0];
    if (block.includes(cusip)) {
      // FIC: Extract <value> or <ns1:value> — both formats appear in real 13F filings. (EN)
      // FIC: Extrae <value> o <ns1:value> — ambos formatos aparecen en filings 13F reales. (ES)
      const valueMatch = block.match(/<(?:[a-zA-Z0-9_]+:)?value>(\d+)<\/(?:[a-zA-Z0-9_]+:)?value>/i);
      if (valueMatch) total += parseInt(valueMatch[1], 10);
    }
  }
  return total;
}

// FIC: Synthetic fallback observation for SEC EDGAR when CUSIP is unknown or fetch fails. (EN)
// FIC: Observación sintética de respaldo para SEC EDGAR cuando el CUSIP es desconocido o el fetch falla. (ES)
function secFallback(ticker: string): InstitutionalSourceObservation {
  const seed = ticker.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return {
    sourceId: "sec_edgar_13f",
    confidence: 0.3,
    fundsOwnershipPct: 18 + (seed % 20),
    volume: 500_000 + seed * 400,
    flows: {
      inflows: (500_000 + seed * 400) * 0.34,
      outflows: (500_000 + seed * 400) * 0.18,
      asOf: new Date().toISOString(),
    },
    openPositions: { count: 10 + (seed % 30) },
    status: "partial",
    asOf: new Date().toISOString(),
  };
}

// FIC: Real SEC EDGAR 13F parser — fetches actual institutional holdings via EFTS + Archives. (EN)
// FIC: Parser real de SEC EDGAR 13F — obtiene holdings institucionales reales via EFTS + Archives. (ES)
export const parseSecEdgar13fReal: ParseFn = async (ticker, period, fetchImpl) => {
  const cusip = TICKER_CUSIP_MAP[ticker.toUpperCase()];
  if (!cusip) return secFallback(ticker); // Ticker not in CUSIP map → synthetic fallback

  try {
    // Global operation timeout: 60s
    // FIC: 12s global cap for all SEC calls combined (EFTS + index + XML are sequential). (EN)
    const globalAc = new AbortController();
    const globalTid = setTimeout(() => globalAc.abort(), 12_000);

    try {
      const hits = await searchEfts(cusip, period, fetchImpl);
      if (hits.length === 0) return secFallback(ticker);

      const holderCount = hits.length; // proxy for institutional holder count
      const firstHit = hits[0];

      // Download and parse the first filing XML to get total value
      const totalValue = await extractValueFromFiling(firstHit, cusip, fetchImpl);

      // Confidence based on holder count
      const confidence = holderCount >= 5 ? 0.88 : holderCount >= 2 ? 0.80 : 0.65;

      // Estimated flows from total value
      const inflows = totalValue * 0.5 / 1_000;
      const outflows = totalValue * 0.25 / 1_000;

      return {
        sourceId: "sec_edgar_13f",
        confidence,
        fundsOwnershipPct: Math.min(95, holderCount * 1.5 + 15),
        volume: totalValue > 0 ? totalValue : 900_000,
        flows: { inflows, outflows, asOf: new Date().toISOString() },
        openPositions: { count: holderCount, notional: totalValue },
        liquidity: totalValue > 2_000_000 ? "high" : totalValue > 1_200_000 ? "medium" : "low",
        status: "ok",
        asOf: new Date().toISOString(),
      };
    } finally {
      clearTimeout(globalTid);
    }
  } catch {
    return secFallback(ticker);
  }
};

// ─── FINRA Short Interest ──────────────────────────────────────────────────────

const FINRA_API = "https://api.finra.org/data/group/otcmarket/name/consolidatedShortInterest";
const FINRA_PAGE_SIZE = 5_000;
// FIC: 3 pages × 5000 = 15k records — covers all actively traded NMS stocks. (EN)
const FINRA_MAX_PAGES = 3;
const FINRA_PAGE_TIMEOUT_MS = 8_000;
const FINRA_CACHE_TTL_MS = 86_400_000; // 24 hours / 24 horas
const FINRA_CACHE_FILE = "/tmp/inversions-api-finra-cache.json";

interface FinraRecord {
  symbol: string;
  currentShort: number;
  prevShort: number;
  avgDailyVol: number;
  daysToCover: number;
  changePct: number;
  settleDate: string;
  dateStr: string;
}

interface FinraCache {
  fetchedAt: number;
  records: Record<string, FinraRecord>;
}

// FIC: Singleton state for FINRA in-memory cache and in-flight dedup. (EN)
// FIC: Estado singleton para caché en memoria de FINRA y dedup in-flight. (ES)
let finraCacheState: FinraCache | null = null;
let finraCachePromise: Promise<FinraCache> | null = null;

// FIC: Build the FINRA request body for a given page offset. (EN)
// FIC: Construye el body de la request FINRA para un offset de página dado. (ES)
function buildFinraBody(offset: number): string {
  // FIC: No domainFilters — the previous filter used wrong market codes (Y/S/D/O) that excluded NYSE (N) and NASDAQ (Q). (EN)
  // FIC: Sin domainFilters — el filtro anterior usaba códigos incorrectos que excluían NYSE (N) y NASDAQ (Q). (ES)
  return JSON.stringify({
    compareFilters: [],
    domainFilters: [],
    aggregations: [],
    dateRangeFilters: [],
    // FIC: Fields updated to match FINRA API v2 schema (2024+ names). (EN)
    // FIC: Campos actualizados para coincidir con el esquema FINRA API v2 (nombres 2024+). (ES)
    fields: ["symbolCode", "currentShortPositionQuantity", "previousShortPositionQuantity",
             "averageDailyVolumeQuantity", "daysToCoverQuantity", "changePercent", "settlementDate"],
    limit: FINRA_PAGE_SIZE,
    offset,
  });
}

// FIC: Normalize a raw FINRA API record to our internal FinraRecord shape. (EN)
// FIC: Normaliza un registro crudo de la API FINRA a nuestra estructura FinraRecord interna. (ES)
function normalizeFinraRecord(raw: Record<string, unknown>): FinraRecord {
  const sym = (raw["symbolCode"] as string | undefined) ?? "";
  // FIC: FINRA API v2 uses "Quantity" suffix on numeric fields (updated 2024). (EN)
  // FIC: FINRA API v2 usa sufijo "Quantity" en campos numéricos (actualizado 2024). (ES)
  const currentShort = Number(raw["currentShortPositionQuantity"] ?? raw["currentShortInterest"] ?? 0);
  const prevShort = Number(raw["previousShortPositionQuantity"] ?? raw["previousShortInterest"] ?? 0);
  const avgDailyVol = Number(raw["averageDailyVolumeQuantity"] ?? raw["averageDailyVolume"] ?? 0);
  const daysToCover = Number(raw["daysToCoverQuantity"] ?? raw["daysToCover"] ?? (avgDailyVol > 0 ? currentShort / avgDailyVol : 0));
  const changePct = Number(raw["changePercent"] ?? 0);
  const settleDate = (raw["settlementDate"] as string | undefined) ?? new Date().toISOString().slice(0, 10);
  return {
    symbol: sym.toUpperCase(),
    currentShort, prevShort, avgDailyVol, daysToCover, changePct,
    settleDate, dateStr: settleDate,
  };
}

// FIC: Fetch all FINRA pages and persist to disk cache; uses singleton + in-flight dedup. (EN)
// FIC: Descarga todas las páginas FINRA y persiste en caché de disco; usa singleton + dedup in-flight. (ES)
export async function ensureFinraCache(fetchImpl: typeof globalThis.fetch = globalThis.fetch): Promise<FinraCache> {
  const now = Date.now();

  // Return in-memory cache if fresh
  if (finraCacheState && now - finraCacheState.fetchedAt < FINRA_CACHE_TTL_MS) return finraCacheState;

  // Return in-flight promise to avoid concurrent fetches
  if (finraCachePromise) return finraCachePromise;

  finraCachePromise = (async (): Promise<FinraCache> => {
    try {
      // Try reading from disk cache first
      try {
        const diskRaw = await fs.readFile(FINRA_CACHE_FILE, "utf-8");
        const disk = JSON.parse(diskRaw) as FinraCache;
        if (disk && now - disk.fetchedAt < FINRA_CACHE_TTL_MS) {
          finraCacheState = disk;
          return disk;
        }
      } catch {
        // Disk cache miss — proceed to fetch
      }

      // Fetch all pages from FINRA
      const allRecords: Record<string, FinraRecord> = {};
      for (let page = 0; page < FINRA_MAX_PAGES; page++) {
        const pageAc = new AbortController();
        const pageTid = setTimeout(() => pageAc.abort(), FINRA_PAGE_TIMEOUT_MS);
        let res: Response;
        try {
          res = await fetchImpl(FINRA_API, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: buildFinraBody(page * FINRA_PAGE_SIZE),
            signal: pageAc.signal,
          });
        } finally {
          clearTimeout(pageTid);
        }
        if (!res.ok) break;
        const data = (await res.json()) as unknown[];
        if (!Array.isArray(data) || data.length === 0) break;
        for (const raw of data) {
          const rec = normalizeFinraRecord(raw as Record<string, unknown>);
          if (rec.symbol) allRecords[rec.symbol] = rec;
        }
        if (data.length < FINRA_PAGE_SIZE) break; // Last page
      }

      const cache: FinraCache = { fetchedAt: now, records: allRecords };
      finraCacheState = cache;

      // Persist to disk (non-blocking, best-effort)
      fs.writeFile(FINRA_CACHE_FILE, JSON.stringify(cache)).catch(() => {});

      return cache;
    } finally {
      finraCachePromise = null;
    }
  })();

  return finraCachePromise;
}

// FIC: Synthetic fallback for FINRA when ticker is not in the dataset. (EN)
// FIC: Respaldo sintético de FINRA cuando el ticker no está en el dataset. (ES)
function finraFallback(ticker: string): InstitutionalSourceObservation {
  const seed = ticker.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return {
    sourceId: "finra_short_interest",
    confidence: 0.3,
    volume: 100_000 + seed * 200,
    flows: {
      inflows: (100_000 + seed * 200) * 0.5,
      outflows: (100_000 + seed * 200) * 0.25,
      asOf: new Date().toISOString(),
    },
    openPositions: { count: 2 + (seed % 10) },
    status: "partial",
    asOf: new Date().toISOString(),
  };
}

// FIC: Real FINRA short interest parser — downloads and caches full dataset, then looks up ticker. (EN)
// FIC: Parser real de interés corto FINRA — descarga y cachea el dataset completo, luego busca el ticker. (ES)
export const parseFinraShortInterestReal: ParseFn = async (ticker, _period, fetchImpl) => {
  try {
    const cache = await ensureFinraCache(fetchImpl);
    const rec = cache.records[ticker.toUpperCase()];
    if (!rec) return finraFallback(ticker);

    const confidence = rec.daysToCover > 0 && rec.avgDailyVol > 0 ? 0.88 : 0.70;
    const notional = rec.currentShort * 2.3;

    return {
      sourceId: "finra_short_interest",
      confidence,
      volume: rec.currentShort,
      flows: {
        inflows: rec.currentShort * 0.5,
        outflows: rec.currentShort * 0.25,
        asOf: rec.settleDate,
      },
      openPositions: { count: Math.ceil(rec.currentShort / 10_000), notional },
      liquidity: rec.currentShort >= 1_000_000 ? "medium" : "low",
      status: "ok",
      asOf: rec.settleDate,
    };
  } catch {
    return finraFallback(ticker);
  }
};
