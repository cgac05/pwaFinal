/**
 * Alpaca Execution Router
 * ========================
 * Endpoints expuestos para que el frontend pueda ejecutar órdenes reales en Alpaca,
 * consultar saldo de cuenta, listar órdenes activas y cancelarlas.
 *
 * Todos usan AlpacaAdapter con llamadas HTTP reales contra Alpaca Markets Paper Trading.
 *
 * Endpoints:
 *   GET    /account              → Saldo de cuenta Alpaca (cash, equity, buyingPower)
 *   POST   /execute-order        → Ejecutar orden en Alpaca (submitOrder)
 *   GET    /orders               → Listar órdenes activas
 *   GET    /orders/:orderId      → Estado de una orden específica
 *   DELETE /orders/:orderId      → Cancelar orden
 */

import { Router } from "express";
import { AlpacaAdapter } from "../../../modules/brokers/alpacaAdapter";

const router = Router();

// ── Shared adapter instance ────────────────────────────────

function getAdapter(): AlpacaAdapter {
  const apiKey = process.env.ALPACA_API_KEY || "";
  const apiSecret = process.env.ALPACA_SECRET_KEY || "";
  const paperTrading = process.env.ALPACA_BASE_URL?.includes("paper") ?? true;
  return new AlpacaAdapter(apiKey, apiSecret, paperTrading);
}

// ── Types ──────────────────────────────────────────────────

interface ExecuteOrderBody {
  instrument: string;
  orderType: "BUY" | "SELL";
  quantity: number;
  price?: number;
  idempotencyKey?: string;
}

interface OptionsLeg {
  symbol: string;
  side: "buy" | "sell";
  ratioQty: number;
}

interface ExecuteOptionsStrategyBody {
  legs: OptionsLeg[];
  type?: "market" | "limit";
  price?: number;
  idempotencyKey?: string;
}

interface ApiError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

// ── GET /account ───────────────────────────────────────────

router.get("/account", async (_req, res) => {
  try {
    const adapter = getAdapter();
    const balance = await adapter.getAccountBalance();

    res.status(200).json({
      success: true,
      cash: balance.cash,
      equity: balance.equity,
      buyingPower: balance.buyingPower,
      broker: "ALPACA",
      mode: adapter["paperTradingMode"] ? "paper" : "live",
    });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : (error as Record<string, unknown>).errorMessage ?? "Unknown error");
    console.error("[alpacaExecutionRouter] GET /account error:", error);
    res.status(502).json({
      error: "Error al obtener saldo de Alpaca",
      code: "ALPACA_ACCOUNT_ERROR",
      details: { message },
    } as ApiError);
  }
});

// ── POST /execute-order ────────────────────────────────────

router.post("/execute-order", async (req, res) => {
  try {
    const body = req.body as ExecuteOrderBody;

    // ── Validation ──
    if (!body.instrument) {
      res.status(400).json({ error: "instrument es requerido", code: "VALIDATION_ERROR" });
      return;
    }
    if (!body.orderType || !["BUY", "SELL"].includes(body.orderType)) {
      res.status(400).json({ error: "orderType debe ser BUY o SELL", code: "VALIDATION_ERROR" });
      return;
    }
    if (!body.quantity || body.quantity <= 0) {
      res.status(400).json({ error: "quantity debe ser mayor a 0", code: "VALIDATION_ERROR" });
      return;
    }

    const adapter = getAdapter();
    const result = await adapter.submitOrder(
      body.instrument,
      body.orderType,
      body.quantity,
      body.price,
      body.idempotencyKey
    );

    res.status(200).json({
      success: true,
      orderId: result.orderId,
      state: result.state,
      instrument: result.instrument,
      orderType: result.orderType,
      quantity: result.quantity,
      filledQuantity: result.filledQuantity,
      price: result.price,
      executionPrice: result.executionPrice,
      timestamp: result.timestamp,
      metadata: result.metadata,
    });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : (error as Record<string, unknown>).errorMessage ?? "Unknown error");
    console.error("[alpacaExecutionRouter] POST /execute-order error:", error);
    const isAuth =
      message.includes("401") || message.includes("403") || message.includes("AUTH_ERROR");
    res.status(isAuth ? 502 : 500).json({
      error: isAuth
        ? "Error de autenticacion con Alpaca. Verifica las API keys."
        : "Error al ejecutar orden en Alpaca",
      code: isAuth ? "ALPACA_AUTH_ERROR" : "ALPACA_ORDER_ERROR",
      details: { message },
    } as ApiError);
  }
});

// ── GET /orders ────────────────────────────────────────────

