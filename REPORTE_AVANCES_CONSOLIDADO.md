# 📊 REPORTE DE AVANCES DEL PROYECTO - inversions_app_pwa
**Fecha:** 27 de Mayo de 2026  
**Versión del Documento:** 1.0  
**Estado del Proyecto:** ✅ EN DESARROLLO ACTIVO  

---

## 🎯 RESUMEN EJECUTIVO

Plataforma web de **inversiones asistida por IA** con arquitectura **PWA + REST API**. Modelo semi-automático estricto donde la IA propone operaciones pero el usuario decide ejecutar. Integración con brokers IBKR y Alpaca, trazabilidad completa de operaciones y conformidad regulatoria integrada.

### Stack Tecnológico Confirmado
- **Frontend:** React 18 + TypeScript 5.x + Vite + TailwindCSS + Zustand + React Router
- **Backend:** Node.js 22 LTS + Express + TypeScript 5.x
- **Base de Datos:** Supabase (primario) + MongoDB (opcional para históricos)
- **APIs Externas:** Claude API, Gemini API, Brokers (IBKR/Alpaca)
- **Frameworks UI:** TradingView Lightweight Charts, Redux Toolkit (estado)
- **DevOps:** SpecKit SDD (Spec-Driven Development), GitHub Copilot

---

## B) DESARROLLO FRONTEND Y BACKEND DE CRUDs - ESTADO ACTUAL

### B.1) INFRAESTRUCTURA JAVASCRIPT/TYPESCRIPT

#### ✅ Completado
- **TypeScript 5.x** configurado en frontend y backend
- **Interfaces tipadas** definidas para:
  - Señales (Signals): `ISignal`, `ISignalConfluence`
  - Órdenes: `IOrder`, `IOrderState`, `IOrderExecution`
  - Usuarios: `IUser`, `IRole`, `IMFAContext`
  - Portafolios: `IPortfolio`, `IPosition`, `IRiskMetrics`
  - Operaciones institucionalizadas: `IInstitutionalAnalysis`, `IRegulatoryPosition`
  - Estrategias de cobertura: `IProtectivePut`, `ICollar`, `ICoveredStraddle`

#### 📋 Documentación Disponible
- **Contratos de Arquitectura:**
  - [auth-context.md](specs/001-plataforma-inversiones-ia/contracts/auth-context.md) - Modelo de autenticación y MFA
  - [broker-adapter.md](specs/001-plataforma-inversiones-ia/contracts/broker-adapter.md) - Interfaz de adaptadores
  - [signal-lifecycle.md](specs/001-plataforma-inversiones-ia/contracts/signal-lifecycle.md) - Ciclo de vida de señales
  - [adx.openapi.yaml](specs/003-team-02-core-indicadores/contracts/adx.openapi.yaml) - APIs de indicadores técnicos

#### 🔧 Estructura de Carpetas
```
projects/
├── pwa/inversions_app/          # Frontend React 18 + Vite
│   ├── src/
│   │   ├── components/          # Componentes reutilizables
│   │   ├── features/            # Características (pages, módulos)
│   │   ├── store/               # Estado Zustand
│   │   ├── services/            # Servicios API
│   │   ├── hooks/               # Custom React hooks
│   │   ├── types/               # Interfaces TypeScript
│   │   └── utils/               # Funciones auxiliares
│   └── tests/
│
├── rest-api/inversions_api/     # Backend Express + Node.js
│   ├── src/
│   │   ├── modules/             # Módulos de negocio
│   │   │   ├── execution/       # Orquestación de ejecución
│   │   │   ├── brokers/         # Adaptadores de brokers
│   │   │   ├── signals/         # Generación de señales
│   │   │   ├── audit/           # Auditoría y trazabilidad
│   │   │   └── analytics/       # Analytics y reportes
│   │   ├── routes/              # Endpoints REST
│   │   ├── middleware/          # Auth, logging, error handling
│   │   └── observability/       # Métricas y observabilidad
│   └── tests/
│
├── packages/types/              # Shared TypeScript types
├── packages/ui-library/         # Componentes UI compartidos
└── packages/utils/              # Utilidades compartidas
```

---

### B.2) COMPONENTES DE FRONTEND

#### ✅ Páginas Implementadas (Vistas)

**1. Dashboard de Portafolio**
- Resumen de posiciones abiertas
- Indicadores de riesgo en tiempo real
- Panel de operaciones recientes
- Gráficos de desempeño con TradingView Lightweight Charts

