// FIC: Strategy API service for TEAM-08 complex options strategy endpoints.
// FIC: Servicio API para endpoints de estrategias complejas de opciones (TEAM-08).

export interface OptionsChainEntry {
  symbol: string;
  strike: number;
  tipo: "call" | "put";
  expiracion: string;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  estilo: string;
  tradable: boolean;
  greeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  };
}

export interface OptionsChainResponse {
  ticker: string;
  expiracion: string;
  total_contratos: number;
  total_calls: number;
  total_puts: number;
  resumen: {
    call_strike_min: number;
    call_strike_max: number;
    put_strike_min: number;
    put_strike_max: number;
  };
  grouped: {
    calls: OptionsChainEntry[];
    puts: OptionsChainEntry[];
  };
}

export interface StrikeSelection {
  strike: number;
  tipo: "call" | "put";
  posicion: "long" | "short";
}

export interface FromChainRequest {
  strategy_type: string;
  ticker: string;
  expiracion?: string;
  strikes: StrikeSelection[];
  contratos: number;
  tipo_ala: string;
  tolerancia_riesgo: string;
  estilo_opcion: string;
  portfolio: {
    valor_portafolio_usd: number;
    poder_compra_usd: number;
    margen_actual_usd: number;
    posiciones_actuales: number;
  };
}

export interface PremiumUsed {
  strike: number;
  tipo: string;
  posicion: string;
  prima: number;
  bid: number | null;
  ask: number | null;
  symbol?: string;
}

export interface FromChainResponse {
  strategy_type: string;
  ticker: string;
  expiracion: string;
  strikes: number[];
  premiums_used: PremiumUsed[];
  profile: Record<string, unknown>;
  simulation: Record<string, unknown>;
  risk: Record<string, unknown>;
  report: Record<string, unknown>;
  summary: Record<string, unknown>;
}

// ── Alpaca Execution Types ────────────────────────────────

export interface AlpacaAccountBalance {
  success: boolean;
  cash: number;
  equity: number;
  buyingPower: number;
  broker: string;
  mode: string;
}

export interface AlpacaOrderResult {
  orderId: string;
  state: string;
  instrument: string;
  orderType: string;
  quantity: number;
  filledQuantity: number;
  price?: number;
  executionPrice?: number;
  timestamp: string;
  metadata: {
    broker: string;
    nativeOrderId: string;
    nativeState: string;
    brokerId: string;
  };
}

export interface AlpacaOrderListResponse {
  success: boolean;
  orders: AlpacaOrderResult[];
  total: number;
}

export interface AlpacaExecuteOrderRequest {
  instrument: string;
  orderType: "BUY" | "SELL";
  quantity: number;
  price?: number;
  idempotencyKey?: string;
}

export interface AlpacaSingleOrderResponse {
  success: boolean;
  order: AlpacaOrderResult;
}

export interface AlpacaCancelResponse {
  success: boolean;
  orderId: string;
  state: string;
  message: string;
  metadata: AlpacaOrderResult["metadata"];
}

export interface OptionsStrategyLeg {
  symbol: string;
  side: "buy" | "sell";
  ratioQty: number;
}

export interface ExecuteOptionsStrategyRequest {
  legs: OptionsStrategyLeg[];
  type?: "market" | "limit";
  price?: number;
  idempotencyKey?: string;
}

const API_BASE = "/api/strategies/complex";

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const storageToken =
    typeof window !== "undefined" ? window.localStorage.getItem("inversions.dev.token") ?? undefined : undefined;
  const envToken = import.meta.env.VITE_DEV_BEARER_TOKEN as string | undefined;
  const token = storageToken || envToken;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchOptionsChain(ticker: string, expiration?: string): Promise<OptionsChainResponse> {
  const params = new URLSearchParams({ ticker });
  if (expiration) params.set("expiration", expiration);

  const response = await fetch(`${API_BASE}/options-chain?${params.toString()}`, {
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) {
    if (response.status === 404) throw new Error(`No hay opciones disponibles para ${ticker}${expiration ? ` (${expiration})` : ""}`);
    if (response.status === 502) throw new Error("Error de autenticacion con Alpaca. Verifica las API keys.");
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(`Error ${response.status}: ${text}`);
  }

  return (await response.json()) as OptionsChainResponse;
}

// ── Alpaca Execution API Functions ─────────────────────────

export async function fetchAccountBalance(): Promise<AlpacaAccountBalance> {
  const response = await fetch(`${API_BASE}/account`, {
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(`Error ${response.status}: ${text}`);
  }

  return (await response.json()) as AlpacaAccountBalance;
}

export async function executeOptionsStrategy(payload: ExecuteOptionsStrategyRequest): Promise<AlpacaOrderResult> {
  const response = await fetch(`${API_BASE}/execute-options-strategy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as Record<string, unknown>).error as string || `Error ${response.status} al ejecutar estrategia de opciones`);
  }

  return (await response.json()) as AlpacaOrderResult;
}

export async function executeAlpacaOrder(payload: AlpacaExecuteOrderRequest): Promise<AlpacaOrderResult> {
  const response = await fetch(`${API_BASE}/execute-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as Record<string, unknown>).error as string || `Error ${response.status} al ejecutar orden`);
  }

  return (await response.json()) as AlpacaOrderResult;
}

export async function fetchActiveOrders(): Promise<AlpacaOrderListResponse> {
  const response = await fetch(`${API_BASE}/orders`, {
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(`Error ${response.status}: ${text}`);
  }

  return (await response.json()) as AlpacaOrderListResponse;
}

export async function cancelAlpacaOrder(orderId: string): Promise<AlpacaCancelResponse> {
  const response = await fetch(`${API_BASE}/orders/${orderId}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as Record<string, unknown>).error as string || `Error ${response.status} al cancelar orden`);
  }

  return (await response.json()) as AlpacaCancelResponse;
}

export async function fetchSingleOrder(orderId: string): Promise<AlpacaSingleOrderResponse> {
  const response = await fetch(`${API_BASE}/orders/${orderId}`, {
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) {
    throw new Error(`Error ${response.status} al consultar orden`);
  }

  return (await response.json()) as AlpacaSingleOrderResponse;
}

export async function executeStrategy(payload: FromChainRequest): Promise<FromChainResponse> {
  const response = await fetch(`${API_BASE}/from-chain`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    if (response.status === 400) {
      const err = JSON.parse(text);
      throw new Error(err.error || `Error de validacion: ${text}`);
    }
    if (response.status === 404) throw new Error(`No hay opciones disponibles para ${payload.ticker}`);
    if (response.status === 502) throw new Error("Error de autenticacion con Alpaca. Verifica las API keys.");
    throw new Error(`Error ${response.status}: ${text}`);
  }

  return (await response.json()) as FromChainResponse;
}
