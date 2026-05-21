# 🤖 TEAM-07 SixPackDevs - Plan de Implementación
## Sistema IA de Volatilidad con Estrategias Straddle/Strangle

**Versión:** 1.0  
**Fecha:** Mayo 2026  
**Estado:** 📋 En Planificación  
**Última Actualización:** 2026-05-19

---

## 📊 Resumen Ejecutivo

### Objetivo Principal
Implementar un **Sistema Inteligente de Análisis de Volatilidad** que:
- 🎯 Analiza volatilidad de mercados en tiempo real (RSI, MACD, Bollinger Bands, IV/HV)
- 🎯 Selecciona automáticamente estrategias óptimas (Long Straddle / Long Strangle)
- 🎯 Ejecuta órdenes en brokers integrados (IBKR + Alpaca)
- 🎯 Mantiene histórico auditable de todas las operaciones
- 🎯 Proporciona dashboard visual con análisis histórico y rendimiento
- 🎯 Utiliza el **Gemini SDK** para generar salida dual: JSON estructurado y opinión/análisis textual
- 🎯 Incluye un gate explícito de aprobación humana antes de cualquier ejecución real en producción

### Timeline: 9 Semanas (3 Fases MVP)

| Fase | Semanas | Objetivo | Status |
|------|---------|----------|--------|
| **Fase 1: Setup & Arquitectura** | 1 | Environment base + AI agents diseño | ⏳ Planeado |
| **Fase 2: Core AI Agents** | 2-3 | Analyzer, Strategist, Executor funcionales | ⏳ Planeado |
| **Fase 3: Análisis Técnico** | 4-5 | Indicadores + Backtesting engine | ⏳ Planeado |
| **Fase 4: Persistencia & Historial** | 6 | Supabase models + Audit trail | ⏳ Planeado |
| **Fase 5: Frontend & UI** | 7-8 | React components + Charts TradingView | ⏳ Planeado |
| **Fase 6: Testing & Deploy** | 9 | Unit + Integration + E2E tests | ⏳ Planeado |

### Equipo: 5 Desarrolladores

| Rol | Responsabilidad | Dedicación | Deliverables |
|-----|-----------------|-----------|--------------|
| 👨‍💼 **Guillermo Ávila** (Lead) | Arquitectura + Oversight | 100% | Diseño AI, integración TEAM-01 a 04, go/no-go |
| 🔧 **Dev Backend 1** | Core AI + Strategies | 100% | Analyzer, Strategist agents |
| 🔧 **Dev Backend 2** | Análisis + Historial | 100% | Technical indicators, Backtesting, Persistencia |
| 💻 **Dev Frontend 1** | Componentes React | 100% | Strategy panel, Status monitor |
| 💻 **Dev Frontend 2** | Charts + Dashboard | 100% | Volatility charts, Trade history table |

### Budget Estimado
- **Infraestructura:** Supabase Pro ($50/mes) + MongoDB Atlas ($100/mes)
- **APIs Brokers:** IBKR (~$10/mes) + Alpaca ($0 con plan free/plus)
- **Herramientas:** GitHub Copilot (existente), TradingView Lightweight Charts (libre)
- **Cloud:** Docker registry + API hosting (~$200/mes en Azure/AWS)
- **Total Inicial:** $360/mes + setup one-time

---

## 🏗️ Fases de Implementación Detalladas

### ⏱️ FASE 1: Setup & Arquitectura (Semana 1)

**Objetivo:** Ambiente listo, arquitectura AI definida, esquemas iniciales

#### Hitos (Milestones)

| Hito | Descripción | Criterio de Aceptación |
|------|-------------|------------------------|
| **M1.1** ✅ Environment Setup | Node.js 22, Vite, Docker, TSConfig | Todos los devs pueden `npm run dev` sin errores |
| **M1.2** ✅ Arquitectura AI Definida | Patrones de comunicación entre agentes | Documento arquitectura + diagrama PR-ready |
| **M1.3** ✅ Supabase + Schemas | DB structure, RLS policies, initial tables | 8 tablas core creadas, RLS validado |
| **M1.4** ✅ Repositorios Git Setup | Branching strategy, CI/CD pipelines base | Workflows GitHub Actions funcionales |

#### Tareas Semana 1

```
T151: Setup Node.js 22 LTS + Vite en backend/rest-api
      Asignado: Dev Backend 1
      Subtasks:
        - [ ] Actualizar package.json a Node 22
        - [ ] Configurar tsconfig.json (strict mode)
        - [ ] Instalar dependencias core (express, supabase, Gemini SDK)
        - [ ] Crear .env.example con variables necesarias
        - [ ] Verificar build sin warnings
      DoD: `npm run build` exitoso, cero TS errors

T151B: Docker setup + dev containerization
      Asignado: Dev Backend 1
      Subtasks:
        - [ ] Crear Dockerfile multistage (dev/prod)
        - [ ] docker-compose.yml con Supabase + PostgreSQL
        - [ ] Documentar comandos docker dev
        - [ ] Validar hot-reload en dev mode
      DoD: `docker-compose up` funcional en 2 comandos

T153: AI Orchestration Architecture (Analyzer → Strategist → Executor)
      Asignado: Guillermo Ávila (Lead)
      Subtasks:
        - [ ] Diseñar pattern de comunicación entre agentes
        - [ ] Definir mensaje protocol (types/AIMessage.ts)
        - [ ] Error handling strategy (retry logic, fallbacks)
        - [ ] Definir formato de salida de Gemini: JSON estructurado + análisis/opinión textual
        - [ ] Create ADR (Architecture Decision Record)
      DoD: Documento ADR + TypeScript types en repo

T154: Supabase Setup + Core Table Schema
      Asignado: Dev Backend 2
      Subtasks:
        - [ ] Create tables: signals, trades, broker_configs, execution_logs
        - [ ] Definir RLS policies (TEAM-03 validation)
        - [ ] Create indices para queries frecuentes
        - [ ] Setup automatic backups
      DoD: `supabase db push` exitoso, RLS auditado

```