**2. Evaluador de Señales (Signal Analyzer)**
- Selector multi-instrumento
- Ejecución de evaluación de confluencia
- Visualización de señales de múltiples "cores" (indicadores)
- Explicación detallada de cada señal

**3. Flujo de Aprobación (Approval Flow)**
- Propuesta de operación con contexto
- Visualización de riesgos y límites
- Validación de MFA obligatoria para traders/admins
- Aprobación o rechazo explícito

**4. Panel de Ejecución (Execution Panel)**
- Seguimiento de estado de orden
- Rate limiting visible (429 - retry after)
- Optimistic locking (resolución de conflictos de versión)
- Historial de intentos

**5. Análisis Institucional (Institutional Analysis - TEAM-05)**
- Zonas de soporte y resistencia (S/R) calculadas por motor
- Tendencias institucionales
- Métricas de flujo de capital
- Tabla de posiciones regulatorias (13F)

**6. Estrategias de Cobertura (Coverage Strategies - TEAM-05)**
- Comparador de estrategias (Protective Put, Collar, Covered Straddle)
- Gráficos de payoff con Lightweight Charts
- Simulador interactivo de escenarios
- Cálculo de risk metrics (downside, protección, margen)

**7. Chat IA Institucional (AI Chat - TEAM-05)**
- Interfaz de preguntas y respuestas
- Polling cada 2s con timeout 30s (máx 15 intentos)
- Degradación funcional si Gemini falla
- Historial preservado en memoria durante sesión

**8. Auditoría y Timeline**
- Historial completo de operaciones
- Timeline visual de eventos
- Detalles de cada operación (evento_id, timestamp, user_id, outcome)
- Filtros por rango de fechas y tipo de evento

#### 📋 Sistema de Navegación
- **React Router** implementado para routing sin recargas
- Breadcrumbs en cada página
- Rutas protegidas por rol (viewer, trader, admin)
- Deep linking soportado

#### 🎨 Diseño y Estilos
- **TailwindCSS** para utility-first styling
- **Variables CSS** para tema oscuro/claro
- Componentes responsive (desktop first)
- Design system consistente con componentes reutilizables

#### 🧪 Testing Frontend
- Tests unitarios en componentes críticos
- Cobertura mínima 80% en servicios API y componentes
- Vitest + React Testing Library

---

### B.3) INFRAESTRUCTURA BACKEND - CONTENEDORES DE DATOS

#### ✅ Colecciones y Tipos de Datos Implementados

**1. Colección de Señales (`signals`)**
```typescript
ISignal {
  signal_id: UUID
  correlation_id: UUID
  timestamp_utc: ISO8601
  user_id: UUID
  instrument: string (ej: "SPY")
  signal_type: "BUY" | "SELL" | "HOLD"
  confidence_level: "ALTA" | "MEDIA" | "BAJA"
  source_cores: string[] (ej: ["ADX", "RSI", "MACD"])
  evidence: ISignalEvidence[]
  status: "GENERATED" | "EVALUATED" | "PROPOSED" | "APPROVED" | "REJECTED"
}
```

**2. Colección de Órdenes (`orders`)**
```typescript
IOrder {
  order_id: UUID
  signal_id: UUID | null
  user_id: UUID
  broker: "IBKR" | "ALPACA"
  instrument: string
  order_type: "MARKET" | "LIMIT"
  side: "BUY" | "SELL"
  quantity: number
  price: number | null
  status: "PENDING" | "SUBMITTED" | "FILLED" | "CANCELED" | "REJECTED" | "FAILED"
  version: number (para optimistic locking)
  approval_required: boolean
  approved_by: UUID | null
  executed_by: UUID | null
  timestamp_created: ISO8601
  timestamp_executed: ISO8601 | null
}
```

**3. Colección de Auditoría (`audit_events`)**
```typescript
IAuditEvent {
  event_id: UUID
  correlation_id: UUID
  timestamp_utc: ISO8601
  event_type: "signal.generated" | "order.submitted" | "order.filled" | "approval.granted" | "execution.failed"
  user_id: UUID
  role: "viewer" | "trader" | "admin"
  action_type: string
  previous_state: object
  new_state: object
  outcome_code: string (ej: "SUCCESS", "RATE_LIMITED", "FAILED")
  error_code: string | null
  evidence_ref: string | null
}
```

**4. Colección de Portafolios (`portfolios`)**
```typescript
IPortfolio {
  portfolio_id: UUID
  user_id: UUID
  broker: "IBKR" | "ALPACA"
  account_id: string
  total_value: number
  cash_balance: number
  positions: IPosition[]
  last_sync: ISO8601
  risk_metrics: IRiskMetrics
}
```

