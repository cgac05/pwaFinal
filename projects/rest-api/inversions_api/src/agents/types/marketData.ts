/**
 * Market Data Types and Structures
 * T152: Analyzer Agent - Market Data Models
 */

/**
 * OHLCV Candle Data
 * Represents a single price candle
 */
export interface CandleData {
  timestamp: number; // Unix timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timeframe?: '1m' | '5m' | '15m' | '1h' | '1d'; // Optional timeframe identifier
}

/**
 * Technical Indicators Calculation Result
 */
export interface TechnicalIndicators {
  rsi14: number; // Relative Strength Index (14 periods)
  macd: {
    macd: number; // MACD line
    signal: number; // Signal line (9-period EMA of MACD)
    histogram: number; // MACD - Signal
  };
  bollingerBands: {
    upper: number; // Upper band (SMA + 2*StdDev)
    middle: number; // Middle band (SMA)
    lower: number; // Lower band (SMA - 2*StdDev)
  };
  ivHvRatio: number; // Implied Volatility / Historical Volatility ratio
}

/**
 * Market Context - Complete market data for analysis
 * Includes OHLCV data, indicators, volatility metrics
 */
export interface MarketContext {
  symbol: string;
  timestamp: number; // Unix timestamp in milliseconds
  currentPrice: number;
  bid: number;
  ask: number;
  bidAskSpread: number; // (ask - bid) / mid_price in basis points

  // OHLCV historical data
  ohlcv1h: CandleData[]; // Last 100 candles (1-hour timeframe)
  ohlcv1d: CandleData[]; // Last 252 candles (daily timeframe)

  // Technical indicators
  indicators: TechnicalIndicators;

  // Volatility metrics
  impliedVolatility: number; // IV from option chain analysis
  historicalVolatility20d: number; // 20-day historical volatility
  volume24h: number; // 24-hour trading volume

  // Risk parameters
  riskParameters: {
    maxPositionSize: number; // Maximum position size in dollars
    maxDrawdown: number; // Maximum allowed drawdown %
    maxLossPerId: number; // Maximum loss per individual trade
  };
}

/**
 * Analysis Result from Analyzer Agent
 * Output of market analysis with technical signals
 */
export interface AnalysisResult {
  symbol: string;
  timestamp: number;
  
  // Technical analysis signals
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0-1, strength of the trend
  volatilityState: 'low' | 'normal' | 'high' | 'extreme';
  
  // Signal components
  technicalSignals: {
    rsiSignal: 'oversold' | 'overbought' | 'neutral';
    macdSignal: 'bullish_crossover' | 'bearish_crossover' | 'neutral';
    bollingerSignal: 'upper_band' | 'lower_band' | 'middle' | 'neutral';
    ivHvSignal: 'low_iv' | 'high_iv' | 'neutral';
  };

  // Analysis metrics
  confidence: number; // 0-1, confidence level of analysis
  volatilityExpectation: number; // Expected volatility change %
  supportLevel: number;
  resistanceLevel: number;

  // Reasoning from Claude
  reasoning: string;
  suggestedAction: string;
}

/**
 * Trade History Entry - For recent trades analysis
 */
export interface TradeData {
  timestamp: number;
  price: number;
  quantity: number;
  side: 'buy' | 'sell';
  aggressor: 'buyer' | 'seller';
}

/**
 * Quote Data - Current price information
 */
export interface QuoteData {
  symbol: string;
  timestamp: number;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  impliedVolatility: number;
}
