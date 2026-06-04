/**
 * T030: Alpaca Broker Adapter Implementation
 * ==========================================
 * Adaptador concreto para Alpaca broker.
 *
 * Funcionalidad:
 * - Implementar submitOrder con reintentos y backoff exponencial (timeout 5s, 2 reintentos)
 * - Normalizar respuestas de Alpaca a tipos comunes
 * - Mapear estados Alpaca a estados canonicos
 * - Implementar idempotencia via idempotency_key
 * - Manejar errores y codigos de fallo estandar
 * - submitOptionsStrategy para ordenes multi-leg de opciones
 * - listOrders para listar ordenes activas
 *
 * Mapeo: FR-008, PL-002, PL-010
 *
 * Ahora con llamadas HTTP reales a la API de Alpaca Markets.
 */

import {
  BaseBrokerAdapter,
  OrderType,
  OrderState,
  NormalizedOrderResponse,
  NormalizedBrokerError,
} from './brokerAdapter';

// ──────────────────────────────────────────────
// FIC: Types for Alpaca API responses
// FIC: Tipos para respuestas de la API de Alpaca
// ──────────────────────────────────────────────

/**
 * FIC: Request body for POST /v2/orders
 * FIC: Cuerpo de solicitud para POST /v2/orders
 */
interface AlpacaOrderRequest {
  symbol: string;
  qty: number;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  limit_price?: number;
  time_in_force: 'day' | 'gtc';
}

/**
 * FIC: Raw order response from Alpaca /v2/orders
 * FIC: Respuesta de orden raw desde Alpaca /v2/orders
 */
interface AlpacaOrderResponse {
  id: string;
  client_order_id?: string;
  symbol: string;
  qty: string | number;
  filled_qty: string | number;
  status: string;
  side: string;
  type: string;
  filled_avg_price?: string | number | null;
  created_at: string;
  updated_at: string;
}

/**
 * FIC: Raw account response from Alpaca /v2/account
 * FIC: Respuesta de cuenta raw desde Alpaca /v2/account
 */
interface AlpacaAccountResponse {
  id: string;
  account_number: string;
  status: string;
  cash: string | number;
  portfolio_value: string | number;
  buying_power: string | number;
  equity: string | number;
}

// ──────────────────────────────────────────────
// FIC: State mapping & url helpers
// ──────────────────────────────────────────────

/**
 * FIC: Mapeo de estados Alpaca a estados canonicos
 * FIC: Mapping from Alpaca states to canonical states
 */
const ALPACA_STATE_MAP: Record<string, OrderState> = {
  'pending_new': 'PENDING',
  'accepted': 'ACCEPTED',
  'new': 'SUBMITTED',
  'partially_filled': 'PARTIALLY_FILLED',
  'filled': 'FILLED',
  'done_for_day': 'FILLED',
  'cancelled': 'CANCELLED',
  'expired': 'CANCELLED',
  'rejected': 'REJECTED',
  'suspended': 'ERROR',
  'stopped': 'ERROR',
};

/**
 * FIC: Alpaca API base URL — uses paper trading by default.
 * FIC: URL base de la API de Alpaca — usa paper trading por defecto.
 */
function getAlpacaApiBase(): string {
  const raw = process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets';
  // FIC: Strip trailing /v2 if present so we always append it explicitly
  // FIC: Eliminar /v2 final si está presente para siempre agregarlo explícitamente
  return raw.replace(/\/v2\/?$/, '');
}

// ──────────────────────────────────────────────
// FIC: Adapter implementation
// ──────────────────────────────────────────────

export class AlpacaAdapter extends BaseBrokerAdapter {
  brokerId: 'ALPACA' = 'ALPACA';
  private apiKey: string;
  private apiSecret: string;
  private paperTradingMode: boolean;
  private requestTimeout: number = 5000; // 5s
  private maxRetries: number = 2;

  constructor(apiKey: string, apiSecret: string, paperTrading: boolean = true) {
    super();
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.paperTradingMode = paperTrading;
  }

