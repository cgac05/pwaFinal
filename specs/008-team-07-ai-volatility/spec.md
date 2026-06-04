# TEAM-07 SixPackDevs - AI Volatility Analysis & Options Strategies
**Equipo:** TEAM-07 (SixPackDevs)  
**Líder:** Guillermo Ávila Camberos  
**Rol:** Lead Data  
**Fecha:** May 19, 2026  
**Estado:** In Progress  

---

## 📋 Resumen Ejecutivo

TEAM-07 (SixPackDevs) es responsable del **análisis de volatilidad con IA** y la implementación de **estrategias de opciones Long/Short** (Straddle, Strangle). Este equipo proporciona capacidades de análisis técnico avanzado integradas con inteligencia artificial para la toma de decisiones de inversión mediante un **sistema de orquestación secuencial con coordinador central** que garantiza auditabilidad y gestión de riesgos.

**Decisiones de Arquitectura Confirmadas:**
- 🤖 **Orquestación AI:** Secuencial con Coordinador Central (patrón A)
- 📊 **Estrategias:** Straddle y Strangle con parametrización dinámica
- 📈 **Indicadores:** RSI(14), MACD(12,26,9), Bollinger Bands(20,2), IV/HV ratio
- 🏦 **Brokers:** IBKR (producción) + Alpaca (fallback)
- 💾 **Persistencia:** Supabase (operaciones) + MongoDB (históricos)

---

## 🎯 Funcionalidades Principales

### 1. Core AI Multi-Agente con Orquestación Secuencial

#### User Stories
- **Como Analista de Volatilidad**, quiero que el sistema ejecute múltiples agentes IA (Analyzer → Strategist → Executor) en secuencia para obtener análisis auditables y decisiones de inversión consistentes
- **Como Auditor de Riesgos**, quiero poder rastrear cada decisión de agente y su razonamiento para cumplir con regulaciones y auditoría interna
- **Como Trader Automático**, quiero que el sistema enriquezca el contexto con datos históricos, parámetros de riesgo y reglas de estrategia antes del análisis

#### Acceptance Criteria
```gherkin
Given: Sistema con agentes Analyzer, Strategist, Executor configurados
When: Se solicita análisis de volatilidad para un símbolo
Then: El Analyzer genera señales técnicas
  And: El Strategist evalúa estrategias viables
  And: El Executor prepara órdenes con validaciones
  And: Todo el proceso queda registrado en audit log

Given: Falla del agente Strategist durante análisis
When: Sistema intenta recuperarse
Then: Circuit breaker detiene ejecución
  And: Se notifica a operador
  And: No se ejecutan órdenes sin intervención manual
```

#### Requisitos No-Funcionales
- **Latencia de análisis:** <500ms por agente (P95)
- **Disponibilidad:** 99.9% uptime durante horario de mercado
- **Escalabilidad:** Mínimo 1000 órdenes/día sin degradación
- **Auditoría:** 100% de decisiones registradas con timestamps
- **Tolerancia a fallos:** Fallback automático a Alpaca si IBKR no disponible