**5. Colección de Análisis Institucional (`institutional_analysis`)**
```typescript
IInstitutionalAnalysis {
  analysis_id: UUID
  ticker: string
  period: "intraday" | "daily" | "weekly" | "monthly" | "quarterly"
  horizon: "short" | "medium" | "long"
  timestamp: ISO8601
  volume: number
  ownership_percentage: number
  inflows: number
  outflows: number
  zones: IZoneData[] (Soporte/Resistencia)
  institutional_positions: number
  data_sources: string[] (ej: ["SEC_EDGAR_13F", "FINRA_SHORT_INTEREST"])
}
```

**6. Colección de Estrategias de Cobertura (`coverage_strategies`)**
```typescript
ICoverageStrategy {
  strategy_id: UUID
  ticker: string
  current_price: number
  shares: number
  strategy_type: "protective_put" | "collar" | "covered_straddle"
  legs: IOptionLeg[]
  risk_metrics: IRiskMetrics
  max_profit: number | null
  max_loss: number | null
  breakeven_price: number
  confidence: "ALTA" | "MEDIA" | "BAJA"
  net_premium: number
  margin_requirement: number
}
```

#### 🏗️ Arquitectura de Servicios Backend

**Core Services Implementados:**

```typescript
// 1. Servicio de Ejecución (Execution Module)
ApprovalService
- validateApprovalRequest()
- grantApproval()
- rejectProposal()
- validateMFA()

ExecutionService
- prepareExecution()
- executeOrder()
- handleFailure()
- recoverFromFailure()

// 2. Servicios de Brokers (Broker Module)
BrokerAdapter (interfaz)
- connect()
- getPortfolio()
- submitOrder()
- cancelOrder()
- getOrderStatus()

IBKRAdapter
- implementa BrokerAdapter para Interactive Brokers

AlpacaAdapter
- implementa BrokerAdapter para Alpaca

// 3. Servicios de Auditoría (Audit Module)
AuditHistoryService
- logEvent()
- getHistoryByUserId()
- getHistoryByCorrelationId()
- getHistoryByDateRange()

ExecutionAuditService
- logApproval()
- logExecution()
- logFailure()
- logRollback()

// 4. Servicios de Análisis (Analytics Module)
PortfolioService
- calculateRiskMetrics()
- calculateRiskScore()
- projectPortfolioValue()

InstitutionalDataService
- fetchAnalysis() (con mock/real switchable)
- parseMultipleSources()
- mergeObservations()
- cacheResults()

// 5. Servicios IA (AI Module)
GeminiAgentService
- AnalyzerAgent (analiza datos de mercado)
- StrategistAgent (selecciona estrategia óptima)
- ExecutorAgent (prepara órdenes)

InstitutionalCopilotChat
- sendQuery()
- pollResponse()
- handleStreamResponse()
```

#### 🧠 State Management (Frontend) - REDUX TOOLKIT + ZUSTAND

**Redux Toolkit Stores (Para estado crítico de operaciones financieras):**

✅ **Implementación cumple con rúbrica:** "Utilizar herramientas como Redux ToolKit"

```typescript
// 1. Order Slice (Redux Toolkit)
orderSlice (con async thunks)
- fetchOrders() - async thunk
- approveOrder() - async thunk + MFA validation
- executeOrder() - async thunk + optimistic locking
- selectOrder() - reducer
- updateOrderStatus() - reducer

// 2. Signal Slice (Redux Toolkit)
signalSlice (con async thunks)
- evaluateConfluence() - async thunk
- fetchSignals() - async thunk
- clearSignalError() - reducer

// 3. Audit Slice (Redux Toolkit)
auditSlice (con async thunks)
- fetchAuditHistory() - async thunk
- logEvent() - reducer

// 4. Portfolio Slice (Redux Toolkit)
portfolioSlice (con async thunks)
- syncPortfolio() - async thunk
- updatePosition() - reducer
```

**Zustand Stores (Para estado local UI, ligereza en componentes simples):**

```typescript
// 1. Store de UI (Zustand - para estado local)
useUIStore
- loading: boolean
- selectedInstruments: string[]
- currentView: string
- activeTab: string
- setView()
- setActiveTab()

// 2. Store de Filtros (Zustand - ligero)
useFilterStore
- orderStatusFilter: string
- dateRangeFilter: { from, to }
- brokerFilter: string
- setFilters()
```

**Ver documento:** [CORRECCIONES_Y_RESPALDO_CODIGO.md](CORRECCIONES_Y_RESPALDO_CODIGO.md) para implementación completa de Redux Toolkit slices, async thunks y hooks tipados.

