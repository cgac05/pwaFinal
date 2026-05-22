// Re-export types with explicit MarketContext from marketData (canonical definition)
// This resolves the ambiguity when both agentConfig and marketData export MarketContext
export { AgentRole, AgentConfig, StrategyContext, StrategyResult, OrderRequest, OrderResponse, AgentMessage, AgentResponse } from './agentConfig';
export { MarketContext, CandleData, TechnicalIndicators, AnalysisResult, TradeData, QuoteData } from './marketData';
