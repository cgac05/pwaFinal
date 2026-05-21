/**
 * Agent Configuration Types
 * Defines the core interfaces for multi-agent orchestration
 */

export type AgentRole = 'analyzer' | 'strategist' | 'executor';

/**
 * Agent configuration interface
 * Defines shared properties and behavior for all agent types
 */
export interface AgentConfig {
  id: string;
  name: string;
  role: AgentRole;
  model: string;
  systemPrompt: string;
  temperature?: number;
  maxRetries?: number;
  timeoutMs?: number;
}

/**
 * Market context for agent analysis
 * Contains OHLCV and technical indicators
 */
export interface MarketContext {
  symbol: string;
  timestamp: number;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  close: number;
  // Technical indicators
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHistogram?: number;
  bollingerUpper?: number;
  bollingerLower?: number;
  bollingerMiddle?: number;
  iv?: number; // Implied volatility
  hv?: number; // Historical volatility
}

/**
 * Strategy context for decision making
 * Aggregates market, historical, and risk data
 */
export interface StrategyContext {
  market: MarketContext;
  recentTrades?: any[];
  historicalMetrics?: {
    winRate?: number;
    profitFactor?: number;
    avgWin?: number;
    avgLoss?: number;
  };
  riskContext?: {
    maxPositionSize: number;
    maxLoss: number;
    equityAtRisk: number;
  };
}

/**
 * Strategy result from Strategist agent
 * Includes recommendations and risk assessment
 */
export interface StrategyResult {
  strategyType: 'straddle' | 'strangle' | 'none';
  direction: 'long' | 'short' | 'neutral';
  symbol: string;
  entryPrice: number;
  strike?: number;
  expirationDate?: string;
  riskRewardRatio?: number;
  maxLoss?: number;
  maxGain?: number;
  confidence: number; // 0-1
  reasoning: string;
}

/**
 * Order request for executor
 * Contains all information needed to place a trade
 */
export interface OrderRequest {
  symbol: string;
  strategy: StrategyResult;
  quantity: number;
  orderType: 'market' | 'limit';
  price?: number;
  timeInForce?: string;
}

/**
 * Order response from executor
 * Confirms execution or provides error details
 */
export interface OrderResponse {
  orderId: string;
  status: 'pending' | 'filled' | 'failed' | 'cancelled';
  symbol: string;
  executedPrice: number;
  executedQuantity: number;
  timestamp: number;
  error?: string;
}

/**
 * Agent message interface for internal communication
 * Used for agent-to-agent orchestration
 */
export interface AgentMessage {
  sender: AgentRole;
  recipient: AgentRole;
  type: 'request' | 'response' | 'error';
  payload: any;
  timestamp: number;
  correlationId: string;
}

/**
 * Agent response interface
 */
export interface AgentResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
}