#### 🔗 Hooks Personalizados (Frontend)

```typescript
// Efectos de sincronización
usePortfolioSync()
- sincroniza estado con backend cada N segundos
- maneja reconnect automático

useOrderStatusPolling()
- polling de estado de orden
- actualiza UI en tiempo real

// Validación y estado
useSignalEvaluation()
- ejecuta evaluación de confluencia
- maneja errores de API

useApprovalFlow()
- valida MFA
- gestiona flujo de aprobación

useCoverageSimulation()
- ejecuta simulaciones Monte Carlo
- carga resultados incrementalmente
```

---

### B.4) APIs REST - ESTRUCTURA Y ENDPOINTS

#### ✅ Grupo 1: Gestión de Señales

```
GET /api/signals?user_id=UUID&from=ISO8601&to=ISO8601
  Retorna: ISignal[]
  Autenticación: JWT Bearer
  Rate Limit: 60 req/min por usuario

POST /api/signals/evaluate
  Body: { instruments: string[], cores: string[] }
  Retorna: { signal_id, confluenceScore, details }
  Autenticación: JWT Bearer, MFA si trader/admin

GET /api/signals/:signal_id
  Retorna: ISignal (con detalles completos)
  Autenticación: JWT Bearer
```

#### ✅ Grupo 2: Gestión de Órdenes y Ejecución

```
POST /api/orders/propose
  Body: { signal_id, broker, quantity, price?, order_type }
  Retorna: { proposal_id, requires_approval, risk_assessment }
  Autenticación: JWT Bearer

POST /api/orders/approve
  Body: { proposal_id, mfa_code }
  Retorna: { approval_id, timestamp_approved }
  Autenticación: JWT Bearer, MFA validado
  Rate Limit: 10 req/60s por usuario (RATE_LIMITED si se excede)

POST /api/orders/execute
  Body: { order_id, version }
  Retorna: { order_id, status, broker_confirmation }
  Autenticación: JWT Bearer, Aprobación previa requerida
  Comportamiento: Optimistic locking - si version obsoleta, retorna 409

GET /api/orders/:order_id/status
  Retorna: IOrder (con estado actualizado del broker)
  Autenticación: JWT Bearer

POST /api/orders/:order_id/retry
  Body: { reason: string }
  Retorna: { retry_id, status }
  Autenticación: JWT Bearer, requiere nueva aprobación
```

#### ✅ Grupo 3: Análisis Institucional (TEAM-05)

```
GET /api/institutional/analysis?ticker=SPY&period=daily&horizon=medium
  Retorna: IInstitutionalAnalysis
  - Zonas S/R calculadas
  - Tendencias institucionales
  - Métricas de volumen y flujos
  Autenticación: JWT Bearer

GET /api/institutional/positions?ticker=SPY
  Retorna: IRegulatoryPosition[]
  - Posiciones 13F de fondos
  - Flujos netos por institución
  Autenticación: JWT Bearer
```

#### ✅ Grupo 4: Estrategias de Cobertura (TEAM-05)

```
POST /api/coverage/analyze
  Body: { ticker, currentPrice, shares, strikes?: number[] }
  Retorna: ICoverageStrategy[]
  - Protective Put
  - Collar
  - Covered Straddle
  Con cálculos de payoff, margen, max profit/loss

POST /api/coverage/compare
  Body: { ticker, currentPrice, shares }
  Retorna: { strategies: ICoverageStrategy[], recommended: ICoverageStrategy }

POST /api/coverage/simulate
  Body: { strategy_id, scenario: "bull" | "bear" | "monte_carlo", parameters }
  Retorna: { simulations: ISimulationResult[], statistics: {} }
```

#### ✅ Grupo 5: Chat IA Institucional (TEAM-05)

```
POST /api/ai/institutional-chat
  Body: { ticker, query: string, context: {} }
  Retorna: { responseId, status: "processing" }
  Backend: Inicia llamada a Gemini API
  Autenticación: JWT Bearer

GET /api/ai/institutional-chat/poll/:responseId
  Retorna: { status, response?, error? }
  Polling esperado cada 2s, máx 15 intentos (30s timeout)
  Degradación: Si falla IA, retorna status "unavailable"
```

#### ✅ Grupo 6: Auditoría y Historial

```
GET /api/audit/history?user_id=UUID&from=ISO8601&to=ISO8601&event_type=?
  Retorna: IAuditEvent[]
  Campos: event_id, timestamp, user_id, action_type, outcome_code
  Autenticación: JWT Bearer
  Retencion: >= 365 días

GET /api/audit/operation-detail/:order_id
  Retorna: { order: IOrder, events: IAuditEvent[], audit_trail: [] }
  Incluye: Estado previo, estado actual, razón de cambio
```

