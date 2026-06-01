/**
 * FIC: Alpaca Options Service - fetches real options chain data from Alpaca Markets API.
 * Provides option contracts (strikes, expirations, types) and snapshots (bid/ask prices).
 *
 * FIC: Servicio de Opciones Alpaca - obtiene datos reales de options chain desde Alpaca Markets API.
 * Provee contratos de opciones (strikes, vencimientos, tipos) y snapshots (precios bid/ask).
 *
 * Constraint: Uses Alpaca Paper Trading API by default (https://paper-api.alpaca.markets).
 * Market data snapshots come from data endpoint (https://data.alpaca.markets).
 * Both use the same API key + secret for authentication.
 *
 * Restricción: Usa Alpaca Paper Trading API por defecto (https://paper-api.alpaca.markets).
 * Los snapshots de market data vienen del endpoint de datos (https://data.alpaca.markets).
 * Ambos usan la misma API key + secret para autenticación.
 */


// ──────────────────────────────────────────────
// FIC: Types for Alpaca API responses
// FIC: Tipos para respuestas de la API de Alpaca
// ──────────────────────────────────────────────

/**
 * FIC: Raw option contract from Alpaca /v2/options/contracts
 * FIC: Contrato de opción raw desde Alpaca /v2/options/contracts
 */
interface AlpacaOptionContract {
  id: string;
  symbol: string;
  name: string;
  status: string;
  tradable: boolean;
  style: string;
  type: "call" | "put";
  strike_price: string;
  expiration_date: string;
  root_symbol: string;
  underlying_symbol: string;
  underlying_asset_id: string;
  multiplier: number;
  open_interest?: number;
  close_price?: string;
}

/**
 * FIC: Raw option snapshot quote from Alpaca /v1beta1/options/snapshots
 * FIC: Quote de snapshot de opción raw desde Alpaca /v1beta1/options/snapshots
 */
interface AlpacaOptionSnapshotQuote {
  ap: number; // Ask price
  as: number; // Ask size
  bp: number; // Bid price
  bs: number; // Bid size
  t: string;  // Timestamp
}

/**
 * FIC: Raw option snapshot from Alpaca
 * FIC: Snapshot de opción raw desde Alpaca
 */
interface AlpacaOptionSnapshot {
  latestQuote?: AlpacaOptionSnapshotQuote;
  latestTrade?: {
    p: number;
    s: number;
    t: string;
  };
  greeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho?: number;
    implied_volatility: number;
  };
}

/**
 * FIC: Contract response from /v2/options/contracts
 * FIC: Respuesta de contratos desde /v2/options/contracts
 */
interface AlpacaContractsResponse {
  option_contracts: AlpacaOptionContract[];
  next_page_token: string | null;
}

/**
 * FIC: Snapshot response from /v1beta1/options/snapshots
 * FIC: Respuesta de snapshots desde /v1beta1/options/snapshots
 */
interface AlpacaSnapshotsResponse {
  snapshots: Record<string, AlpacaOptionSnapshot>;
  next_page_token: string | null;
}

// ──────────────────────────────────────────────
// FIC: Normalized types for the API consumer
// FIC: Tipos normalizados para el consumidor de la API
// ──────────────────────────────────────────────

/**
 * FIC: A single option contract with market data, ready for strategy consumption.
 * FIC: Un contrato de opción individual con datos de mercado, listo para consumo de estrategias.
 */
export interface OptionChainEntry {
  /** FIC: Alpaca contract symbol / Símbolo del contrato en Alpaca */
  symbol: string;
  /** FIC: Strike price / Precio de ejercicio */
  strike: number;
  /** FIC: Option type (call/put) / Tipo de opción (call/put) */
  tipo: "call" | "put";
  /** FIC: Expiration date (ISO 8601) / Fecha de vencimiento (ISO 8601) */
  expiracion: string;
  /** FIC: Current bid price from market / Precio bid actual del mercado */
  bid: number | null;
  /** FIC: Current ask price from market / Precio ask actual del mercado */
  ask: number | null;
  /** FIC: Mid price between bid and ask / Precio medio entre bid y ask */
  mid: number | null;
  /** FIC: Option style (american/european) / Estilo de opción (americana/europea) */
  estilo: string;
  /** FIC: Whether the contract is currently tradable / Si el contrato es negociable */
  tradable: boolean;
  /** FIC: Greeks summary if available (requires paid subscription) */
  greeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    implied_volatility: number;
  };
}

