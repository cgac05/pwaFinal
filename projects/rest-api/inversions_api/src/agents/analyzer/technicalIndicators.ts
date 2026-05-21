/**
 * Technical Indicators Calculator
 * T152: Analyzer Agent - Technical Analysis Calculations
 * 
 * Calculates RSI, MACD, Bollinger Bands, and IV/HV ratio
 * with high precision and performance optimized for <100ms
 */

import { CandleData, TechnicalIndicators } from '../types/marketData';
import { logger } from '../utils/logger';

export class TechnicalIndicatorsCalculator {
  /**
   * Calculate all technical indicators
   * @param candles OHLCV candles (1h timeframe)
   * @param ivHvRatio Implied Volatility / Historical Volatility ratio
   * @returns Calculated indicators
   */
  calculateIndicators(
    candles: CandleData[],
    impliedVol: number,
    historicalVol: number
  ): TechnicalIndicators {
    const startTime = Date.now();

    const rsi14 = this.calculateRSI(candles, 14);
    const macd = this.calculateMACD(candles);
    const bollingerBands = this.calculateBollingerBands(candles, 20, 2);
    const ivHvRatio = impliedVol / (historicalVol || 0.18);

    const latency = Date.now() - startTime;
    logger.debug(
      `Technical indicators calculated in ${latency}ms (${candles.length} candles)`
    );

    return {
      rsi14,
      macd,
      bollingerBands,
      ivHvRatio,
    };
  }

  /**
   * Calculate Relative Strength Index (RSI)
   * Formula: RSI = 100 - (100 / (1 + RS))
   * where RS = Average Gain / Average Loss over N periods
   * 
   * @param candles OHLCV candles
   * @param period RSI period (typically 14)
   * @returns RSI value (0-100)
   */
  private calculateRSI(candles: CandleData[], period: number): number {
    if (candles.length < period + 1) {
      logger.warn(`Not enough data for RSI calculation: ${candles.length} candles`);
      return 50; // Neutral if insufficient data
    }

    // Calculate price changes
    const changes: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      changes.push(candles[i].close - candles[i - 1].close);
    }