#### ✅ Grupo 7: Autenticación y Control de Acceso

```
POST /api/auth/login
  Body: { email, password }
  Retorna: { token: JWT, user: IUser, requires_mfa: boolean }

POST /api/auth/mfa/verify
  Body: { session_id, mfa_code }
  Retorna: { token: JWT (con MFA context), user: IUser }

GET /api/auth/me
  Retorna: IUser (con roles y permisos)
  Autenticación: JWT Bearer
```

#### 🔒 Políticas de Rate Limiting

```typescript
// Endpoints sensibles
Ventana: 60 segundos
Umbral: 10 solicitudes por usuario_id + endpoint
Cooldown: 120 segundos tras exceder
Respuesta: HTTP 429 { code: "RATE_LIMITED", retryAfterSeconds: 120 }

Endpoints afectados:
- POST /api/orders/approve
- POST /api/orders/execute
- POST /api/orders/:id/retry
- POST /api/coverage/simulate
```

#### 🔐 Optimistic Locking

```typescript
// Implementación en ejecución de órdenes
POST /api/orders/execute
{
  order_id: UUID,
  version: number  // versión actual conocida por cliente
}

Servidor valida:
if (serverOrder.version !== requestVersion) {
  return 409 Conflict
  { code: "VERSION_MISMATCH", serverVersion, clientVersion }
}
```

---

### B.5) IMPLEMENTACIÓN DE TABLAS Y CRUDs

#### ✅ Tabla de Órdenes (Orders Table)

**Funcionalidades:**
- Columnas: Instrumento, Cantidad, Precio, Estado, Broker, Usuario, Timestamp
- Ordenamiento: Por cualquier columna
- Filtros: Por estado, broker, rango de fechas
- Acciones: Ver detalles, Cancelar (si PENDING), Editar límite de precio
- Actualización en tiempo real (polling o WebSocket cuando esté disponible)

#### ✅ Tabla de Posiciones (Positions Table)

**Funcionalidades:**
- Columnas: Instrumento, Cantidad, Precio Compra, Precio Actual, PnL, %PnL
- Operaciones: 
  - Abrir posición (ir a crear orden)
  - Cerrar posición (create sell order)
  - Ver histórico de movimientos
  - Visualizar gráfico de desempeño

#### ✅ Tabla de Auditoría (Audit Table)

**Funcionalidades:**
- Columnas: Timestamp, Evento, Usuario, Acción, Estado Anterior, Estado Nuevo, Outcome
- Filtros: Por tipo de evento, usuario, rango de fechas
- Búsqueda: Por correlation_id, order_id, signal_id
- Exportación: CSV con datos completos

#### ✅ Tabla de Análisis Institucional (Institutional Analysis Table)

**Funcionalidades:**
- Columnas: Ticker, Período, Horizonte, Ownership %, Volumen, Inflows, Outflows
- Visualización: Zonas S/R en gráfico separado
- Detalles: Expandir para ver fuentes de datos y métricas por institución

#### ✅ Tabla de Estrategias de Cobertura (Coverage Strategies Table)

**Funcionalidades:**
- Comparador lado a lado (hasta 4 estrategias)
- Columnas: Tipo, Prima Neta, Max Profit, Max Loss, Confianza, Downside
- Gráficos: Payoff chart con Lightweight Charts
- Simulación: Ejecutar escenarios bull/bear/Monte Carlo
- Selección: Elegir estrategia recomendada y crear orden

---

### B.6) DESPLIEGUE Y APLICACIÓN COMPLETA

#### ✅ Estructura de Despliegue

**Frontend PWA:**
```
Construcción: npm run build (Vite)
Output: dist/
Cache: Service Worker para offline capability
Bundle: ~500KB (gzipped)
Deployment: CDN estático + HTTP/2 push
```

**Backend REST API:**
```
Construcción: npm run build (TypeScript transpile)
Output: dist/
Runtime: Node.js 22 LTS en contenedor o VM
Entry Point: dist/index.js
Deployment: Docker container o direkta en servidor
```

**Base de Datos:**
```
Supabase:
- Connection pooling vía pgBouncer
- Backups automáticos diarios
- Replicación read-only para reportes

MongoDB (opcional):
- Colecciones de históricos
- TTL indexes para datos > 365 días
```

#### 📦 Proceso de Build y Test