/**
 * FIC: Complete options chain for an underlying symbol.
 * FIC: Options chain completa para un símbolo subyacente.
 */
export interface OptionsChain {
  /** FIC: Underlying ticker / Ticker subyacente */
  ticker: string;
  /** FIC: Expiration date requested (or nearest available) / Fecha de vencimiento solicitada (o la más cercana disponible) */
  expiracion: string;
  /** FIC: Current underlying price (snapshot, if available) / Precio actual del subyacente */
  subyacente_precio: number | null;
  /** FIC: All option entries for this chain / Todas las entradas de opciones para esta chain */
  entries: OptionChainEntry[];
  /** FIC: Grouped by type for convenience / Agrupado por tipo por conveniencia */
  grouped: {
    calls: OptionChainEntry[];
    puts: OptionChainEntry[];
  };
}

// ──────────────────────────────────────────────
// FIC: Service implementation
// FIC: Implementación del servicio
// ──────────────────────────────────────────────

/**
 * FIC: Service that fetches options chain data from Alpaca Markets API.
 * Combines contract metadata from /v2/options/contracts with
 * real-time bid/ask snapshots from /v1beta1/options/snapshots.
 *
 * FIC: Servicio que obtiene datos de options chain desde Alpaca Markets API.
 * Combina metadatos de contratos de /v2/options/contracts con
 * snapshots bid/ask en tiempo real de /v1beta1/options/snapshots.
 */
export class AlpacaOptionsService {
  private readonly paperApiBase: string;
  private readonly dataApiBase: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor() {
    const apiKey = process.env.ALPACA_API_KEY;
    const apiSecret = process.env.ALPACA_SECRET_KEY;

    if (!apiKey || !apiSecret) {
      throw new Error(
        "ALPACA_API_KEY and ALPACA_SECRET_KEY must be set in environment. " +
        "ALPACA_API_KEY y ALPACA_SECRET_KEY deben estar configuradas en el entorno."
      );
    }

    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.paperApiBase = "https://paper-api.alpaca.markets";
    this.dataApiBase = "https://data.alpaca.markets";
  }

  /**
   * FIC: Fetch available expiration dates for a ticker within a relative range (from today).
   * FIC: Obtiene fechas de expiración disponibles para un ticker en un rango relativo (desde hoy).
   */
  async getExpirations(ticker: string, rangeMonths: number): Promise<string[]> {
    const today = new Date();
    const maxDate = new Date(today);
    maxDate.setMonth(maxDate.getMonth() + rangeMonths);

    const todayStr = today.toISOString().slice(0, 10);
    const maxDateStr = maxDate.toISOString().slice(0, 10);

    const contracts = await this.fetchContractsInRange(ticker, todayStr, maxDateStr);

    const dates = Array.from(
      new Set(contracts.map((c) => c.expiration_date).filter(Boolean) as string[])
    ).sort();

    if (dates.length === 0) {
      throw new Error(
        `No se encontraron expiraciones para ${ticker} en los proximos ${rangeMonths} meses. ` +
        `No expirations found for ${ticker} in the next ${rangeMonths} months.`
      );
    }

    return dates;
  }

  /**
   * FIC: Fetch the full options chain for a given ticker and expiration.
   * Returns contracts grouped by type (calls/puts) with current bid/ask prices.
   *
   * FIC: Obtiene la options chain completa para un ticker y vencimiento dados.
   * Devuelve contratos agrupados por tipo (calls/puts) con precios bid/ask actuales.
   */
  async getOptionsChain(ticker: string, expiration?: string): Promise<OptionsChain> {
    // FIC: Step 1: Fetch contracts from Alpaca
    const contracts = await this.fetchContracts(ticker, expiration);

    if (contracts.length === 0) {
      return {
        ticker: ticker.toUpperCase(),
        expiracion: expiration ?? "unknown",
        subyacente_precio: null,
        entries: [],
        grouped: { calls: [], puts: [] },
      };
    }

    // FIC: Step 2: Fetch snapshots for all contracts
    const contractSymbols = contracts.map((c) => c.symbol);
    const snapshots = await this.fetchSnapshots(contractSymbols);

    // FIC: Step 3: Build normalized entries
    const entries: OptionChainEntry[] = contracts.map((contract) => {
      const snapshot = snapshots[contract.symbol];
      const bid = snapshot?.latestQuote?.bp ?? null;
      const ask = snapshot?.latestQuote?.ap ?? null;
      const mid = bid !== null && ask !== null ? Math.round(((bid + ask) / 2) * 100) / 100 : null;
      const greeks = snapshot?.greeks
        ? {
            delta: snapshot.greeks.delta,
            gamma: snapshot.greeks.gamma,
            theta: snapshot.greeks.theta,
            vega: snapshot.greeks.vega,
            implied_volatility: snapshot.greeks.implied_volatility,
          }
        : undefined;

      return {
        symbol: contract.symbol,
        strike: parseFloat(contract.strike_price),
        tipo: contract.type,
        expiracion: contract.expiration_date,
        bid,
        ask,
        mid,
        estilo: contract.style,
        tradable: contract.tradable,
        greeks,
      };
    });

    const calls = entries.filter((e) => e.tipo === "call");
    const puts = entries.filter((e) => e.tipo === "put");

    return {
      ticker: ticker.toUpperCase(),
      expiracion: expiration ?? contracts[0]?.expiration_date ?? "unknown",
      subyacente_precio: null,
      entries,
      grouped: { calls, puts },
    };
  }