router.get("/orders", async (_req, res) => {
  try {
    const adapter = getAdapter();
    const orders = await adapter.listOrders();

    res.status(200).json({
      success: true,
      orders: orders.map((o) => ({
        orderId: o.orderId,
        state: o.state,
        instrument: o.instrument,
        orderType: o.orderType,
        quantity: o.quantity,
        filledQuantity: o.filledQuantity,
        price: o.price,
        executionPrice: o.executionPrice,
        timestamp: o.timestamp,
        metadata: o.metadata,
      })),
      total: orders.length,
    });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : (error as Record<string, unknown>).errorMessage ?? "Unknown error");
    console.error("[alpacaExecutionRouter] GET /orders error:", error);
    res.status(502).json({
      error: "Error al listar órdenes de Alpaca",
      code: "ALPACA_ORDERS_ERROR",
      details: { message },
    } as ApiError);
  }
});

// ── GET /orders/:orderId ───────────────────────────────────

router.get("/orders/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const adapter = getAdapter();
    const order = await adapter.getOrderStatus(orderId);

    res.status(200).json({
      success: true,
      order: {
        orderId: order.orderId,
        state: order.state,
        instrument: order.instrument,
        orderType: order.orderType,
        quantity: order.quantity,
        filledQuantity: order.filledQuantity,
        price: order.price,
        executionPrice: order.executionPrice,
        timestamp: order.timestamp,
        metadata: order.metadata,
      },
    });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : (error as Record<string, unknown>).errorMessage ?? "Unknown error");
    console.error("[alpacaExecutionRouter] GET /orders/:orderId error:", error);
    res.status(404).json({
      error: "Orden no encontrada o error al consultar",
      code: "ALPACA_ORDER_NOT_FOUND",
      details: { message },
    } as ApiError);
  }
});

// ── POST /execute-options-strategy ──────────────────────────

router.post("/execute-options-strategy", async (req, res) => {
  try {
    const body = req.body as ExecuteOptionsStrategyBody;

    // ── Validation ──
    if (!body.legs || body.legs.length === 0) {
      res.status(400).json({ error: "Se requieren al menos 1 leg (pata) de opciones", code: "VALIDATION_ERROR" });
      return;
    }

    for (let i = 0; i < body.legs.length; i++) {
      const leg = body.legs[i];
      if (!leg.symbol) {
        res.status(400).json({ error: `Leg ${i + 1}: symbol es requerido`, code: "VALIDATION_ERROR" });
        return;
      }
      if (!["buy", "sell"].includes(leg.side)) {
        res.status(400).json({ error: `Leg ${i + 1}: side debe ser buy o sell`, code: "VALIDATION_ERROR" });
        return;
      }
      if (!leg.ratioQty || leg.ratioQty <= 0) {
        res.status(400).json({ error: `Leg ${i + 1}: ratioQty debe ser > 0`, code: "VALIDATION_ERROR" });
        return;
      }
    }

    const adapter = getAdapter();
    const result = await adapter.submitOptionsStrategy(
      body.legs.map((l) => ({ symbol: l.symbol, side: l.side, ratioQty: l.ratioQty })),
      body.type ?? "market",
      body.price,
      body.idempotencyKey
    );

    res.status(200).json({
      success: true,
      orderId: result.orderId,
      state: result.state,
      instrument: result.instrument,
      orderType: result.orderType,
      quantity: result.quantity,
      filledQuantity: result.filledQuantity,
      executionPrice: result.executionPrice,
      timestamp: result.timestamp,
      metadata: result.metadata,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String((error as Record<string, unknown>).errorMessage ?? "Unknown error");
    console.error("[alpacaExecutionRouter] POST /execute-options-strategy error:", error);
    res.status(500).json({
      error: "Error al ejecutar estrategia de opciones en Alpaca",
      code: "ALPACA_OPTIONS_ERROR",
      details: { message },
    } as ApiError);
  }
});

// ── DELETE /orders/:orderId ────────────────────────────────

router.delete("/orders/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const adapter = getAdapter();
    const result = await adapter.cancelOrder(orderId);

    res.status(200).json({
      success: true,
      orderId: result.orderId,
      state: result.state,
      message: "Orden cancelada exitosamente",
      metadata: result.metadata,
    });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : (error as Record<string, unknown>).errorMessage ?? "Unknown error");
    console.error("[alpacaExecutionRouter] DELETE /orders/:orderId error:", error);
    res.status(500).json({
      error: "Error al cancelar orden en Alpaca",
      code: "ALPACA_CANCEL_ERROR",
      details: { message },
    } as ApiError);
  }
});

export { router as alpacaExecutionRouter };
