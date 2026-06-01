# Contract: Strategy Context & Enrichment
**Team:** TEAM-07 SixPackDevs

---

## Strategy Execution Context

### Market Context
```typescript
interface MarketContext {
  symbol: string;
  currentPrice: number;
  bid: number;
  ask: number;
  volume: number;
  impliedVolatility: number;
  technicalSignals: TechnicalSignal[];
  sentiment: 'bullish' | 'bearish' | 'neutral';
}
```

### Historical Context
```typescript
interface HistoricalContext {
  recentTrades: Trade[];
  performanceMetrics: PerformanceMetric[];
  drawdowns: Drawdown[];
  winRate: number;
  profitFactor: number;
}
```

### Risk Context
```typescript
interface RiskContext {
  accountEquity: number;
  usedMargin: number;
  availableMargin: number;
  maxPositionSize: number;
  maxRiskPerTrade: number;
  currentExposure: number;
}
```

### AI Context (RAG)
- Similar past strategies
- Relevant research papers
- Best practices
- Pattern matches

### Decision Output
```typescript
interface StrategyDecision {
  recommended: boolean;
  confidence: number;
  reasoning: string;
  alternatives: string[];
  risks: string[];
}
```