#### Dependencias en Semana 1

- ✅ **TEAM-03 (Auth & RLS):** Proporcionar estructura de RLS policies estándar
  - *Timeline requerido:* Fin semana 1
  - *Impacto:* Si falla → delay de T154

---

### ⏱️ FASE 2: Core AI Agents (Semanas 2-3)

**Objetivo:** Los 3 agentes principales (Analyzer, Strategist, Executor) funcionando end-to-end

#### Hitos (Milestones)

| Hito | Descripción | Criterio de Aceptación |
|------|-------------|------------------------|
| **M2.1** ✅ Analyzer Agent | Analiza OHLCV + calcula indicadores base | Unit tests 100%, procesa 30+ símbolos en <2s |
| **M2.2** ✅ Strategist Agent | Selecciona Straddle/Strangle optimal | Tests con 1000 históricos, accuracy >80% vs trader manual |
| **M2.3** ✅ Executor Agent | Envía órdenes a brokers, maneja respuestas | Mock tests exitosos, ready para T157 |
| **M2.4** ✅ IBKR + Alpaca Adapters | Conexión bidireccional con brokers | Test trades en paper trading, confirmación de fills |

#### Tareas Semanas 2-3

```
T155: Analyzer Agent Implementation
      Asignado: Dev Backend 1
      Horas: 40
      Subtasks:
        - [ ] Create services/analyzer/MarketDataFetcher.ts (Alpha Vantage / broker APIs)
        - [ ] Implementar AnalysisEngine.ts (base indicators)
        - [ ] Create AnalyzerAgent orchestration class
        - [ ] Error handling: retry logic para API timeouts
        - [ ] Unit tests (50+ cases)
        - [ ] Benchmark: <500ms para 30 símbolos
      DoD: Service logs disponibles, 100% unit test coverage

T156: Strategist Agent Implementation
      Asignado: Dev Backend 1
      Horas: 40
      Subtasks:
        - [ ] Create strategies/StradleStrategist.ts
        - [ ] Implementar StraddleOptimizer (strike selection logic)
        - [ ] Implementar StrangleOptimizer (wing selection)
        - [ ] Create decision matrix (risk/reward ratios)
        - [ ] Integration tests vs Analyzer output
        - [ ] Validing contra manual strategies (backtesting)
      DoD: Strategy selection logs en Supabase, accuracy documented

T157: Executor Agent + Order Management
      Asignado: Dev Backend 2
      Horas: 40
      Subtasks:
        - [ ] Create ExecutorAgent orchestration
        - [ ] Order validation (margin check, size limits)
        - [ ] Implement a human approval gate for live execution in production
        - [ ] Create OrderRepository.ts para persistencia
        - [ ] Implement order state machine (pending → submitted → filled → closed)
        - [ ] Error recovery: order cancellation logic
        - [ ] Mock broker responses para testing
      DoD: Order flow documentado, state transitions testado, gate de aprobación humana validado

T158: Broker Adapters (IBKR + Alpaca Integration)
      Asignado: Dev Backend 2
      Horas: 50
      Subtasks:
        - [ ] Create IBKRAdapter.ts (orders, positions, market data)
        - [ ] Create AlpacaAdapter.ts (orders, positions, market data)
        - [ ] Implement health checks (30s interval)
        - [ ] Create BrokerAbstractAdapter interface
        - [ ] Fallback logic: si IBKR falla → Alpaca automático
        - [ ] Paper trading validation (no real money)
        - [ ] Integration tests con ambos brokers
      DoD: 10+ test orders en paper trading exitosos

```

#### Dependencias en Fases 2-3

- ⏳ **TEAM-01 (Broker APIs):** Debe tener API ready semana 2
  - *Timeline requerido:* Semana 2 (crítico)
  - *Impacto:* Si falla → podemos usar mocks, pero delay real testing

---

### ⏱️ FASE 3: Análisis Técnico (Semanas 4-5)

**Objetivo:** Indicadores técnicos + IV/HV ratios + Backtesting engine operacionales

#### Hitos (Milestones)

| Hito | Descripción | Criterio de Aceptación |
|------|-------------|------------------------|
| **M3.1** ✅ Technical Indicators | RSI, MACD, Bollinger Bands | 100% unit tests, resultados vs TradingView <1% error |
| **M3.2** ✅ IV/HV Ratios | Implied vs Historical volatility | Cálculos vs broker IV <2% discrepancia |
| **M3.3** ✅ Signal Engine | Agregador de todas señales | Weighted scoring, documentado |
| **M3.4** ✅ Backtesting Framework | Valida estrategias vs históricos | 5 años de datos, Sharpe ratio calculado |

#### Tareas Semanas 4-5