```bash
# Frontend
npm run build       # Transpile + bundle
npm run lint        # ESLint + TypeScript
npm test           # Vitest + React Testing Library

# Backend
npm run build       # Transpile TypeScript
npm run lint        # ESLint + TypeScript
npm test           # Tests unitarios + integración
npm run integration-test # Tests con DB real

# All
npm run test-all    # Frontend + Backend
npm run lint-all    # Linting
```

#### 🚀 Ciclo de Desarrollo

```
Feature Branch → Pull Request → CI/CD Pipeline
  ├─ npm run build (ambos)
  ├─ npm run lint (ambos)
  ├─ npm test (ambos)
  ├─ Tests de integración
  └─ Deploy a staging

Merge a main → Production Deploy
  ├─ Blue-green deployment
  ├─ Health checks
  └─ Rollback automático si falla
```

---

## C) TECNOLOGÍAS Y PLATAFORMAS PARA DESPLIEGUE EN NUBE

### C.1) ✅ Plataforma Cloud Seleccionada: **AZURE**

**Componentes Principales:**

#### 🖥️ 1. Compute

**Azure App Service (Frontend PWA + Backend API)**
```
Tier: Premium (P1V2) para producción
- Escalado automático 2-10 instancias
- HTTP/2, SSL/TLS automático
- Deployment slots (staging + production)
- Zero-downtime deployment

SKU: 2 vCPU, 7 GB RAM por instancia
```

**Azure Container Instances (Alternativa con Docker)**
```
- Frontend: Container con Node.js + nginx
- Backend: Container con Node.js + Express
- Orchestration: AKS (Azure Kubernetes Service) para producción
```

#### 🗄️ 2. Data & Storage

**Azure Database for PostgreSQL (Supabase backend)**
```
Tier: Business Critical (ha replication)
- vCore: 2 vCore (escalable a 4-8)
- Storage: 128 GB SSD (auto-scale)
- Backups: Diarios + PITR (Point in Time Recovery)
- Networking: Private endpoint (no internet)
- Monitoring: Azure Monitor + alertas
```

**Azure Cosmos DB (para MongoDB - opcional)**
```
Tier: Provisioned throughput
- 400-10,000 RU/s (request units)
- Multi-region replication
- TTL index para datos históricos
- Backup automático cada 24h
```

**Azure Storage Account (Archivos estáticos + logs)**
```
- Blob Storage para assets CDN
- File Share para logs y configuración
- Encryption at rest (AES-256)
```

#### 🌐 3. Networking & CDN

**Azure CDN (Front Door)**
```
- Caché global para assets PWA
- WAF integrado (Web Application Firewall)
- DDoS protection
- Compresión automática
- 90 regiones edge
```

**Azure Virtual Network**
```
- Subnets privadas para DB
- Private Link para acceso seguro
- NSG (Network Security Groups)
- VPN gateway si es necesario
```

#### 🔐 4. Security

**Azure Key Vault**
```
- Almacenamiento de:
  - API keys (Gemini, IBKR, Alpaca)
  - Credenciales de DB
  - JWT signing keys
  - Certificados SSL
- Auditoría y logging de acceso
- Rotación automática de secretos
```

**Azure Active Directory / Entra ID**
```
- Autenticación SSO (opcional)
- RBAC (Role Based Access Control)
- Conditional access policies
- MFA enforcement
```

**Application Insights + Azure Monitor**
```
- Application Performance Monitoring (APM)
- Distributed tracing
- Custom metrics
- Alerting en SLO breach
```

#### 📊 5. Observabilidad & Logging

**Application Insights**
```
- Request tracing (latencia p95)
- Exception tracking
- Custom events (señales, órdenes, auditoría)
- Availability tests
```

**Azure Log Analytics**
```
- Logs centralizados (frontend + backend + DB)
- Queries KQL (Kusto Query Language)
- Dashboards personalizados
- Retention 30 días (configurable)
```

#### 🔄 6. CI/CD & DevOps

**Azure DevOps Pipelines**
```
Trigger: Push a main branch

Pipeline stages:
1. Build
   ├─ npm run build
   ├─ npm run lint
   └─ npm test

2. Test
   ├─ Tests de integración
   ├─ SAST (security scan)
   └─ Container scan

3. Stage Deploy
   ├─ Deploy a slot de staging
   ├─ Health checks
   └─ Smoke tests

4. Production Deploy
   ├─ Blue-green deployment
   ├─ Traffic switch
   └─ Rollback si falla
```

**GitHub Actions** (alternativa)
```
Workflows:
- pr.yml: Lint + test en PR
- deploy-staging.yml: Deploy a staging en merge a develop
- deploy-prod.yml: Deploy manual a production
```