  /**
   * FIC: Enviar orden a Alpaca con reintentos y backoff exponencial.
   * FIC: Submit an order to Alpaca with retries and exponential backoff.
   *
   * POST /v2/orders
   */
  async submitOrder(
    instrument: string,
    orderType: OrderType,
    quantity: number,
    price?: number,
    idempotencyKey?: string
  ): Promise<NormalizedOrderResponse> {
    const idemKey = this.getOrCreateIdempotencyKey(idempotencyKey);

    const request: AlpacaOrderRequest = {
      symbol: instrument,
      qty: quantity,
      side: orderType.toLowerCase() as 'buy' | 'sell',
      type: price ? 'limit' : 'market',
      limit_price: price,
      time_in_force: 'day',
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.submitOrderWithTimeout(
          request,
          this.requestTimeout,
          idemKey
        );
        return this.normalizeOrderResponse(response, orderType);
      } catch (error) {
        const normalized =
          error instanceof Error
            ? error
            : new Error(String(error));

        // FIC: Don't retry non-retryable errors (e.g., 401 AUTH_ERROR)
        // FIC: No reintentar errores no recuperables (ej: 401 AUTH_ERROR)
        const errorMessage = normalized.message;
        if (
          errorMessage.includes('401') ||
          errorMessage.includes('403') ||
          errorMessage.includes('INVALID_SYMBOL') ||
          errorMessage.includes('INSUFFICIENT_FUNDS')
        ) {
          throw this.normalizeError(normalized);
        }

        lastError = normalized;
        const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s
        if (attempt < this.maxRetries) {
          await this.sleep(backoffMs);
        }
      }
    }