```
T159: Technical Indicators Library
      Asignado: Dev Backend 2
      Horas: 50
      Subtasks:
        - [ ] Implementar RSI calculator (period: 14, 21, 28)
        - [ ] Implementar MACD (12, 26, 9)
        - [ ] Implementar Bollinger Bands (period: 20, std: 2)
        - [ ] Create IndicatorFactory pattern
        - [ ] Benchmark: cada indicador <100ms para 1000 candles
        - [ ] Unit tests: 100+ casos (edge cases included)
        - [ ] Validación vs TradingView public data
      DoD: Indicadores documentados, tolerance <1%

T160: IV/HV Ratio Calculations
      Asignado: Dev Backend 2
      Horas: 35
      Subtasks:
        - [ ] Implementar HV calculator (historical volatility)
        - [ ] Implementar IV ratio retrieval (broker API)
        - [ ] Create IV/HV ratio aggregator
        - [ ] Caching strategy para IV data (5 min TTL)
        - [ ] Error handling: fallback a valores históricos
        - [ ] Validing contra broker values (±2%)
      DoD: IV/HV ratios en Supabase, cache operativo

T161: Signal Aggregation Engine
      Asignado: Dev Backend 2
      Horas: 40
      Subtasks:
        - [ ] Create SignalAggregator service
        - [ ] Weighted scoring (RSI: 0.25, MACD: 0.35, BB: 0.20, IV/HV: 0.20)
        - [ ] Signal strength calculation (0-100 score)
        - [ ] Create signal persistence (signals table)
        - [ ] Real-time signal updates
        - [ ] Logging para debugging
      DoD: Signals escrito a Supabase, scoring algorithm documented

T162: Backtesting Framework + Historical Validation
      Asignado: Dev Backend 1
      Horas: 60
      Subtasks:
        - [ ] Create BacktestEngine service
        - [ ] Load históricos OHLCV (5 años mínimo)
        - [ ] Replay estrategias contra históricos
        - [ ] Calculate metrics: Win rate, Sharpe, Max drawdown, ROI
        - [ ] Create comparison framework (Straddle vs Strangle)
        - [ ] Generate backtesting report (HTML)
        - [ ] Performance optimization: <30s para 5 años de datos
      DoD: Backtesting resulta documentado, reports generados

```

#### Dependencias en Fases 4-5

- ⏳ **Historical Data:** Acceso a 5+ años de OHLCV data (Alpha Vantage o broker APIs)
  - *Timeline requerido:* Semana 4
  - *Impacto:* Si falla → usar sample data para MVP

---

### ⏱️ FASE 4: Persistencia & Historial (Semana 6)

**Objetivo:** Modelo de trades auditable, logging completo, exportación datos

#### Hitos (Milestones)

| Hito | Descripción | Criterio de Aceptación |
|------|-------------|------------------------|
| **M4.1** ✅ Trade Model in DB | Trades persisten con todos detalles | Schema validado, queries <100ms |
| **M4.2** ✅ Audit Trail Logging | 100% de operaciones logeadas | Immutable logs, traceable a usuario |
| **M4.3** ✅ Historical Dashboard API | Endpoints para frontend | Paginación, filtering, sorting funcional |
| **M4.4** ✅ Data Export (CSV/JSON) | Usuarios pueden exportar históricos | Formatos validados, encripción de sensibles |

#### Tareas Semana 6

```
T163: Trade Model & Persistence Layer
      Asignado: Dev Backend 2
      Horas: 30
      Subtasks:
        - [ ] Design Trade entity (entry_price, exit_price, qty, pnl, duration)
        - [ ] Create migrations para trades table
        - [ ] Implementar TradeRepository (CRUD + queries avanzadas)
        - [ ] Create indices: broker_id, strategy, created_at
        - [ ] Connection pooling optimization
        - [ ] Tests: 100+ operaciones bulk
      DoD: Trades guardados y recuperados correctamente

T164: Comprehensive Audit Trail
      Asignado: Dev Backend 2
      Horas: 40
      Subtasks:
        - [ ] Design audit log schema (operation, user, timestamp, changes)
        - [ ] Create auditlog table con archiving
        - [ ] Implementar AuditService (log all AI agent actions)
        - [ ] Immutability: prevent updates after 30 days
        - [ ] Create audit report generator
        - [ ] Compliance: SOC 2 Type II readiness
      DoD: Todos los trades y decisiones auditadas

T165: Historical Dashboard API Endpoints
      Asignado: Dev Backend 1
      Horas: 35
      Subtasks:
        - [ ] GET /api/trades (paginado, filtrable)
        - [ ] GET /api/trades/summary (stats: win rate, avg ROI, Sharpe)
        - [ ] GET /api/trades/:id (detalles completos)
        - [ ] GET /api/trades/export (CSV + JSON)
        - [ ] Rate limiting: 100 req/min
        - [ ] Validar RLS policies (users solo ven own trades)
      DoD: API endpoints documentados en OpenAPI

T166: Data Export + Reporting
      Asignado: Dev Backend 1
      Horas: 25
      Subtasks:
        - [ ] Implementar CSV export (trades + audit logs)
        - [ ] Implementar JSON export (nested structures)
        - [ ] Excel template generator (con gráficos)
        - [ ] Async export job (email delivery)
        - [ ] Encrypt sensible data en exports
        - [ ] Test: exports de 10k+ records exitosos
      DoD: Exports funcionan, formatos validados

```

---

### ⏱️ FASE 5: Frontend & UI (Semanas 7-8)

**Objetivo:** Interfaz React completa, charts interactivos, dashboard de control

#### Hitos (Milestones)

| Hito | Descripción | Criterio de Aceptación |
|------|-------------|------------------------|
| **M5.1** ✅ React Components | Panel estrategias, configuración | TypeScript strict, Storybook stories |
| **M5.2** ✅ Volatility Charts | TradingView Lightweight + custom overlays | Real-time updates, 60fps rendering |
| **M5.3** ✅ Trade History Table | Tabla paginada, filtrable, sorteable | Performance: <200ms para 5k rows |
| **M5.4** ✅ Master Dashboard | Layout unificado, responsive design | Mobile-first, Tailwind responsive |