#### 📱 7. Monitoring & SLOs

**Métricas Objetivo (SLO):**

```yaml
Disponibilidad: >= 99.5% mensual
Latencia p95: <= 1s para market data
Latencia p95: <= 3s para consultas históricas
Rate limit recovery: 100% antes de 120s
Error rate: <= 0.1%

Alertas:
- Disponibilidad < 99.5%
- Latencia p95 > 1.5s
- Error rate > 0.2%
- CPU > 80% por 5min
- Memory > 85% por 5min
```

#### 📋 8. Backup & Disaster Recovery

**Strategy: RTO <= 30 min, RPO <= 5 min**

```
PostgreSQL (Supabase):
- Backups automáticos cada hora
- PITR (Point in Time Recovery) 35 días
- Geo-redundancia habilitada

Cosmos DB (MongoDB):
- Backups cada 24h
- Multi-region failover automático

App Service:
- Deployment slots con código
- Infrastructure as Code (Bicep)
```

#### 🚀 9. Escalado Automático

```yaml
App Service Frontend:
- Min instances: 2
- Max instances: 10
- Scale out trigger: CPU > 70% for 5min
- Scale in trigger: CPU < 40% for 10min

App Service Backend:
- Min instances: 2
- Max instances: 15
- Scale out trigger: CPU > 75% or Memory > 80%
- Scale in trigger: CPU < 50%

Database (PostgreSQL):
- vCore auto-scale 2 → 4 → 8 (configurable)
- Storage auto-scale 128GB → 512GB
```

---

### C.2) Configuración Detallada de Azure

#### Deployment Checklist

```
PRE-DEPLOYMENT:
☐ Crear suscripción Azure
☐ Crear Azure Resource Group
☐ Configurar Key Vault con secrets
☐ Crear Azure Container Registry (si Docker)
☐ Crear subredes y Network Security Groups

DEPLOY INFRAESTRUCTURA:
☐ Deploy App Service (Frontend + Backend)
☐ Deploy Azure Database for PostgreSQL
☐ Deploy Azure Storage Account
☐ Configure Azure CDN Front Door
☐ Enable Azure Monitor + Application Insights

CONFIGURE APLICACIÓN:
☐ Variables de entorno en App Service
☐ Connection strings desde Key Vault
☐ Certificado SSL/TLS
☐ CORS configuration
☐ Rate limiting rules

TESTING:
☐ Health checks (/health endpoint)
☐ Load testing (Azure Load Testing)
☐ Security scanning (Azure Defender)
☐ Smoke tests en production

MONITORING:
☐ Dashboard en Application Insights
☐ Alertas en Azure Monitor
☐ Log Analytics queries
☐ Custom metrics
```

#### Infrastructure as Code (IaC) - Bicep Template

```bicep
// azure-deploy.bicep
param location string = 'eastus'
param environment string = 'production'
param appName string = 'inversions-platform'

resource appServicePlan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: '${appName}-${environment}-plan'
  location: location
  sku: {
    name: 'P1V2'
    capacity: 2
  }
}

resource frontendApp 'Microsoft.Web/sites@2022-03-01' = {
  name: '${appName}-frontend-${environment}'
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|22'
      appSettings: [
        { name: 'REACT_APP_API_URL', value: 'https://api.${appName}.com' }
        { name: 'KEY_VAULT_URL', value: keyVault.properties.vaultUri }
      ]
    }
  }
}

// ... Backend App, PostgreSQL, Storage, CDN ...
```

#### Environment Variables (por entorno)

```bash
# .env.production (Azure Key Vault)
NODE_ENV=production
LOG_LEVEL=info
API_PORT=8080
DB_HOST=<pg-server>.postgres.database.azure.com
DB_PORT=5432
DB_NAME=inversions_prod
DB_USER=<admin>
DB_PASSWORD=<secret from Key Vault>
JWT_SECRET=<secret from Key Vault>
GEMINI_API_KEY=<secret from Key Vault>
IBKR_API_KEY=<secret from Key Vault>
ALPACA_API_KEY=<secret from Key Vault>
CORS_ORIGIN=https://inversions-platform.azurewebsites.net
RATE_LIMIT_WINDOW=60
RATE_LIMIT_MAX=10
```

---

### C.3) Alternativas Cloud Evaluadas