#### Mock de Interfaz - Pantalla Principal
```
╔═══════════════════════════════════════════════════════════════╗
║  AI VOLATILITY ANALYZER - TEAM-07 SixPackDevs                ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  Symbol: AAPL          Status: ✓ ACTIVE                      ║
║  Current Price: $195.32                                      ║
║                                                               ║
║  ┌─ TECHNICAL INDICATORS ────────────────────────────────┐   ║
║  │ RSI(14): 62.5        MACD: +2.3 (bullish)             │   ║
║  │ BB(20,2): Price @ Upper Band (high volatility)        │   ║
║  │ IV/HV Ratio: 1.15 (slightly elevated)                 │   ║
║  └───────────────────────────────────────────────────────┘   ║
║                                                               ║
║  ┌─ AI AGENTS ANALYSIS ──────────────────────────────────┐   ║
║  │ [Analyzer]    ✓ Complete (342ms)                      │   ║
║  │   Signal: BULLISH MOMENTUM                             │   ║
║  │ [Strategist]  ✓ Complete (287ms)                      │   ║
║  │   Recommended: Long Strangle (ATM Call + OTM Put)     │   ║
║  │ [Executor]    ⏳ Processing (est. 156ms)              │   ║
║  │   Orders Ready: 2 (pending validation)                │   ║
║  └───────────────────────────────────────────────────────┘   ║
║                                                               ║
║  ┌─ STRATEGY DETAILS ────────────────────────────────────┐   ║
║  │ Type: Long Strangle                                   │   ║
║  │ Call Strike: $200 (0.5% OTM) | Expiry: 2026-06-19   │   ║
║  │ Put Strike: $190 (2.7% OTM)  | Expiry: 2026-06-19   │   ║
║  │ Entry: $2.45 debit | Max Profit: Unlimited           │   ║
║  │ Max Loss: $245 (limited by position size)             │   ║
║  │ Breakeven: $197.45 (up) / $187.55 (down)             │   ║
║  └───────────────────────────────────────────────────────┘   ║
║                                                               ║
║  [ANALYZE] [SIMULATE] [EXECUTE] [HISTORY] [SETTINGS]        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

---

### 2. Estrategias de Volatility con Parametrización Dinámica

#### User Stories
- **Como Gestor de Portafolio**, quiero seleccionar entre estrategias Straddle y Strangle especificando símbolo, strike target, fecha de expiración e IV target
- **Como Operador de Riesgos**, quiero que el sistema calcule automáticamente márgenes requeridos, máximo beneficio y pérdida máxima
- **Como Auditor Interno**, quiero ver el análisis de payoff completo y cálculos de probabilidad de ganancia (POP)

#### Acceptance Criteria
```gherkin
Given: Usuario selecciona estrategia Straddle Long con AAPL
  And: Strike = 195 | Expiry = 2026-06-19 | IV Target = 1.15
When: Sistema calcula parámetros de estrategia
Then: Se muestran:
  - Precio teórico de entrada (Call + Put premium)
  - Máximo beneficio (ilimitado en alza, strike-premium en baja)
  - Máxima pérdida (suma de premios pagados)
  - Breakeven points (strike ± total premium)
  - Probabilidad de ganancia (POP) basada en IV target

Given: IV actual es 1.12 (menor que target 1.15)
When: Sistema valida condiciones de ejecución
Then: Se genera advertencia de "IV por debajo de target"
  And: Se sugiere esperar o ajustar strike
```

#### Requisitos No-Funcionales
- **Precisión de cálculos:** Máximo 0.001% de error en valuación (vs. modelo Black-Scholes)
- **Actualización de precios:** Cada 250ms durante horario de mercado
- **Soporte de símbolos:** Mínimo 500 opciones activas simultáneamente
- **Historial de estrategias:** Retención 5 años de análisis y ejecuciones

#### Parametrización de Estrategias
```typescript
interface StrategyRequest {
  strategyType: 'straddle' | 'strangle';
  direction: 'long' | 'short';
  symbol: string;
  strikeCall?: number;
  strikePut?: number;
  expiryDate: ISO8601Date;
  ivTarget: number;
  maxPositionSize: number;  // en dólares
  maxLossLimit: number;     // stop-loss automático
}
```

---

### 3. Motor de Análisis Técnico Multi-Indicador

#### User Stories
- **Como Trader Cuantitativo**, quiero analizar múltiples indicadores técnicos (RSI, MACD, Bollinger Bands, IV/HV ratio) para validar señales de entrada
- **Como Desarrollador de Estrategias**, quiero acceder a datos históricos de múltiples timeframes (1m, 5m, 15m, 1h, 1d) sin latencia
- **Como Especialista en Volatilidad**, quiero que el sistema compare IV implícita vs. HV histórica para identificar oportunidades de arbitraje de volatilidad

#### Acceptance Criteria
```gherkin
Given: Datos OHLCV para AAPL en timeframe 1 hora
When: Sistema calcula indicadores técnicos
Then: RSI(14) se calcula usando últimos 14 periodos
  And: MACD(12,26,9) genera líneas correctas con histogram
  And: Bollinger Bands(20,2) usa SMA(20) ± 2*StdDev
  And: IV/HV ratio = IV implícita / HV(20d)