#### Tareas Semanas 7-8

```
T167: Strategy Configuration Panel (React Components)
      Asignado: Dev Frontend 1
      Horas: 45
      Subtasks:
        - [ ] Create StrategySelector component (Straddle / Strangle picker)
        - [ ] Create SymbolInput component (autocomplete, validation)
        - [ ] Create StrategyParams form (strike offset, quantity, expiry)
        - [ ] Create StrategyPreview component (simulated Greeks)
        - [ ] Connect to backend API (GET /api/strategies)
        - [ ] Form validation + error states
        - [ ] Storybook stories para cada componente
      DoD: Componentes funcionales, TypeScript strict

T168: Volatility Charts + Technical Indicator Visualization
      Asignado: Dev Frontend 2
      Horas: 50
      Subtasks:
        - [ ] Integrar TradingView Lightweight Charts
        - [ ] Crear custom overlay para Straddle/Strangle visuals
        - [ ] Implementar RSI, MACD, BB en subgraphs
        - [ ] Real-time data feed (WebSocket integration)
        - [ ] IV/HV ratio visualization (separate panel)
        - [ ] Zoom + pan functionality
        - [ ] Performance: 60fps @30 symbols
      DoD: Charts renderean correctamente, real-time data flows

T169: Historical Trade Data Table + Filters
      Asignado: Dev Frontend 1
      Horas: 40
      Subtasks:
        - [ ] Create TradeTable component (AG Grid o React Table)
        - [ ] Columns: symbol, entry_price, exit_price, pnl%, duration, strategy
        - [ ] Paginación (50 rows/page)
        - [ ] Filters: strategy, symbol, date_range, status
        - [ ] Sorting: click column headers
        - [ ] Row expansion: trade details modal
        - [ ] Performance: virtualization para 10k+ rows
      DoD: Table funcional, <200ms para 5k rows

T170: Master Dashboard Layout + Integration
      Asignado: Dev Frontend 2
      Horas: 50
      Subtasks:
        - [ ] Create main Dashboard layout (React Router)
        - [ ] Left sidebar: navigation, strategy selector
        - [ ] Main content: charts + table side-by-side
        - [ ] Right sidebar: stats panel (win rate, Sharpe, last trade)
        - [ ] Header: status indicator (AI running/paused)
        - [ ] Responsive design (mobile-friendly)
        - [ ] Dark mode toggle (Tailwind)
        - [ ] Integration: connect all subcomponents
      DoD: Dashboard completo, 3 routes navegables

```

#### Dependencias en Fases 7-8

- ⏳ **TEAM-02 (Dashboard Base):** Debe tener layout base lista semana 5
  - *Timeline requerido:* Semana 5
  - *Impacto:* Si falla → podemos reutilizar estructura existente

---

### ⏱️ FASE 6: Testing & Documentación (Semana 9)

**Objetivo:** 100% de cobertura crítica, documentación completa, lista para producción

#### Hitos (Milestones)

| Hito | Descripción | Criterio de Aceptación |
|------|-------------|------------------------|
| **M6.1** ✅ Unit Tests | Todos agentes AI + servicios core | 85%+ code coverage |
| **M6.2** ✅ Integration Tests | Broker adapters, persistencia | 15+ scenarios end-to-end |
| **M6.3** ✅ E2E Tests | Flujo completo análisis → ejecución | 10+ happy paths + edge cases |
| **M6.4** ✅ Documentation | API docs, architecture guide, runbooks | OpenAPI + Markdown completo |

#### Tareas Semana 9

```
T171: Unit Tests - Core AI Agents (100% coverage)
      Asignado: Dev Backend 1 + 2 (pair programming)
      Horas: 40
      Subtasks:
        - [ ] Unit tests para AnalyzerAgent (input/output validation)
        - [ ] Unit tests para StrategistAgent (decision logic)
        - [ ] Unit tests para ExecutorAgent (order creation)
        - [ ] Unit tests para all Indicators (RSI, MACD, BB)
        - [ ] Mocking externas (broker APIs, market data)
        - [ ] Coverage report: 85%+ target
        - [ ] CI/CD: tests ejecutan en cada commit
      DoD: `npm run test:unit` green, coverage documented

T172: Integration Tests - Broker Adapters & Persistence
      Asignado: Dev Backend 1 + 2 (pair programming)
      Horas: 35
      Subtasks:
        - [ ] Integration test: Analyzer → DB
        - [ ] Integration test: Strategist → Executor
        - [ ] Integration test: Executor → IBKR mock
        - [ ] Integration test: Executor → Alpaca mock
        - [ ] Integration test: Trade persistence + audit log
        - [ ] Scenarios: successful trades, failed orders, retries
      DoD: `npm run test:integration` green, scenarios documented

T173: E2E Tests - Full Workflow Validation
      Asignado: Dev Frontend 1 + 2
      Horas: 35
      Subtasks:
        - [ ] E2E test: Market data load → analysis complete
        - [ ] E2E test: Signal generation → strategy selection
        - [ ] E2E test: Strategy → order submission → fill confirmation
        - [ ] E2E test: Trade persistence → dashboard visibility
        - [ ] E2E test: Data export functionality
        - [ ] Happy path + 5 edge cases (API failures, timeouts)
      DoD: `npm run test:e2e` all scenarios passing

T174: API & Architecture Documentation
      Asignado: Guillermo Ávila (Lead) + Dev Backend 1
      Horas: 30
      Subtasks:
        - [ ] OpenAPI 3.0 spec (all endpoints)
        - [ ] Architecture decision records (ADRs)
        - [ ] Deployment runbook (staging + prod)
        - [ ] Troubleshooting guide (common issues)
        - [ ] API rate limits + quota documentation
        - [ ] SLA documentation (uptime, latency targets)
      DoD: Full documentation in /docs folder

```