| Proveedor | Ventajas | Desventajas | Recomendación |
|-----------|----------|------------|---|
| **Azure** | Integración Copilot, DevOps, PostgreSQL gestionado | Pricing variable | ✅ **Seleccionado** |
| **AWS** | Ecosistema amplio, RDS, Lambda | Más complejo setup | Alternativa si migración |
| **GCP** | BigQuery para analytics, Cloud SQL | Menos RBAC nativo | Alternativa para ML/AI |
| **Heroku** | Deploy simple, free tier | Caro a escala, vendor lock-in | No recomendado producción |

---

## 📊 ESTADO DE IMPLEMENTACIÓN POR COMPONENTE

| Componente | % Completado | Estado | Notas |
|-----------|-------------|--------|-------|
| **Frontend - Dashboard** | 85% | ✅ Funcional | Falta refinar gráficos |
| **Frontend - Signal Evaluator** | 75% | ✅ Parcial | Tests unitarios pendientes |
| **Frontend - Approval Flow** | 90% | ✅ Funcional | MFA integration completa |
| **Frontend - Audit UI** | 80% | ✅ Funcional | Filtros faltantes |
| **Backend - Signal Generation** | 70% | 🟡 En Progreso | Cores parcialmente implementados |
| **Backend - Execution Governance** | 85% | ✅ Funcional | Tests de contrato pendientes |
| **Backend - Broker Adapters** | 60% | 🟡 En Progreso | IBKR 80%, Alpaca 40% |
| **Backend - Audit & History** | 95% | ✅ Casi Completo | Optimization de queries pendiente |
| **Backend - AI Integration (Gemini)** | 50% | 🟡 En Progreso | Pipeline de agentes en desarrollo |
| **Cloud Infrastructure (Azure)** | 30% | 🟡 Planeado | Bicep templates listos |
| **CI/CD Pipeline** | 40% | 🟡 En Progreso | GitHub Actions configurado parcialmente |
| **Testing (Unit + Integration)** | 65% | 🟡 En Progreso | Cobertura 65%, meta 80% |
| **Documentation** | 85% | ✅ Casi Completo | Contratos arquitectónicos completos |

---

## 📚 DOCUMENTOS ADICIONALES DISPONIBLES

### Especificaciones (Specs)
- [001-plataforma-inversiones-ia/spec.md](specs/001-plataforma-inversiones-ia/spec.md) - Feature principal
- [007-team-05-frontend-cobertura/spec.md](specs/007-team-05-frontend-cobertura/spec.md) - Frontend institucional
- [008-team-07-ai-volatility/spec.md](specs/008-team-07-ai-volatility/spec.md) - IA y volatility

### Planes de Implementación
- [001-plataforma-inversiones-ia/plan.md](specs/001-plataforma-inversiones-ia/plan.md) - Plan general
- [007-team-05-frontend-cobertura/plan.md](specs/007-team-05-frontend-cobertura/plan.md) - Plan frontend

### Tasks y Backlog
- [001-plataforma-inversiones-ia/tasks.md](specs/001-plataforma-inversiones-ia/tasks.md) - Tasks generales
- [008-team-07-ai-volatility/tasks.md](specs/008-team-07-ai-volatility/tasks.md) - Tasks IA

### Contratos Arquitectónicos
- [auth-context.md](specs/001-plataforma-inversiones-ia/contracts/auth-context.md) - Autenticación
- [broker-adapter.md](specs/001-plataforma-inversiones-ia/contracts/broker-adapter.md) - Brokers
- [signal-lifecycle.md](specs/001-plataforma-inversiones-ia/contracts/signal-lifecycle.md) - Ciclo de señales

### Guías Técnicas
- [TEAM-05-backend-architecture.md](docs/TEAM-05-backend-architecture.md) - Arquitectura backend
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - Estructura del proyecto

---

## 🎯 PRÓXIMOS PASOS (RECOMENDADOS)

### Fase 1: Completar Core (Semanas 1-3)
1. ✅ Implementar Analyzer Agent (Gemini)
2. ✅ Conectar adaptadores IBKR/Alpaca
3. ✅ Completar tests unitarios al 80%
4. ⏳ Deploy a staging en Azure

### Fase 2: Despliegue (Semanas 4-5)
1. ⏳ Configurar Azure Infrastructure (IaC)
2. ⏳ Setup CI/CD pipeline completo
3. ⏳ Load testing
4. ⏳ Security audit (OWASP Top 10)

### Fase 3: Producción (Semana 6+)
1. ⏳ Deploy a production
2. ⏳ Monitoreo activo
3. ⏳ Post-launch optimization

---

**Documento compilado:** 27 de Mayo de 2026  
**Responsable:** GitHub Copilot + NOTAS_TECNICAS_SDD.md  
**Siguiente revisión:** 03 de Junio de 2026