    throw this.normalizeError(lastError);
  }

  /**
   * FIC: Consultar estado de orden en Alpaca.
   * FIC: Get order status from Alpaca.
   *
   * GET /v2/orders/{order_id}
   */
  async getOrderStatus(orderId: string): Promise<NormalizedOrderResponse> {
    try {
      const url = `${getAlpacaApiBase()}/v2/orders/${orderId}`;
      const response = await this.authGet(url);

      if (!response.ok) {
        const body = await response.text().catch(() => 'Unknown error');
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText} - ${body}`);
      }

      const data = (await response.json()) as AlpacaOrderResponse;
      return this.normalizeOrderResponse(data, data.side === 'buy' ? 'BUY' : 'SELL');
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * FIC: Cancelar orden en Alpaca.
   * FIC: Cancel an order in Alpaca.
   *
   * DELETE /v2/orders/{order_id}
   */
  async cancelOrder(orderId: string): Promise<NormalizedOrderResponse> {
    try {
      const url = `${getAlpacaApiBase()}/v2/orders/${orderId}`;
      const response = await this.authDelete(url);

      // FIC: Alpaca returns 204 No Content on successful cancellation
      // FIC: Alpaca devuelve 204 No Content en cancelación exitosa
      if (response.status === 204 || response.status === 200) {
        return {
          orderId,
          state: 'CANCELLED' as OrderState,
          instrument: '',
          orderType: 'BUY' as OrderType,
          quantity: 0,
          filledQuantity: 0,
          timestamp: new Date(),
          metadata: {
            broker: 'ALPACA',
            nativeOrderId: orderId,
            nativeState: 'cancelled',
            brokerId: this.paperTradingMode ? 'paper' : 'live',
          },
        };
      }

      const data = (await response.json()) as AlpacaOrderResponse;
      return this.normalizeOrderResponse(data, data.side === 'buy' ? 'BUY' : 'SELL');
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * FIC: Submit a multi-leg options order to Alpaca.
   * Each leg specifies an option contract symbol, side (buy/sell), and ratio quantity.
   * FIC: Enviar una orden de opciones multi-pata a Alpaca.
   * Cada pata especifica un símbolo de contrato de opción, lado (compra/venta) y cantidad de ratio.
   *
   * POST /v2/orders (with legs array for multi-leg options)
   */
  async submitOptionsStrategy(
    legs: Array<{
      symbol: string;
      side: 'buy' | 'sell';
      ratioQty: number;
    }>,
    type: 'market' | 'limit' = 'market',
    price?: number,
    idempotencyKey?: string
  ): Promise<NormalizedOrderResponse> {
    const idemKey = this.getOrCreateIdempotencyKey(idempotencyKey);

    const request: Record<string, unknown> = {
      type,
      time_in_force: 'day',
      legs: legs.map((leg) => ({
        symbol: leg.symbol,
        side: leg.side,
        ratio_qty: leg.ratioQty,
      })),
    };

    if (type === 'limit' && price !== undefined) {
      request.limit_price = Math.round(price * 100) / 100;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.submitOrderWithTimeout(
          request as Record<string, unknown>,
          this.requestTimeout,
          idemKey
        );
        return this.normalizeOrderResponse(response, legs[0]?.side === 'buy' ? 'BUY' : 'SELL');
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        const errorMessage = normalized.message;

        if (
          errorMessage.includes('401') ||
          errorMessage.includes('403') ||
          errorMessage.includes('INVALID_SYMBOL') ||
          errorMessage.includes('INSUFFICIENT_FUNDS')
        ) {
          throw this.normalizeError(normalized);
        }

        lastError = normalized;
        const backoffMs = Math.pow(2, attempt) * 1000;
        if (attempt < this.maxRetries) {
          await this.sleep(backoffMs);
        }
      }
    }

    throw this.normalizeError(lastError);
  }

  /**
   * FIC: Listar órdenes activas desde Alpaca.
   * FIC: List active orders from Alpaca.
   *
   * GET /v2/orders
   */
  async listOrders(): Promise<NormalizedOrderResponse[]> {
    try {
      const url = `${getAlpacaApiBase()}/v2/orders?status=open`;
      const response = await this.authGet(url);

      if (!response.ok) {
        const body = await response.text().catch(() => 'Unknown error');
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText} - ${body}`);
      }

      const data = (await response.json()) as AlpacaOrderResponse[];
      return data.map((order) =>
        this.normalizeOrderResponse(order, order.side === 'buy' ? 'BUY' : 'SELL')
      );
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * FIC: Verificar disponibilidad de fondos en Alpaca.
   * FIC: Verify fund availability in Alpaca.
   */
  async verifyFunds(orderType: OrderType, quantity: number, price: number): Promise<boolean> {
    const balance = await this.getAccountBalance();

    if (price === undefined || price === null || price <= 0) {
      return orderType === 'BUY' ? balance.buyingPower > 0 : true;
    }

    const requiredFunds = quantity * price;

    if (orderType === 'BUY') {
      return balance.buyingPower >= requiredFunds;
    } else {
      return true;
    }
  }

  /**
   * FIC: Obtener saldo de cuenta Alpaca.
   * FIC: Get Alpaca account balance.
   *
   * GET /v2/account
   */
  async getAccountBalance(): Promise<{
    cash: number;
    equity: number;
    buyingPower: number;
  }> {
    try {
      const url = `${getAlpacaApiBase()}/v2/account`;
      const response = await this.authGet(url);

      if (!response.ok) {
        const body = await response.text().catch(() => 'Unknown error');
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText} - ${body}`);
      }

      const data = (await response.json()) as AlpacaAccountResponse;
      return {
        cash: parseFloat(String(data.cash)),
        equity: parseFloat(String(data.equity)),
        buyingPower: parseFloat(String(data.buying_power)),
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * FIC: Normalizar error Alpaca a tipo estandar.
   * FIC: Normalize Alpaca error to standard type.
   */
  normalizeError(nativeError: unknown): NormalizedBrokerError {
    const errorMessage =
      nativeError instanceof Error ? nativeError.message : String(nativeError);

    let errorCode = 'UNKNOWN_ERROR';
    let isRetryable = false;

    if (
      errorMessage.includes('symbol not found') ||
      errorMessage.includes('INVALID_SYMBOL')
    ) {
      errorCode = 'INVALID_SYMBOL';
    } else if (
      errorMessage.includes('insufficient buying power') ||
      errorMessage.includes('INSUFFICIENT_FUNDS')
    ) {
      errorCode = 'INSUFFICIENT_FUNDS';
    } else if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('TIMEOUT') ||
      errorMessage.includes('The operation was aborted')
    ) {
      errorCode = 'TIMEOUT';
      isRetryable = true;
    } else if (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('RATE_LIMIT') ||
      errorMessage.includes('429')
    ) {
      errorCode = 'RATE_LIMIT';
      isRetryable = true;
    } else if (
      errorMessage.includes('connection') ||
      errorMessage.includes('NETWORK_ERROR') ||
      errorMessage.includes('fetch')
    ) {
      errorCode = 'NETWORK_ERROR';
      isRetryable = true;
    } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
      errorCode = 'AUTH_ERROR';
      isRetryable = false;
    }

    return {
      errorCode,
      errorMessage,
      isRetryable: this.isRetryableError(errorCode) || isRetryable,
      timestamp: new Date(),
    };
  }

  // ============ Privados ============

  /**
   * FIC: Ejecutar request HTTP POST a Alpaca con timeout y AbortController.
   * FIC: Execute HTTP POST request to Alpaca with timeout and AbortController.
   * Accepts both simple stock orders (AlpacaOrderRequest) and multi-leg options orders.
   * FIC: Acepta tanto órdenes simples de acciones (AlpacaOrderRequest) como órdenes multi-pata de opciones.
   */
  private async submitOrderWithTimeout(
    request: AlpacaOrderRequest | Record<string, unknown>,
    timeout: number,
    idempotencyKey: string
  ): Promise<AlpacaOrderResponse> {
    const url = `${getAlpacaApiBase()}/v2/orders`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.apiSecret,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Alpaca API error: ${response.status} ${response.statusText} - ${body}`
        );
      }

      return (await response.json()) as AlpacaOrderResponse;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * FIC: Helper para hacer GET autenticado a la API de Alpaca.
   * FIC: Helper to make authenticated GET request to Alpaca API.
   */
  private async authGet(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.apiSecret,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Alpaca API error: ${response.status} ${response.statusText} - ${body}`
        );
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * FIC: Helper para hacer DELETE autenticado a la API de Alpaca.
   * FIC: Helper to make authenticated DELETE request to Alpaca API.
   */
  private async authDelete(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.apiSecret,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      if (response.status === 204) {
        return response;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Alpaca API error: ${response.status} ${response.statusText} - ${body}`
        );
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * FIC: Normalizar respuesta Alpaca a NormalizedOrderResponse.
   * FIC: Normalize Alpaca response to NormalizedOrderResponse.
   */
  private normalizeOrderResponse(
    response: AlpacaOrderResponse,
    orderType: OrderType
  ): NormalizedOrderResponse {
    const state = ALPACA_STATE_MAP[response.status] || 'ERROR';
    const qty = parseFloat(String(response.qty));
    const filledQty = parseFloat(String(response.filled_qty));
    const avgPrice =
      response.filled_avg_price != null
        ? parseFloat(String(response.filled_avg_price))
        : undefined;

    return {
      orderId: response.id,
      state,
      instrument: response.symbol,
      orderType,
      quantity: qty,
      filledQuantity: filledQty,
      executionPrice: avgPrice,
      timestamp: new Date(response.updated_at),
      brokerTimestamp: new Date(response.created_at),
      metadata: {
        broker: 'ALPACA',
        nativeOrderId: response.id,
        nativeState: response.status,
        brokerId: this.paperTradingMode ? 'paper' : 'live',
      },
    };
  }

  /**
   * FIC: Helper: Dormir N milisegundos.
   * FIC: Helper: Sleep for N milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