---

## 📅 Dependencias Externas & Timeline

### Equipos Dependientes

| Equipo | Requerimiento | Fecha Entrega Requerida | Impacto si Falla | Mitigation |
|--------|---------------|------------------------|------------------|-----------|
| **TEAM-01** | API brokers (IBKR/Alpaca SDKs) | Semana 2 | ⚠️ CRÍTICO | Mock brokers para T158 |
| **TEAM-02** | Dashboard base layout | Semana 5 | 🟡 Alto | Reutilizar layout existente |
| **TEAM-03** | Auth + RLS policies | Semana 1 | 🟡 Medio | RLS policies locales temporales |
| **TEAM-04** | Infraestructura cloud | Semana 8 | 🟡 Medio | Retrasar deploy a semana 10 |

### Recursos Externos

| Recurso | Requerimiento | Proveedor | Costo | Status |
|---------|---------------|-----------|----|--------|
| Market Data API | OHLCV, IV data real-time | Alpha Vantage / Broker | ~$50/mes | ✅ Ready |
| Broker APIs | Order execution, positions | IBKR + Alpaca | ~$10/mes | ⏳ Pending TEAM-01 |
| Historical Data | 5+ años para backtesting | Broker history / Quandl | Free-$200 | ✅ Available |
| Cloud Infrastructure | API hosting, databases | Azure/AWS | ~$200/mes | ⏳ Pending TEAM-04 |

---

## 🎯 Hitos y Go/No-Go Criterios

### Hito 1: Semana 1 - Setup Completado

**✅ Criterios de Aceptación (Go)**
- [ ] Todo el equipo puede hacer `npm run dev` sin errores
- [ ] Docker compose está ejecutándose correctamente
- [ ] Esquema Supabase deployado con RLS policies
- [ ] Architecture document está PR-ready
- [ ] CI/CD pipelines básicos funcionan

**🔴 Criterios de Bloqueo (No-Go)**
- ❌ Fallos en Node.js 22 LTS compatibility
- ❌ Docker no ejecuta en mínimo 2 SO (Windows, macOS, Linux)
- ❌ Supabase migrations fallan

**Decisión:** 🟢 **GO** o 🔴 **NO-GO** tomada por Guillermo Ávila (Lead)

---

### Hito 2: Semana 3 - Core AI Funcionando

**✅ Criterios de Aceptación (Go)**
- [ ] AnalyzerAgent procesa 30+ símbolos en <2 segundos
- [ ] StrategistAgent selecciona estrategia correcta (validado manual vs 100 históricos)
- [ ] ExecutorAgent crea órdenes sin crashes
- [ ] ExecutorAgent bloquea ejecución real hasta aprobación humana explícita
- [ ] IBKR + Alpaca adapters responden a paper trading
- [ ] Unit test coverage >80%

**🔴 Criterios de Bloqueo (No-Go)**
- ❌ Broker adapters fallan >5% de calls
- ❌ Analyzer latencia >3 segundos
- ❌ No hay validación manual de estrategias (acuracy <70%)

**Decisión:** 🟢 **GO** o 🔴 **NO-GO** tomada por Guillermo Ávila (Lead)

---

### Hito 3: Semana 5 - Análisis Técnico Completado

**✅ Criterios de Aceptación (Go)**
- [ ] Indicadores técnicos vs TradingView <1% error
- [ ] IV/HV ratios vs broker valores <2% discrepancia
- [ ] Signal aggregator weighted scoring documentado
- [ ] Backtesting engine genera reportes Sharpe ratio >1.0

**🔴 Criterios de Bloqueo (No-Go)**
- ❌ Indicadores tienen errores >1%
- ❌ IV/HV discrepancias >3%
- ❌ Backtesting engine >30 segundos para 5 años

**Decisión:** 🟢 **GO** o 🔴 **NO-GO** tomada por Guillermo Ávila (Lead)

---

### Hito 4: Semana 6 - Persistencia Auditable

**✅ Criterios de Aceptación (Go)**
- [ ] 100% de trades persistidos correctamente
- [ ] Audit trail logging 100% de operaciones
- [ ] Historical API endpoints responden <100ms
- [ ] Exports generan formatos válidos (CSV, JSON)

**🔴 Criterios de Bloqueo (No-Go)**
- ❌ Trades pierden datos >0.1%
- ❌ Queries API >200ms
- ❌ Exports corruptos o incompletos

**Decisión:** 🟢 **GO** o 🔴 **NO-GO** tomada por Guillermo Ávila (Lead)

---

### Hito 5: Semana 8 - UI Completa & Funcional

**✅ Criterios de Aceptación (Go)**
- [ ] Dashboard renderea sin errores en Chrome, Firefox, Safari
- [ ] Charts actualizan en tiempo real (WebSocket working)
- [ ] Table de histórico maneja 5k+ rows sin lag
- [ ] Responsive design funciona en móvil (375px width)

**🔴 Criterios de Bloqueo (No-Go)**
- ❌ Crashes en navegadores principales
- ❌ Charts lag >16ms (no 60fps)
- ❌ Mobile UI ilegible

**Decisión:** 🟢 **GO** o 🔴 **NO-GO** tomada por Guillermo Ávila (Lead)