  /**
   * FIC: Fetch option contracts from Alpaca /v2/options/contracts.
   * FIC: Obtiene contratos de opciones desde Alpaca /v2/options/contracts.
   */
  private async fetchContracts(
    ticker: string,
    expiration?: string
  ): Promise<AlpacaOptionContract[]> {
    let url = `${this.paperApiBase}/v2/options/contracts?underlying_symbols=${ticker}&status=active&limit=250`;

    if (expiration) {
      // FIC: Filter by expiration date (Alpaca expects YYYY-MM-DD)
      const expDate = expiration.substring(0, 10);
      url += `&expiration_date_gte=${expDate}&expiration_date_lte=${expDate}`;
    }

    const response = await this.get(url);
    const data = (await response.json()) as AlpacaContractsResponse;
    return data.option_contracts ?? [];
  }

  /**
   * FIC: Fetch option contracts within a date range from Alpaca /v2/options/contracts.
   * FIC: Obtiene contratos de opciones en un rango de fechas desde Alpaca /v2/options/contracts.
   */
  private async fetchContractsInRange(
    ticker: string,
    startDate: string,
    endDate: string
  ): Promise<AlpacaOptionContract[]> {
    const url = `${this.paperApiBase}/v2/options/contracts?` +
      `underlying_symbols=${ticker}&status=active&limit=250` +
      `&expiration_date_gte=${startDate}&expiration_date_lte=${endDate}`;

    const response = await this.get(url);
    const data = (await response.json()) as AlpacaContractsResponse;
    return data.option_contracts ?? [];
  }

  /**
   * FIC: Fetch option snapshots (bid/ask/greeks) from Alpaca /v1beta1/options/snapshots.
   * FIC: Obtiene snapshots de opciones (bid/ask/griegas) desde Alpaca /v1beta1/options/snapshots.
   */
  private async fetchSnapshots(
    symbols: string[]
  ): Promise<Record<string, AlpacaOptionSnapshot>> {
    // FIC: Alpaca limits symbols in snapshots request, batch if needed
    const batchSize = 100;
    const allSnapshots: Record<string, AlpacaOptionSnapshot> = {};

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const symbolsParam = batch.join(",");
      const url = `${this.dataApiBase}/v1beta1/options/snapshots?symbols=${symbolsParam}`;

      const response = await this.get(url);
      const data = (await response.json()) as AlpacaSnapshotsResponse;

      if (data.snapshots) {
        Object.assign(allSnapshots, data.snapshots);
      }
    }

    return allSnapshots;
  }

  /**
   * FIC: Helper to make authenticated GET request to Alpaca API.
   * FIC: Helper para hacer request GET autenticado a la API de Alpaca.
   */
  private async get(url: string): Promise<Response> {
    const response = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": this.apiKey,
        "APCA-API-SECRET-KEY": this.apiSecret,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "Unknown error");
      throw new Error(
        `Alpaca API error: ${response.status} ${response.statusText} - ${body}. ` +
        `Error de API Alpaca: ${response.status} ${response.statusText} - ${body}`
      );
    }

    return response;
  }
}

/**
 * FIC: Factory function to create an AlpacaOptionsService instance.
 * FIC: Función de fábrica para crear una instancia de AlpacaOptionsService.
 */
export function createAlpacaOptionsService(): AlpacaOptionsService {
  return new AlpacaOptionsService();
}

export default AlpacaOptionsService;