    // Calculate average gains and losses
    let sumGains = 0;
    let sumLosses = 0;

    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) {
        sumGains += changes[i];
      } else {
        sumLosses += Math.abs(changes[i]);
      }
    }

    let avgGain = sumGains / period;
    let avgLoss = sumLosses / period;

    // Smooth using Wilder's smoothing (EMA-like)
    for (let i = period; i < changes.length; i++) {
      avgGain = (avgGain * (period - 1) + (changes[i] > 0 ? changes[i] : 0)) / period;
      avgLoss =
        (avgLoss * (period - 1) + (changes[i] < 0 ? Math.abs(changes[i]) : 0)) /
        period;
    }

    // Calculate RS and RSI
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    return parseFloat(rsi.toFixed(2));
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   * - MACD Line = EMA(12) - EMA(26)
   * - Signal Line = EMA(9) of MACD Line
   * - Histogram = MACD Line - Signal Line
   * 
   * @param candles OHLCV candles
   * @returns MACD components {macd, signal, histogram}
   */
  private calculateMACD(
    candles: CandleData[]
  ): { macd: number; signal: number; histogram: number } {
    if (candles.length < 26) {
      logger.warn(`Not enough data for MACD calculation: ${candles.length} candles`);
      return { macd: 0, signal: 0, histogram: 0 };
    }

    // Calculate EMAs
    const closes = candles.map((c) => c.close);
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);

    // Calculate MACD line
    const macdLine = ema12 - ema26;

    // Get last 9 MACD values for signal line calculation
    const macdValues: number[] = [];
    let tempEma12 = this.calculateEMA(closes.slice(0, 12), 12);
    let tempEma26 = this.calculateEMA(closes.slice(0, 26), 26);

    for (let i = 26; i < closes.length; i++) {
      tempEma12 = (closes[i] * 2) / (12 + 1) + tempEma12 * (1 - 2 / (12 + 1));
      tempEma26 = (closes[i] * 2) / (26 + 1) + tempEma26 * (1 - 2 / (26 + 1));
      macdValues.push(tempEma12 - tempEma26);
    }

    // Calculate signal line (EMA of MACD)
    const signalLine = this.calculateEMA(macdValues, 9);
    const histogram = macdLine - signalLine;

    return {
      macd: parseFloat(macdLine.toFixed(4)),
      signal: parseFloat(signalLine.toFixed(4)),
      histogram: parseFloat(histogram.toFixed(4)),
    };
  }

  /**
   * Calculate Bollinger Bands
   * - Middle Band = SMA(20)
   * - Upper Band = Middle + (2 * StdDev)
   * - Lower Band = Middle - (2 * StdDev)
   * 
   * @param candles OHLCV candles
   * @param period SMA period (typically 20)
   * @param stdDevMultiplier Standard deviation multiplier (typically 2)
   * @returns Bollinger Bands {upper, middle, lower}
   */
  private calculateBollingerBands(
    candles: CandleData[],
    period: number,
    stdDevMultiplier: number
  ): { upper: number; middle: number; lower: number } {
    if (candles.length < period) {
      logger.warn(
        `Not enough data for Bollinger Bands: ${candles.length} candles`
      );
      const lastPrice = candles[candles.length - 1].close;
      return { upper: lastPrice, middle: lastPrice, lower: lastPrice };
    }

    // Calculate SMA
    const recentCandles = candles.slice(-period);
    const sum = recentCandles.reduce((acc, c) => acc + c.close, 0);
    const sma = sum / period;

    // Calculate standard deviation
    const variance =
      recentCandles.reduce((acc, c) => acc + Math.pow(c.close - sma, 2), 0) /
      period;
    const stdDev = Math.sqrt(variance);

    const middle = sma;
    const upper = middle + stdDevMultiplier * stdDev;
    const lower = middle - stdDevMultiplier * stdDev;

    return {
      upper: parseFloat(upper.toFixed(2)),
      middle: parseFloat(middle.toFixed(2)),
      lower: parseFloat(lower.toFixed(2)),
    };
  }

  /**
   * Calculate Exponential Moving Average (EMA)
   * Formula: EMA = Price * K + EMA(prev) * (1 - K)
   * where K = 2 / (N + 1)
   * 
   * @param prices Price data
   * @param period EMA period
   * @returns EMA value
   */
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) {
      // Not enough data, return simple average
      return prices.reduce((a, b) => a + b, 0) / prices.length;
    }

    const k = 2 / (period + 1);
    let ema = 0;

    // Start with SMA
    for (let i = 0; i < period; i++) {
      ema += prices[i];
    }
    ema /= period;

    // Apply EMA formula
    for (let i = period; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }

    return ema;
  }

  /**
   * Analyze indicator signals for trading implications
   * @param indicators Calculated technical indicators
   * @returns Interpretation of signals
   */
  analyzeIndicators(indicators: TechnicalIndicators): {
    rsiSignal: string;
    macdSignal: string;
    bollingerSignal: string;
    ivHvSignal: string;
  } {
    // RSI Signal (0-30 oversold, 70-100 overbought)
    let rsiSignal = 'neutral';
    if (indicators.rsi14 < 30) rsiSignal = 'oversold';
    if (indicators.rsi14 > 70) rsiSignal = 'overbought';

    // MACD Signal (look at histogram sign and crossovers)
    let macdSignal = 'neutral';
    if (indicators.macd.histogram > 0) macdSignal = 'bullish_crossover';
    if (indicators.macd.histogram < 0) macdSignal = 'bearish_crossover';

    // Bollinger Bands Signal (price position relative to bands)
    let bollingerSignal = 'middle';
    if (indicators.bollingerBands.upper > 0) {
      // Assume last price is needed - would be in context
      bollingerSignal = 'middle'; // Neutral for now
    }

    // IV/HV Signal (IV vs historical volatility)
    let ivHvSignal = 'neutral';
    if (indicators.ivHvRatio < 0.8) ivHvSignal = 'low_iv';
    if (indicators.ivHvRatio > 1.2) ivHvSignal = 'high_iv';

    return { rsiSignal, macdSignal, bollingerSignal, ivHvSignal };
  }
}

export default new TechnicalIndicatorsCalculator();