---

### Hito 6: Semana 9 - MVP v1.0 Producción Ready

**✅ Criterios de Aceptación (Go)**
- [ ] 85%+ code coverage (unit + integration)
- [ ] E2E tests: 10+ scenarios passing
- [ ] Documentation completa (OpenAPI + Architecture)
- [ ] Uptime test: >99% en 24h staging
- [ ] Performance: API latency <200ms p95

**🔴 Criterios de Bloqueo (No-Go)**
- ❌ Coverage <75%
- ❌ E2E failures >1 scenario
- ❌ API latency >500ms p95
- ❌ Documentación incompleta

**Decisión:** 🟢 **GO** (Deploy a Producción) o 🔴 **NO-GO** (Semana 10) tomada por Guillermo Ávila (Lead)

---

## 👥 Recursos & Asignación Detallada

### Matriz RACI por Tarea

| Tarea | Lead | Backend 1 | Backend 2 | Frontend 1 | Frontend 2 | Responsable |
|-------|------|-----------|-----------|-----------|-----------|------------|
| T151 Setup | C | R | C | C | - | Backend 1 |
| T151B Docker | C | R | C | - | - | Backend 1 |
| T153 AI Architecture | R | A | A | C | C | Lead |
| T154 Supabase | C | C | R | - | - | Backend 2 |
| T155 Analyzer | C | R | C | - | - | Backend 1 |
| T156 Strategist | C | R | C | - | - | Backend 1 |
| T157 Executor | C | C | R | - | - | Backend 2 |
| T158 Brokers | C | C | R | - | - | Backend 2 |
| T159 Indicators | C | C | R | - | - | Backend 2 |
| T160 IV/HV | C | C | R | - | - | Backend 2 |
| T161 Signal Agg | C | C | R | - | - | Backend 2 |
| T162 Backtesting | C | R | C | - | - | Backend 1 |
| T163 Trade Model | C | C | R | - | - | Backend 2 |
| T164 Audit Trail | C | C | R | - | - | Backend 2 |
| T165 API Hist | C | R | C | - | - | Backend 1 |
| T166 Export | C | R | C | - | - | Backend 1 |
| T167 Strategy UI | C | - | - | R | C | Frontend 1 |
| T168 Charts | C | - | - | C | R | Frontend 2 |
| T169 Trade Table | C | - | - | R | C | Frontend 1 |
| T170 Dashboard | C | - | - | C | R | Frontend 2 |
| T171 Unit Tests | C | R | R | C | C | Lead (oversight) |
| T172 Integration | C | R | R | - | - | Lead (oversight) |
| T173 E2E | C | C | C | R | R | Lead (oversight) |
| T174 Docs | R | R | C | C | C | Lead |

**Leyenda:** R = Responsible (hace el trabajo) | A = Accountable (aprueba) | C = Consulted | I = Informed

### Carga Horaria Estimada

| Rol | Semana 1 | Semana 2-3 | Semana 4-5 | Semana 6 | Semana 7-8 | Semana 9 | Total |
|-----|----------|-----------|-----------|----------|-----------|----------|-------|
| **Lead** | 40h | 40h | 40h | 20h | 20h | 30h | **190h** |
| **Backend 1** | 40h | 40h | 60h | 35h | - | 40h | **215h** |
| **Backend 2** | 40h | 40h | 85h | 70h | - | 35h | **270h** |
| **Frontend 1** | - | - | - | - | 85h | 35h | **120h** |
| **Frontend 2** | - | - | - | - | 100h | 35h | **135h** |
| **Total Equipo** | 120h | 120h | 185h | 125h | 205h | 175h | **930h** |

**Velocity:** ~155 horas/semana = 930 horas / 6 semanas activas

---

## ⚠️ Riesgos & Estrategias de Mitigación

### Matriz de Riesgos (Impact x Likelihood)

| # | Riesgo | Severidad | Probabilidad | Impact | Mitigación | Owner |
|---|--------|-----------|--------------|--------|-----------|-------|
| **R1** | API broker falla/timeout | 🔴 Crítico | 🟡 Media | ⚠️ Alto | Health checks c/30s + fallback a Alpaca | Backend 2 |
| **R2** | IV calculation inexacta | 🟡 Alto | 🟡 Media | 🟡 Medio | Validación vs broker IV (±2% tolerancia) | Backend 2 |
| **R3** | Latencia >500ms | 🟡 Alto | 🟡 Media | 🟡 Medio | Caching estratégico + async tasks + profiling | Backend 1 |
| **R4** | Merge conflicts TEAM-01 | 🟡 Alto | 🟠 Baja | 🟢 Bajo | Interfaces contractuales (contracts/) + daily syncs | Lead |
| **R5** | Database connection pool exhausted | 🔴 Crítico | 🟠 Baja | 🔴 Alto | Connection limits + queue manager + alerts | Backend 2 |
| **R6** | Frontend chart rendering lag | 🟡 Alto | 🟠 Baja | 🟡 Medio | Virtual scrolling + debouncing + GPU accel | Frontend 2 |
| **R7** | Backtesting data incomplete | 🟡 Alto | 🟠 Baja | 🟡 Medio | Multi-source historical data (broker + Quandl) | Backend 1 |
| **R8** | RLS policies overly permissive | 🔴 Crítico | 🟠 Baja | 🔴 Alto | Security audit by TEAM-03 + manual testing | Lead |

### Plan de Respuesta Detallado

#### R1: API Broker Falla 🔴