Given: Se solicita análisis multi-timeframe para decisión
When: Sistema integra señales de múltiples periodos
Then: Se generan conflictos resueltos por peso (1h > 15m > 5m > 1m)
  And: Se reporta nivel de confianza de señal combinada
```

#### Requisitos No-Funcionales
- **Cálculo de indicadores:** <100ms para 500 instrumentos
- **Exactitud de RSI:** Comparar vs. TradingView con <0.1% tolerancia
- **Históricos:** Retención 10 años de datos diarios, 2 años de intraday
- **API de Indicadores:** Exponer 50+ indicadores técnicos

#### Indicadores Configurados
| Indicador | Parámetros | Uso Primario |
|-----------|-----------|------------|
| RSI | 14 períodos | Sobreventa/compra extremas |
| MACD | (12,26,9) | Momentum y crossovers |
| Bollinger Bands | (20,2) | Volatilidad y reversión media |
| IV/HV Ratio | IV vs HV(20d) | Identificación de sesgo IV |

---

### 4. Historial Operativo y Auditoría Completa

#### User Stories
- **Como Compliance Officer**, quiero auditar toda operación ejecutada incluyendo razón, agente decisor, y timestamp exacto
- **Como Analista de Performance**, quiero generar reportes de PnL, win rate, Sharpe ratio y máximo drawdown por estrategia
- **Como CTO**, quiero visualizar métricas de latencia, tasa de error y confiabilidad de cada broker

#### Acceptance Criteria
```gherkin
Given: Orden ejecutada exitosamente en IBKR
When: Sistema registra en audit trail
Then: Se capturan:
  - Timestamp exacto (milisegundos)
  - Agente responsable (Analyzer/Strategist/Executor ID)
  - Parámetros de entrada y análisis realizado
  - Precio de ejecución vs. precio teórico
  - Comisiones y slippage
  - PnL realizado/no realizado

Given: Usuario solicita reporte de historial
When: Sistema genera análisis de rendimiento
Then: Se muestran métricas de:
  - Operaciones totales, exitosas y fallidas
  - Win rate por estrategia
  - Rentabilidad media por operación
  - Ratio Sharpe, Sortino, Calmar
  - Maximum Drawdown (absoluto y %)
```

#### Requisitos No-Funcionales
- **Integridad de datos:** 100% de operaciones registradas sin pérdida
- **Velocidad de consulta:** Reportes de 10k+ operaciones en <2s
- **Retención:** Mínimo 7 años por requerimientos regulatorios
- **Complianza:** Cumplir SOX, regulaciones de derivados, auditoría trail

---

## 🔗 Dependencias Técnicas Detalladas

### TEAM-01: Broker Adapter & API REST
**Status:** ⏳ Debe Completar  
**Responsable:** TEAM-01  
**Entregables Requeridos:**
- ✅ Integración IBKR (IBKR API v9.73+)
- ✅ Integración Alpaca (Alpaca REST v2)
- ✅ Endpoints para:
  - `POST /api/orders` - Crear órdenes
  - `GET /api/portfolio` - Estado actual
  - `GET /api/quotes` - Precios reales
  - `POST /api/orders/{id}/cancel` - Cancelar órdenes
- ✅ Manejo automático de fallback IBKR → Alpaca
- ✅ Sincronización de saldos cada 30s

**Interfaces Esperadas:**
```typescript
interface BrokerAPI {
  placeOrder(order: OrderRequest): Promise<OrderResponse>;
  getPortfolio(): Promise<PortfolioData>;
  getQuote(symbol: string): Promise<QuoteData>;
  cancelOrder(orderId: string): Promise<void>;
}
```

### TEAM-02: Dashboard Base & TradingView Charts
**Status:** ⏳ Debe Completar  
**Responsable:** TEAM-02  
**Entregables Requeridos:**
- ✅ Componentes React para gráficos candlestick
- ✅ Widgets de indicadores técnicos
- ✅ Panel de análisis multi-símbolo
- ✅ Feed de órdenes en tiempo real
- ✅ Integración TradingView Lightweight Charts v4.0+
- ✅ Responsive para desktop (1920px min) y tablet (1024px)

**Interfaces Esperadas:**
```typescript
interface ChartComponent {
  addIndicator(indicator: TechnicalIndicator): void;
  updateData(ohlcv: CandleData[]): void;
  setTimeframe(tf: Timeframe): void;
}
```

### TEAM-03: Authentication & RLS Supabase
**Status:** ⏳ Debe Completar  
**Responsable:** TEAM-03  
**Entregables Requeridos:**
- ✅ Auth JWT integrado con Supabase
- ✅ Row Level Security policies en tablas:
  - `ai_agents` - Solo acceso a propias operaciones
  - `strategies_executed` - Auditoría regulatoria
  - `market_analysis` - Restricción por símbolo/equipo
- ✅ Roles: `trader`, `auditor`, `admin`, `system`
- ✅ Logs de acceso a datos sensibles

**Policies RLS Requeridas:**
```sql
-- ai_agents: Solo TEAM-07 ve sus análisis
CREATE POLICY "ai_agents_team_isolation" ON ai_agents
  USING (team_id = auth.jwt_claim('team_id'));