```
Trigger: Broker API error rate >5% en 60 segundos
Action:
  1. Log error en audit_logs (severity: CRITICAL)
  2. Fallback ExecutorAgent a segundo broker automático
  3. Alert slack/email a Backend 2 (5 min timeout)
  4. Retry logic: exponential backoff (1s, 2s, 4s, 8s)
  5. Si persiste >10 min: PAUSE AI agent (manual intervention)
  
Prevención:
  - Health check cada 30s en background task
  - Connection pooling con timeout config
  - Circuit breaker pattern en BrokerAdapter

DoD: Zero downtime <5min, fallback auto-tested
```

#### R2: IV Calculation Inexacta 🟡

```
Trigger: IV discrepancia >2% vs broker valor
Action:
  1. Log discrepancy en signals table (research column)
  2. Use broker IV como source-of-truth
  3. Alert Backend 2 para investigación
  4. Adjust weighting en SignalAggregator (reduce IV weight)
  
Prevención:
  - Validación IV calculation vs 10+ broker feeds
  - Unit tests con known IV scenarios
  - Daily calibration job (compara vs broker)

DoD: ±2% tolerance maintained, algo ajustado si falla
```

#### R3: Latencia >500ms 🟡

```
Trigger: API p95 latency >500ms sustainably
Action:
  1. Flamegraph profiling (Node.js inspect mode)
  2. Identify bottleneck (DB query, API call, calculation)
  3. Implement fix: caching, async, index optimization
  4. Stress test con load generator
  
Prevención:
  - Benchmark cada fase: target <200ms p95
  - Redis cache layer para market data
  - DB query optimization (índices correctos)
  - Async background jobs para heavy computation

DoD: <200ms p95 bajo normal load, <300ms p95 peak
```

#### R4: Merge Conflicts TEAM-01 🟡

```
Trigger: >3 conflictos en 1 semana
Action:
  1. Daily sync call (15 min, Lead + Backend 1)
  2. Agree on breaking changes early
  3. Use contracts/ folder para APIs estables
  
Prevención:
  - contracts/broker-adapter.md define interface
  - TEAM-01 respeta interface (versioning compatible)
  - Feature branches < 3 días lifetime
  - Code review antes merge

DoD: Zero production conflicts, PR reviews <24h
```

#### R5: Database Connection Pool Exhausted 🔴

```
Trigger: Connection pool >90% utilization
Action:
  1. Alert Dashboard (warning estado)
  2. Identify query leaks (check connection holders)
  3. Force timeout connections stale (>5 min)
  4. Scaleup pool size o reduce concurrent connections
  
Prevención:
  - Pool size = 10 connections (tuned para 5 devs)
  - Connection timeout = 30s
  - Monitoring: Grafana dashboard
  - Load test: 100 concurrent requests

DoD: Pool never exceeds 80% under normal load
```

#### R6: Frontend Chart Rendering Lag 🟡

```
Trigger: Chart render >16ms (drops 60fps), memory >200MB
Action:
  1. DevTools profiling (Chrome Performance tab)
  2. Identify render bottleneck (large SVG, unoptimized re-renders)
  3. Implement fix: React.memo, useMemo, virtual scrolling
  
Prevención:
  - Lighthouse audits cada 2 semanas
  - Virtual scrolling para 5k+ data points
  - Debounce zoom/pan events
  - WebWorker para calculations de datos pesados

DoD: 60fps @30 symbols, <100MB memory footprint
```

#### R7: Backtesting Data Incomplete 🟡

```
Trigger: Backtesting candles missing >1% data points
Action:
  1. Fetch data from alternate source (Quandl, IEX)
  2. Forward-fill missing values (conservative approach)
  3. Manual inspection de gaps (log para investigación)
  
Prevención:
  - Download históricos 5+ brokers
  - Validate data completeness en import
  - Fill gaps con averaged values de múltiples fuentes
  - Alert si gaps >0.5%

DoD: Backtesting data 99%+ complete, gaps documentados
```

#### R8: RLS Policies Overly Permissive 🔴

```
Trigger: Security audit falla
Action:
  1. Immediately restrict policies (default: deny)
  2. TEAM-03 audit policies línea por línea
  3. Implement row-level filtering en API (defense in depth)
  4. User testing: confirm can't access other user trades
  
Prevención:
  - TEAM-03 proporciona RLS templates (semana 1)
  - Unit tests RLS policies (check_permission simulation)
  - Staging environment identical to prod
  - Weekly security audit (automated + manual)

DoD: RLS policies pass TEAM-03 security review
```

---

## ✅ Criterios de Éxito (MVP v1.0)

### Funcionalidad Core

| Criterio | Target | Validación | Owner |
|----------|--------|-----------|-------|
| **Análisis 30+ símbolos** | ✅ Simultáneo | Logging de 30 símbolos <2s | Backend 1 |
| **Estrategia Straddle** | ✅ Win rate >45% | Backtesting 5 años | Backend 1 |
| **Estrategia Strangle** | ✅ Win rate >40% | Backtesting 5 años | Backend 1 |
| **Órdenes Brokers** | ✅ 100 ejecutadas | IBKR + Alpaca paper testing | Backend 2 |

### Performance

| Criterio | Target | Métrica | Owner |
|----------|--------|--------|-------|
| **Latencia API** | <200ms p95 | New Relic APM | Backend 1 |
| **Chart rendering** | 60 fps | Chrome DevTools | Frontend 2 |
| **DB queries** | <100ms p95 | Supabase monitoring | Backend 2 |
| **Memory footprint** | <200MB | Node.js heap | Backend 1 |

### Fiabilidad