-- strategies_executed: Auditor ve todo, trader solo lo suyo
CREATE POLICY "strategies_audit_access" ON strategies_executed
  USING (
    auth.jwt_claim('role') = 'auditor' OR
    created_by = auth.uid()
  );
```

### TEAM-04: Infrastructure (Kubernetes + Docker)
**Status:** ⏳ Debe Completar  
**Responsable:** TEAM-04  
**Entregables Requeridos:**
- ✅ Dockerfile optimizado para Node.js 22 LTS
- ✅ Manifiestos Kubernetes (deployment, service, configmap, secrets)
- ✅ Horizontal Pod Autoscaler para AI agents
- ✅ Persistencia: PersistentVolumeClaim para MongoDB
- ✅ Network policies para aislamiento TEAM-07
- ✅ Probes: liveness/readiness con thresholds

**Config Deployment:**
```yaml
replicas: 3
resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 2000m
    memory: 4Gi
autoscaling:
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
```

---

## 🏗️ Interfaces de Componentes (TypeScript)

### AgentConfig - Configuración Base de Agentes
```typescript
interface Tool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  handler: (args: any) => Promise<any>;
}

interface AgentConfig {
  id: string;
  name: string;
  role: 'analyzer' | 'strategist' | 'executor';
  model: 'claude-opus' | 'claude-sonnet';
  systemPrompt: string;
  tools: Tool[];
  maxRetries: number;
  timeoutMs: number;
}
```

### MarketContext - Contexto de Entrada
```typescript
interface MarketContext {
  symbol: string;
  currentPrice: number;
  ohlcv1h: CandleData[];      // Últimos 100 candlesticks 1h
  ohlcv1d: CandleData[];      // Últimos 252 candlesticks diarios
  technicalIndicators: {
    rsi14: number;
    macd: { macd: number; signal: number; histogram: number };
    bollingerBands: { upper: number; middle: number; lower: number };
    ivHvRatio: number;
  };
  impliedVolatility: number;
  historicalVolatility20d: number;
  bidAskSpread: number;
  volume24h: number;
  recentTrades: TradeData[];
  riskParameters: {
    maxPositionSize: number;
    maxDrawdown: number;
    maxLossPerId: number;
  };
}
```

### StrategyRequest / StrategyResult
```typescript
interface StrategyRequest {
  strategyType: 'straddle' | 'strangle';
  direction: 'long' | 'short';
  symbol: string;
  expiryDate: string;          // ISO8601
  strikeCall?: number;
  strikePut?: number;
  ivTarget: number;
  maxPositionSize: number;
  maxLossLimit: number;
}

interface StrategyResult {
  strategyId: string;
  recommendation: StrategyRecommendation;
  analysis: {
    payoff: PayoffProfile;
    profitability: {
      maxProfit: number;
      maxLoss: number;
      breakeven: [number, number];
      probabilityOfProfit: number;
    };
    marginRequired: number;
    riskMetrics: RiskMetrics;
  };
  confidence: number;           // 0-100
  reasoning: string;
  timestamp: ISO8601DateTime;
}

interface OrderRequest {
  strategyId: string;
  orders: {
    type: 'call' | 'put';
    strike: number;
    expiry: string;
    quantity: number;
    side: 'buy' | 'sell';
    orderType: 'market' | 'limit';
    limitPrice?: number;
    timeInForce: 'day' | 'gtc';
  }[];
  broker: 'ibkr' | 'alpaca';
  dryRun: boolean;
}
```

### ExecutorResponse - Respuesta de Ejecución
```typescript
interface ExecutorResponse {
  executionId: string;
  status: 'pending' | 'partial_fill' | 'filled' | 'rejected' | 'cancelled';
  orders: {
    orderId: string;
    status: string;
    filledQuantity: number;
    averagePrice: number;
    execution: {
      timestamp: ISO8601DateTime;
      broker: string;
      slippage: number;
      commission: number;
    };
  }[];
  totalCost: number;
  enterPrice: number;
  entryTimestamp: ISO8601DateTime;
}
```

---

## ⚠️ Matriz de Riesgos

| ID | Riesgo | Severidad | Probabilidad | Impacto | Mitigación | Responsable |
|----|--------|-----------|--------------|---------|-----------|------------|
| R1 | Pérdida ilimitada en Short Straddle | 🔴 CRÍTICO | Media | Pérdida del 100%+ de capital | Max position size: $50k/operación; Circuit breaker si drawdown > 10% | Executor Agent |
| R2 | Falla en fallback IBKR→Alpaca | 🔴 CRÍTICO | Baja | Pérdida de 30m trades | Health check cada 30s; pre-validación órdenes en Alpaca | TEAM-01 |
| R3 | Mala valuación de IV implícita | 🟠 ALTO | Media | Entrada en estrategias con odds negativas | Validar IV vs. histórica; crosscheck con volatility models | Analyzer Agent |
| R4 | Latencia >500ms en análisis | 🟠 ALTO | Baja | Pérdida de oportunidades de mercado | Timeout strict; fallback a estrategia pre-calculada | Infraestructura |
| R5 | Corrupción de audit trail | 🔴 CRÍTICO | Muy baja | Incumplimiento regulatorio + multas | Replicación en 2 bases de datos; checksum de cada registro | TEAM-03 |
| R6 | Insider trading involuntario | 🟠 ALTO | Muy baja | Sanciones SEC + pérdida de licencia | Restricción de símbolos; blacklist automática por lookback period | Compliance |
| R7 | Alcance de límite de órdenes por día | 🟡 MEDIO | Media | Bloqueo de sistema (rate limiting) | Ajustar escalabilidad a 1000+ órdenes/día; batching de órdenes | TEAM-04 |
| R8 | Sesgo de datos históricos | 🟡 MEDIO | Media | Overfitting de estrategias | Validación forward-looking; análisis de periodos de crisis | Analyzer Agent |

---

## 🗺️ Roadmap de MVP

### **MVP v1.0 - Straddle Long + Análisis Técnico Básico**
**Timeline:** 4 semanas  
**Objetivo:** Demostración de viabilidad y captura de volatilidad en mercados bullish

**Entregables:**
- ✅ Orquestación secuencial de 3 agentes (Analyzer → Strategist → Executor)
- ✅ Estrategia: Long Straddle solamente (dirección larga)
- ✅ Indicadores: RSI(14), MACD, Bollinger Bands
- ✅ Histórico simple: últimas 50 operaciones en Supabase
- ✅ Dashboard básico: estado de posiciones + últimas órdenes
- ✅ Auditoría: logs de todas las decisiones
- ✅ Broker: IBKR primario solamente

**Criterios de Éxito:**
- Win rate > 45% en backtesting (período 1 año)
- Sharpe ratio > 1.2
- Latencia promedio < 400ms por análisis
- 99.5% uptime en trading hours

**Risks Manejados:**
- Position size cap: $25k por operación
- Drawdown limit: 5%
- Daily loss limit: $5k

---

### **MVP v1.1 - Long Strangle + Risk Management**
**Timeline:** +2 semanas  
**Objetivo:** Expandir estrategias con mejor relación riesgo/beneficio

**Cambios Incrementales:**
- ✅ Nueva estrategia: Long Strangle (strike diferenciados)
- ✅ Parametrización dinámica: seleccionar strike call/put
- ✅ IV/HV ratio: validar condiciones de volatilidad
- ✅ Advanced risk metrics: Sharpe, Sortino, Calmar ratios
- ✅ Dashboard avanzado: análisis de payoff gráfico
- ✅ Históricos: primeros estudios de MongoDB para análisis
- ✅ Fallback: Alpaca como secundario

**Criterios de Éxito:**
- Comparativa Long Strangle vs Long Straddle: Strangle debe reducir entrada 30-40%
- Win rate > 48%
- Sharpe ratio > 1.4
- Latencia: <350ms (mejora de 50-100ms)

**Nuevos Risks:**
- Riesgo de strike selection (OTM vs ATM)
- Complexity en cálculo de breakeven

---

### **MVP v1.2 - Short Straddle/Strangle (Fase Premium)**
**Timeline:** +3 semanas  
**Objetivo:** Generar ingresos premium; requiere supervisión intensiva

**Cambios Incrementales:**
- ✅ Dirección: Short Straddle / Short Strangle
- ✅ Management de márgenes: validar colateral en broker
- ✅ Circuit breakers: stop automático si breaches strike
- ✅ Wheel strategy: rolled automáticos si se asigna
- ✅ Dashboard: comparativa long vs short, análisis de assignment risk
- ✅ Compliance: restricciones por regulaciones (margin account requerida)
- ✅ Advanced analytics: correlación con índices, análisis de conglomerados

**Criterios de Éxito:**
- Short Straddle win rate > 65% (objetivo: vender en zona de baja IV)
- Monthly theta decay capture: 2-3% del capital
- Máxima pérdida en peor caso < 20% del capital
- Zero assignment sorpresas (predicción >95% accuracy)

**Risks Críticos:**
- Pérdida ilimitada potencial: MÁXIMO CONTROL DE POSITION SIZE
- Requirement de supervisor humano para cada trade
- Blacklist de símbolos con gap risk alto

---

## 📐 Criterios de Aceptación de Calidad

### Code Quality
- TypeScript: 100% tipado (strict mode)
- Test coverage: >85% (unit + integration)
- Linting: 0 warnings con ESLint
- Documentación: JSDoc en 100% de funciones públicas

### Performance
- Análisis de volatilidad: <500ms P95
- Ejecución de órdenes: <200ms desde aprobación
- Dashboard updates: <250ms (real-time)
- Query histórico (10k records): <2s

### Reliability
- Uptime: 99.9% durante horarios de mercado
- Mean Time to Recovery (MTTR): <5 minutos
- Error rate: <0.1% de transacciones
- Retry logic: max 3 intentos con backoff exponencial

### Security & Compliance
- Audit trail: 100% de operaciones logged
- Data encryption: TLS 1.3 en tránsito, AES-256 en reposo
- Access control: RLS policies 100% implementadas
- Compliance: SOX, regulaciones CFTC para derivados

---

## 📝 Notas

- Usa guía de creación de feature según PDF DIANA-SDK
- Se ejecuta desde rama: `feature/008-team-07-ai-volatility`
- Debe sincronizarse con `001-inversiones` initiative en DIANA
- **Importante:** Todas las decisiones de arquitectura han sido validadas con stakeholders
- **Próximo paso:** Iniciar con contracts/ definitions para asegurar interfaces consistentes