| Criterio | Target | Validación | Owner |
|----------|--------|-----------|-------|
| **Uptime** | >99.9% | 24h staging test | Lead |
| **Error rate** | <100 errores/1000 órdenes | Production logging | Backend 2 |
| **Audit trail** | 100% completitud | Spot check trades vs logs | Backend 2 |
| **Broker fallover** | <5min recovery | Chaos engineering | Backend 2 |

### Calidad de Código

| Criterio | Target | Tool | Owner |
|----------|--------|------|-------|
| **Unit test coverage** | 85%+ | Jest coverage report | Backend 1/2 |
| **TypeScript strict** | 0 errors | tsc --noEmit | Frontend 1/2 |
| **Linting** | ESLint clean | npm run lint | All |
| **Security scan** | 0 critical CVEs | npm audit | Lead |

### Analítica & Productividad

| Métrica | Inicial | Objetivo | Medición |
|---------|---------|----------|----------|
| **Win Rate (Straddle)** | N/A | >45% | Backtesting results |
| **Sharpe Ratio** | N/A | >1.2 | Backtesting analytics |
| **Max Drawdown** | N/A | <-15% | Risk metrics |
| **Recovery Factor** | N/A | >2.0 | (Profit / Max DD) |

---

## 📊 Timeline Detallado (Gantt Chart)

```
SEMANA 1: Setup & Arquitectura
├─ T151 (Backend 1): Setup Node 22 ████
├─ T151B (Backend 1): Docker setup ████
├─ T153 (Lead): AI Architecture ████
└─ T154 (Backend 2): Supabase + Schema ████

SEMANAS 2-3: Core AI Agents
├─ T155 (Backend 1): Analyzer Agent ████████
├─ T156 (Backend 1): Strategist Agent ████████
├─ T157 (Backend 2): Executor Agent ████████
└─ T158 (Backend 2): Broker Adapters ██████████

SEMANAS 4-5: Análisis Técnico
├─ T159 (Backend 2): Technical Indicators ██████████
├─ T160 (Backend 2): IV/HV Ratios ████████
├─ T161 (Backend 2): Signal Aggregator ████████
└─ T162 (Backend 1): Backtesting ███████████

SEMANA 6: Persistencia & Historial
├─ T163 (Backend 2): Trade Model ██████
├─ T164 (Backend 2): Audit Trail ████████
├─ T165 (Backend 1): Historical API ███████
└─ T166 (Backend 1): Data Export ██████

SEMANAS 7-8: Frontend & UI
├─ T167 (Frontend 1): Strategy Panel █████████
├─ T168 (Frontend 2): Volatility Charts ██████████
├─ T169 (Frontend 1): Trade Table ████████
└─ T170 (Frontend 2): Dashboard ██████████

SEMANA 9: Testing & Docs
├─ T171 (Backend 1+2): Unit Tests ████████
├─ T172 (Backend 1+2): Integration Tests ███████
├─ T173 (Frontend 1+2): E2E Tests ███████
└─ T174 (Lead): Documentation ██████
```

---

## 📝 Documentos de Referencia

### Documentación Requerida por Fase

| Fase | Documento | Responsable | Deadline |
|------|-----------|-------------|----------|
| 1 | Architecture Decision Record (ADR) | Lead | Fin semana 1 |
| 2 | AI Agent Communication Protocol | Backend 1 | Fin semana 2 |
| 3 | Technical Indicators Validation Report | Backend 2 | Fin semana 5 |
| 4 | Audit Trail Implementation Guide | Backend 2 | Fin semana 6 |
| 5 | UI Component Library (Storybook) | Frontend 1/2 | Fin semana 8 |
| 6 | OpenAPI 3.0 Spec + Deployment Runbook | Lead | Fin semana 9 |

### Links a Especificaciones Relacionadas

- 📄 [spec.md](spec.md) - Especificación detallada de requerimientos
- 📄 [research.md](research.md) - Investigación de tecnologías y patrones
- 📄 [data-model.md](data-model.md) - Entidades y esquema de datos
- 📄 [contracts/ai-agent-lifecycle.md](contracts/ai-agent-lifecycle.md) - Contrato AI
- 📄 [contracts/broker-adapter.md](contracts/broker-adapter.md) - Contrato brokers
- 📄 [contracts/strategy-context.md](contracts/strategy-context.md) - Contrato estrategias

---

## 🚀 Próximos Pasos (Acciones Post-Plan)

### Inmediato (Antes de Semana 1)

- [ ] **Setup meeting** (Guillermo + equipo, 30 min): Confirmar asignaciones, resolver dudas
- [ ] **Crear branches** en Git para cada fase (F1-setup, F2-ai-agents, etc.)
- [ ] **Establecer daily standup** (15 min, 10:00 AM UTC+1)
- [ ] **Configurar alertas Slack** para hitos y blockers
- [ ] **Reservar recursos cloud** (Supabase Pro, MongoDB Atlas)

### Semana 0 (Preparatoria)

- [ ] **TEAM-01 kickoff**: Confirmar API broker timeline
- [ ] **TEAM-03 review**: Validar RLS policies templates
- [ ] **Architecture workshop** (2h): Presentar ADR, obtener feedback
- [ ] **Dev environment** checklist completado por todo el equipo

### Semana 1 (Start)

- [ ] ✅ Ejecutar T151-T154 según plan
- [ ] ✅ Daily standups iniciados
- [ ] ✅ PR #1 merged: Environment setup
- [ ] ✅ M1.1-M1.4 achieved (Go/No-go decision)

---

**Plan Creado:** 2026-05-19 | **Versión:** 1.0 | **Status:** 📋 Listo para Ejecución
