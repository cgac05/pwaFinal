# Tasks - TEAM-07 AI Volatility Analysis
**Equipo:** SixPackDevs  
**Rama:** feature/008-team-07-ai-volatility  
**Total Tasks:** TBD (será generado por /speckit.tasks)

---

---

# GRUPO 1: CORE AI AGENTS (Semana 1-2)

## T151: Setup Entorno Multi-Agente Gemini + Langchain

**Story Points**: 8  
**Prioridad**: P0  
**Asignado a**: Backend  
**Dependencias**: Ninguno  
**Semana**: W1  

### Descripción
Instalar y configurar el SDK de Gemini, Langchain para orquestación de agentes, y establecer los patrones de comunicación entre agentes. Incluye setup de API keys, variables de entorno, gestión de sesiones y mechanism de retry/fallback para garantizar resiliencia. Definir system prompts que produzcan salida textual analítica y de opinión además de datos estructurados.

### Acceptance Criteria
- [ ] SDK Gemini instalado y configurado correctamente
- [ ] Langchain integrado con soporte para multi-agent orchestration
- [ ] System prompts definidos para cada tipo de agente
- [ ] Gemini produce análisis textual de mercado y opinión de trading cuando se solicita
- [ ] Test básico de invocación de agente completado
- [ ] Retry logic con exponential backoff implementado
- [ ] Fallback mechanisms funcionando entre modelos
- [ ] Documentación de configuración lista

### Tareas Técnicas
1. Instalar el SDK oficial de Gemini y langchain en `projects/rest-api/inversions_api`
2. Configurar variables de entorno para API key en `.env.local`
3. Implementar agent factory pattern con parámetros configurables
4. Crear system prompts templates para Analyzer, Strategist, Executor
5. Implementar retry logic con límite de 3 intentos y backoff exponencial
6. Crear fallback mechanism para cambiar modelo si es necesario
7. Escribir tests básicos de agent initialization

### Criterios de Definición de Listo
- Código comentado en TypeScript
- 100% tipado TypeScript (no `any`)
- Tests unitarios >80% coverage
- No warnings de linting (ESLint)
- PR aprobada por otro Backend

### Recursos
- Docs: Gemini API Docs
- Docs: [Langchain JS](https://js.langchain.com)
- Ejemplos: Pattern de retry con exponential backoff en `src/services/agent-service.ts`

---

## T151B: Docker y Dev Containerization

**Story Points**: 5  
**Prioridad**: P0  
**Asignado a**: Backend 1  
**Dependencias**: [T151]  
**Semana**: W1

### Descripción
Configurar la plataforma de desarrollo con Docker, containerización multietapa y un entorno local reproducible. Asegura que el backend y sus dependencias se ejecuten de forma consistente en todos los equipos de desarrollo.

### Acceptance Criteria
- [ ] Dockerfile multistage creado para backend y producción
- [ ] `docker-compose.yml` con servicios de Supabase/PostgreSQL y API local
- [ ] Entorno local reproducible con `docker-compose up`
- [ ] Documentación de comandos de desarrollo y debugging
- [ ] `npm run dev` funciona dentro del contenedor
- [ ] No warnings de linting ni errores TS durante la build dentro del contenedor

### Tareas Técnicas
1. Crear Dockerfile multistage para `projects/rest-api/inversions_api`
2. Crear `docker-compose.yml` con servicios de backend, Supabase y PostgreSQL
3. Configurar volúmenes y env vars en `.env.example`
4. Verificar que `npm run dev` funciona en el contenedor
5. Documentar comandos `docker-compose up`, build y clean
6. Probar en Windows y Linux

### Criterios de Definición de Listo
- Configuración reproducible en un solo comando
- Contenedor arranca sin errores
- No warnings de linting
- PR aprobada

### Recursos
- Docs: Docker multistage builds
- Docs: Docker Compose
- Ejemplos: repositorios Node + Supabase

---

## T152: Implementar Analyzer Agent (Análisis de Mercado)

**Story Points**: 13  
**Prioridad**: P0  
**Asignado a**: Backend  
**Dependencias**: [T151]  
**Semana**: W2  

### Descripción
Desarrollar agente especializado que recibe datos OHLCV históricos, indicadores técnicos y contexto de mercado, luego genera análisis técnico enriquecido. El agente debe procesar 30+ símbolos en paralelo y retornar contexto estructurado junto con un resumen textual de opinión de Gemini en <500ms.

### Acceptance Criteria
- [ ] Analyzer Agent procesa datos OHLCV correctamente
- [ ] Soporta 30+ símbolos simultáneamente
- [ ] Latencia <500ms por símbolo
- [ ] Retorna JSON estructurado y validado
- [ ] Retorna un resumen textual de opinión de Gemini junto al JSON estructurado
- [ ] 100% tipado TypeScript con interfaces definidas
- [ ] Manejo de errores de datos inválidos
- [ ] Tests con datos reales de Alpaca

### Tareas Técnicas
1. Crear interface `IMarketAnalysis` en `src/types/agent.types.ts`
2. Implementar `AnalyzerAgent` en `src/services/agents/analyzer.agent.ts`
3. Integrar carga de datos históricos desde Alpaca API
4. Implementar cálculo de indicadores (RSI, MACD, Bollinger)
5. Crear pipeline de contexto enriquecido
6. Implementar parallelization para múltiples símbolos
7. Escribir tests con datos mock de Alpaca

### Criterios de Definición de Listo
- Código comentado
- 100% tipado TypeScript
- Tests >80% coverage de casos principales
- No warnings de linting
- PR aprobada

### Recursos
- Docs: [Alpaca Data API](https://docs.alpaca.markets/api-references/market-data-api)
- Ejemplos: `src/services/market-data/alpaca-connector.ts`

---

## T153: Implementar Strategist Agent (Selección de Estrategia)

**Story Points**: 13  
**Prioridad**: P0  
**Asignado a**: Backend  
**Dependencias**: [T152]  
**Semana**: W2-W3  

### Descripción
Desarrollar agente que recibe análisis de mercado del Analyzer Agent, toma decisión sobre estrategia (Straddle vs Strangle), calcula parámetros óptimos (strikes, expiration, size). Debe generar recomendaciones en <300ms con ratios riesgo/beneficio claramente definidos.

### Acceptance Criteria
- [ ] Strategist Agent recibe input del Analyzer correctamente
- [ ] Recomendaciones generadas en <300ms
- [ ] Decisión de estrategia (Straddle/Strangle) bien fundada
- [ ] Parámetros de riesgo/beneficio calculados
- [ ] Ratios de probabilidad incluidos
- [ ] Recomendación de tamaño de posición
- [ ] Tests con escenarios de mercado variados

### Tareas Técnicas
1. Crear interface `IStrategyRecommendation` con campos de decisión
2. Implementar `StrategistAgent` en `src/services/agents/strategist.agent.ts`
3. Implementar decision tree para seleccionar estrategia
4. Integrar historical backtesting comparison
5. Implementar parameter optimization basado en volatilidad
6. Calcular Greeks (delta, gamma, vega, theta)
7. Escribir tests con datos reales de volatilidad

### Criterios de Definición de Listo
- Código comentado
- 100% tipado TypeScript
- Tests >80% coverage
- No warnings de linting
- PR aprobada

### Recursos
- Docs: [Options Greeks](https://en.wikipedia.org/wiki/Greeks_(finance))
- Ejemplos: `src/services/strategies/greeks-calculator.ts`

---

## T154: Implementar Executor Agent (Ejecución de Órdenes)

**Story Points**: 13  
**Prioridad**: P0  
**Asignado a**: Backend  
**Dependencias**: [T153, T157]  
**Semana**: W3  

### Descripción
Desarrollar agente ejecutor que recibe estrategia validada del Strategist, envía órdenes a brokers (IBKR/Alpaca), confirma ejecución, registra en base de datos. Debe incluir circuit breaker, validación pre-trade y un control explícito de aprobación humana antes de ejecutar órdenes reales.

### Acceptance Criteria
- [ ] Órdenes enviadas correctamente a brokers
- [ ] Confirmación de ejecución recibida y validada
- [ ] Logs de auditoría completos para cada orden
- [ ] Circuit breaker activo (detiene si hay excesivos fallos)
- [ ] Pre-trade validation antes de enviar
- [ ] Aprobación humana requerida antes de ejecutar la orden en producción
- [ ] Manejo de rechazos de orden
- [ ] Tests end-to-end con mock broker

### Tareas Técnicas
1. Crear interface `IOrderExecution` con campos de auditoría
2. Implementar `ExecutorAgent` en `src/services/agents/executor.agent.ts`
3. Implementar pre-trade validation checks
4. Implementar gate de aprobación humana antes de ejecución real
5. Integrar con broker adapters (T157)
6. Implementar circuit breaker pattern
7. Crear audit logging con timestamp y usuario
8. Implementar retry logic con degraded mode

### Criterios de Definición de Listo
- Código comentado
- 100% tipado TypeScript
- Tests >80% coverage
- No warnings de linting
- PR aprobada

### Recursos
- Docs: Circuit Breaker Pattern
- Ejemplos: `src/services/execution/circuit-breaker.ts`

---

# GRUPO 2: ESTRATEGIAS (Semana 2-4)

## T155: Implementar Estrategia Straddle

**Story Points**: 8  
**Prioridad**: P0  
**Asignado a**: Backend  
**Dependencias**: [T151]  
**Semana**: W2  

### Descripción
Implementar lógica de Long Straddle: compra simultánea de Call y Put con mismo strike y fecha de expiración. Incluye cálculo de payoff, Greeks (delta, gamma, vega, theta) y análisis de sensibilidad.

### Acceptance Criteria
- [ ] Estrategia calcula strike óptimo
- [ ] Payoff calculado correctamente en todos los precios
- [ ] Greeks calculados con precisión (Black-Scholes)
- [ ] Máximo beneficio/pérdida definidos
- [ ] Break-even points identificados
- [ ] Tests con opciones reales del mercado

### Tareas Técnicas
1. Crear interfaz `IStraddle` con parámetros
2. Implementar cálculo de strike (ATM típicamente)
3. Implementar Black-Scholes para Greeks
4. Calcular payoff profile en rango de precios
5. Implementar Greeks sensitivity analysis
6. Crear visualización de payoff diagram
7. Tests con datos de opciones reales

### Criterios de Definición de Listo
- Código comentado
- 100% tipado TypeScript
- Tests >80% coverage
- No warnings de linting
- PR aprobada

### Recursos
- Docs: [Black-Scholes Model](https://en.wikipedia.org/wiki/Black%E2%80%93Scholes_model)
- Ejemplos: `src/services/strategies/option-pricing.ts`

---

## T156: Implementar Estrategia Strangle

**Story Points**: 8  
**Prioridad**: P0  
**Asignado a**: Backend  
**Dependencias**: [T155]  
**Semana**: W3  

### Descripción
Implementar lógica de Long Strangle: compra de Call con strike alto + Put con strike bajo, misma fecha. Menos costoso que Straddle pero requiere mayor movimiento. Incluye optimización de strikes y análisis de rentabilidad.

### Acceptance Criteria
- [ ] Estrategia selecciona strikes óptimos (call alto, put bajo)
- [ ] Parámetros de riesgo/beneficio calculados
- [ ] Costo inicial es menor que Straddle
- [ ] Break-even points identificados
- [ ] Comparativa con Straddle incluida
- [ ] Tests con datos reales

### Tareas Técnicas
1. Crear interfaz `IStrangle` con parámetros
2. Implementar algoritmo de selección de strikes
3. Calcular payoff profile asimétrico
4. Implementar Greeks para Strangle
5. Crear comparativa automática Straddle vs Strangle
6. Implementar cálculo de rentabilidad esperada
7. Tests con volatilidades variadas

### Criterios de Definición de Listo
- Código comentado
- 100% tipado TypeScript
- Tests >80% coverage
- No warnings de linting
- PR aprobada

### Recursos
- Docs: [Option Strategies](https://www.investopedia.com/articles/active-trading/091015/strangle-and-straddle.asp)

---

## T157: Adaptadores Broker (IBKR + Alpaca)

**Story Points**: 13  
**Prioridad**: P0  
**Asignado a**: Backend  
**Dependencias**: [T151]  
**Semana**: W2-W3  

### Descripción
Implementar adaptadores para Interactive Brokers (IBKR) y Alpaca que manejen órdenes de opciones, confirmación de ejecución, consulta de posiciones y manejo de errores. Incluye fallback automático entre brokers.

### Acceptance Criteria
- [ ] IBKR API/Gateway integrado correctamente
- [ ] Alpaca SDK integrado para opciones
- [ ] Órdenes enviadas con confirmación
- [ ] Fallback automático entre brokers funciona
- [ ] Health checks periódicos implementados
- [ ] Manejo de desconexiones y reconexión
- [ ] Tests con mock brokers

### Tareas Técnicas
1. Instalar adaptador Node.js para IBKR en `projects/rest-api/inversions_api` (por ejemplo `ib` o `ibkr-api`)
2. Instalar cliente Node.js de Alpaca en `projects/rest-api/inversions_api` (por ejemplo `@alpacahq/alpaca-trade-api`)
3. Crear adapter interface abstracto `IBrokerAdapter`
4. Implementar `IBKRAdapter` con IB Gateway usando la librería Node.js seleccionada
5. Implementar `AlpacaAdapter` con el SDK Node.js de Alpaca
6. Implementar broker health check mechanism
7. Crear fallback routing logic
8. Tests con conexiones mock

### Criterios de Definición de Listo
- Código comentado
- 100% tipado TypeScript
- Tests >80% coverage
- No warnings de linting
- PR aprobada

### Recursos
- Docs: [IBKR API](https://interactivebrokers.com/en/index.php?f=14&p=api)
- Docs: [Alpaca Trading API](https://alpaca.markets/docs/api-references/trading-api/)

---

## T158: Backtesting Framework

**Story Points**: 8  
**Prioridad**: P1  
**Asignado a**: Backend  
**Dependencias**: [T155, T156]  
**Semana**: W4  

### Descripción
Desarrollar framework de backtesting que simule estrategias (Straddle/Strangle) sobre datos históricos de 2 años. Calcula métricas clave: Sharpe Ratio, Win Rate, Max Drawdown, Profit Factor.

### Acceptance Criteria
- [ ] Carga datos históricos de 2 años
- [ ] Simula Straddle correctamente
- [ ] Simula Strangle correctamente
- [ ] Calcula Sharpe Ratio con precisión
- [ ] Calcula Win Rate
- [ ] Genera reporte con gráficos
- [ ] Ejecuta en <5 min para 2 años de datos

### Tareas Técnicas
1. Crear interfaz `IBacktestResult` con métricas
2. Implementar historical data loader desde Alpaca
3. Implementar trade simulator
4. Calcular Sharpe, Win Rate, Max Drawdown
5. Crear Profit & Loss tracker
6. Generar report en JSON
7. Tests con múltiples símbolos

### Criterios de Definición de Listo
- Código comentado
- 100% tipado TypeScript
- Tests >80% coverage
- No warnings de linting
- PR aprobada

### Recursos
- Docs: [Backtesting Metrics](https://www.investopedia.com/terms/b/backtesting.asp)

---

# GRUPO 3: ANÁLISIS TÉCNICO (Semana 4-5)

## T159: Indicadores Técnicos (RSI, MACD, Bollinger)

**Story Points**: 13  
**Prioridad**: P0  
**Asignado a**: Backend  
**Dependencias**: [T151]  
**Semana**: W4  

### Descripción
Implementar biblioteca de indicadores técnicos: RSI(14), MACD(12,26,9), Bandas de Bollinger(20,2). Incluye cálculo eficiente, caching de resultados y latencia <100ms para 30+ símbolos.

### Acceptance Criteria
- [ ] RSI(14) calculado correctamente
- [ ] MACD(12,26,9) con signal line
- [ ] Bandas de Bollinger(20,2) precisas
- [ ] Latencia <100ms para 30+ símbolos
- [ ] Resultados cacheados eficientemente
- [ ] Manejo de datos insuficientes (< periodo)
- [ ] Tests con datos conocidos

### Tareas Técnicas
1. Crear helpers de cálculo en `src/services/technical-analysis/indicators.ts`
2. Implementar RSI calculation (14 periods)
3. Implementar MACD calculation
4. Implementar Bollinger Bands calculation
5. Crear caching layer con TTL
6. Optimizar para procesamiento de 30+ símbolos
7. Tests con valores comparados a TradingView

### Criterios de Definición de Listo
- Código comentado
- 100% tipado TypeScript
- Tests >80% coverage
- No warnings de linting
- PR aprobada

### Recursos
- Docs: [TA-Lib](https://github.com/nkeller1/ta-lib-python)
- Ejemplos: Manual calculation en `src/services/technical-analysis/`

---

## T160: Volatilidad (IV/HV Ratio)

**Story Points**: 8  
**Prioridad**: P0  
**Asignado a**: Backend  
**Dependencias**: [T159]  
**Semana**: W4  

### Descripción
Calcular volatilidad implícita (IV) desde precios de opciones y volatilidad histórica (HV) desde precios históricos. Comparar ratio IV/HV para identificar oportunidades de trading.

### Acceptance Criteria
- [ ] IV calculada desde precios de opciones broker
- [ ] Diferencia con IV del broker <0.5%
- [ ] HV(20,30,60 days) preciso
- [ ] Ratio IV/HV calculado
- [ ] Señal cuando IV > HV (premium alto)
- [ ] Tests con volatilidades conocidas

### Tareas Técnicas
1. Implementar IV calculation (Newton-Raphson method)
2. Implementar HV calculation (rolling std dev)
3. Crear comparativa IV vs broker IV
4. Calcular ratio y generar señal
5. Crear time-series de ratios históricos
6. Caching de IVs calculadas
7. Tests con datos reales de opciones

### Criterios de Definición de Listo
- Código comentado
- 100% tipado TypeScript
- Tests >80% coverage
- No warnings de linting
- PR aprobada

### Recursos
- Docs: [Implied Volatility](https://www.investopedia.com/terms/i/iv.asp)

---

## T161: Detección de Patrones

**Story Points**: 8  
**Prioridad**: P1  
**Asignado a**: Backend  
**Dependencias**: [T159]  
**Semana**: W5  

### Descripción
Detectar patrones técnicos: breakouts, support/resistance levels, trend changes. Incluye validación de patrones con >70% accuracy vs revisión manual.

### Acceptance Criteria
- [ ] Breakouts detectados correctamente
- [ ] Support/Resistance identificados
- [ ] Trend changes reconocidos
- [ ] Accuracy >70% vs revisión manual
- [ ] Múltiples timeframes soportados
- [ ] Alertas generadas por patrón
- [ ] Tests con gráficos reales

### Tareas Técnicas
1. Implementar breakout detection
2. Implementar support/resistance finder
3. Implementar trend analyzer
4. Crear patrón validator
5. Implementar multi-timeframe analysis
6. Crear alert system
7. Tests con datos reales

### Criterios de Definición de Listo
- Código comentado
- 100% tipado TypeScript
- Tests >80% coverage
- No warnings de linting
- PR aprobada

### Recursos
- Docs: [Technical Analysis Patterns](https://www.investopedia.com/terms/t/technicalanalysis.asp)

---

## T162: Motor de Señales

**Story Points**: 13  
**Prioridad**: P0  
**Asignado a**: Backend  
**Dependencias**: [T159, T160, T161]  
**Semana**: W5  

### Descripción
Agregador que combina todos los indicadores (RSI, MACD, BB, volatilidad, patrones) y genera señales BUY/SELL/HOLD ponderadas. Incluye umbral configurable y confidence score.

### Acceptance Criteria
- [ ] Señal generada en <500ms
- [ ] Ponderación correcta de indicadores
- [ ] Confidence score incluido (0-100)
- [ ] Umbral configurable por usuario
- [ ] Histórico de señales guardado
- [ ] Backtesting de signals implementado
- [ ] Tests con escenarios múltiples

### Tareas Técnicas
1. Crear interfaz `ISignal` con confidence
2. Implementar signal aggregator en `src/services/technical-analysis/signal-engine.ts`
3. Implementar weighting algorithm
4. Implementar confidence calculation
5. Crear threshold configurator
6. Guardar histórico de señales
7. Implementar signal backtester
8. Tests con múltiples mercados

### Criterios de Definición de Listo
- Código comentado
- 100% tipado TypeScript
- Tests >80% coverage
- No warnings de linting
- PR aprobada

### Recursos
- Docs: Signal analysis frameworks

---

# GRUPO 4: HISTORIAL OPERACIONAL (Semana 6)

## T163: Modelo de Datos Trades

**Story Points**: 5  
**Prioridad**: P0  
**Asignado a**: Backend  
**Dependencias**: [T154]  
**Semana**: W6  

### Descripción
Diseñar e implementar schema de datos para operaciones en Supabase (PostgreSQL) y MongoDB. Incluye trades, executions, position tracking con políticas RLS para seguridad.

### Acceptance Criteria
- [ ] Schema Supabase creado con migrations
- [ ] Tabla trades con todos los campos necesarios
- [ ] Tabla executions para confirmaciones
- [ ] RLS policies implementadas
- [ ] Índices en queries frecuentes (<100ms)
- [ ] Schema MongoDB definido si aplica
- [ ] Documentación del modelo

### Tareas Técnicas
1. Crear migration Supabase para tabla trades
2. Crear migration para tabla executions
3. Implementar RLS policies en Supabase
4. Crear índices en columns frecuentes
5. Definir schema MongoDB (si aplica)
6. Crear interfaces TypeScript para modelos
7. Tests de migrations

### Criterios de Definición de Listo
- Código comentado
- 100% tipado TypeScript
- Tests >80% coverage
- No warnings de linting
- PR aprobada

### Recursos
- Docs: [Supabase RLS](https://supabase.com/docs/learn/auth-deep-dive/row-level-security)

---

## T164: Logging de Operaciones

**Story Points**: 8  
**Prioridad**: P0  
**Asignado a**: Backend  
**Dependencias**: [T163]  
**Semana**: W6  

### Descripción
Implementar audit trail completo: quién, qué, cuándo, por qué, resultado. Cada trade registrado con contexto completo (user, agent, strategy, parámetros). Búsqueda eficiente de eventos.

### Acceptance Criteria
- [ ] Cada trade registrado con contexto completo
- [ ] User ID asociado
- [ ] Agent name y versión
- [ ] Strategy + parámetros guardados
- [ ] Timestamp y resultado
- [ ] Búsqueda by user/trade/date funciona
- [ ] Tests de auditoria

### Tareas Técnicas
1. Crear tabla audit_log en Supabase
2. Implementar audit logger en `src/services/logging/audit.service.ts`
3. Integrar con todas las transacciones de trade
4. Implementar structured logging (JSON)
5. Crear búsqueda eficiente de logs
6. Implementar compliance format export
7. Tests con múltiples escenarios

### Criterios de Definición de Listo
- Código comentado
- 100% tipado TypeScript
- Tests >80% coverage
- No warnings de linting
- PR aprobada

### Recursos
- Docs: Event sourcing pattern

---

## T165: Dashboard Histórico (Backend API)

**Story Points**: 8  
**Prioridad**: P0  
**Asignado a**: Backend  
**Dependencias**: [T163, T164]  
**Semana**: W6  

### Descripción
Crear API endpoints para recuperar trades históricos, P&L acumulado, métricas de performance. Incluye paginación, filtros avanzados (date, strategy, symbol) y agregación rápida.

### Acceptance Criteria
- [ ] Endpoint GET /trades?user_id&limit&offset
- [ ] Respuesta paginada en <1s
- [ ] Filtros: date range, strategy, symbol
- [ ] Endpoint GET /trades/metrics agregado
- [ ] P&L diario/mensual/anual
- [ ] Win rate, avg trade duration
- [ ] Tests con datos reales

### Tareas Técnicas
1. Crear endpoint GET /trades con paginación
2. Implementar filtros en query
3. Crear aggregation pipeline en Supabase
4. Implementar caching de resultados
5. Crear endpoint GET /trades/metrics
6. Calcular P&L acumulado
7. Tests con queries pesadas

### Criterios de Definición de Listo
- Código comentado
- 100% tipado TypeScript
- Tests >80% coverage
- No warnings de linting
- PR aprobada

### Recursos
- Docs: [Supabase Aggregation](https://supabase.com/docs)

---

## T166: Exportación de Datos

**Story Points**: 5  
**Prioridad**: P1  
**Asignado a**: Backend  
**Dependencias**: [T163]  
**Semana**: W6  

### Descripción
Implementar exportación de trades a CSV y PDF. CSV validable en Excel con headers claros. PDF con gráficos de P&L y estadísticas. Sync opcional a MongoDB para histórico.

### Acceptance Criteria
- [ ] CSV exportable y abierto en Excel
- [ ] Headers con nombres claros
- [ ] PDF con gráficos de P&L
- [ ] Estadísticas en PDF
- [ ] Sync a MongoDB opcional
- [ ] Async export para grandes datasets
- [ ] Tests con múltiples formatos

### Tareas Técnicas
1. Implementar CSV export en `src/services/export/csv-export.service.ts`
2. Usar librería csv-writer
3. Implementar PDF export con pdfkit
4. Crear charts en PDF (recharts server-side)
5. Implementar MongoDB sync opcional
6. Crear async job for large exports
7. Tests de exportación

### Criterios de Definición de Listo
- Código comentado
- 100% tipado TypeScript
- Tests >80% coverage
- No warnings de linting
- PR aprobada

### Recursos
- Docs: [pdfkit](http://pdfkit.org/), [csv-writer](https://www.npmjs.com/package/csv-writer)

---

# GRUPO 5: FRONTEND & UI (Semana 7-8)

## T167: Componentes React Estrategias

**Story Points**: 13  
**Prioridad**: P0  
**Asignado a**: Frontend  
**Dependencias**: [T155, T156]  
**Semana**: W7  

### Descripción
Desarrollar componentes React tipados para seleccionar estrategia (Straddle/Strangle), ingresar parámetros (symbol, expiration, size). Incluye validación de inputs con Zod y presets predefinidos.

### Acceptance Criteria
- [ ] Componente tipado StrategySelector
- [ ] Componente ParameterForm con validación
- [ ] Validación con Zod en tiempo real
- [ ] Presets predefinidos disponibles
- [ ] Feedback visual de validación
- [ ] Integración con Zustand store
- [ ] Tests de componentes

### Tareas Técnicas
1. Crear componente `StrategySelector` en `src/components/strategies/`
2. Crear componente `ParameterForm`
3. Crear Zod schemas para validación
4. Implementar form validation
5. Crear presets manager
6. Integrar con Zustand store
7. Tests con React Testing Library
8. Storybook stories si aplica

### Criterios de Definición de Listo
- Código comentado
- 100% tipado TypeScript
- Tests >80% coverage
- No warnings de linting
- PR aprobada

### Recursos
- Docs: [React 18](https://react.dev), [Zod](https://zod.dev), [Zustand](https://github.com/pmndrs/zustand)

---

## T168: Charts TradingView + Visualización

**Story Points**: 8  
**Prioridad**: P0  
**Asignado a**: Frontend  
**Dependencias**: [T159]  
**Semana**: W7-W8  

### Descripción
Integrar TradingView Lightweight Charts con indicadores técnicos y overlay de estrategia. Incluir un panel de resumen textual que muestre análisis y recomendaciones de Gemini junto al gráfico. Incluye precio en tiempo real, indicadores, zoom/pan fluido, <500ms de render.

### Acceptance Criteria
- [ ] Gráfico con precios OHLCV
- [ ] Indicadores superpuestos (RSI, MACD, BB)
- [ ] Overlay de estrategia (strikes, payoff)
- [ ] Panel de resumen textual con análisis de Gemini
- [ ] Zoom y pan fluido
- [ ] Render <500ms
- [ ] Responsive en mobile
- [ ] Tests de visualización

### Tareas Técnicas
1. Instalar lightweight-charts en `projects/pwa/inversions_app`
2. Crear componente Chart wrapper
3. Integrar OHLCV data binding en tiempo real
4. Implementar indicator overlays
5. Implementar strategy payoff diagram
6. Implementar panel textual de análisis y recomendaciones de Gemini
7. Optimizar rendering con memoization
8. Tests de charts

### Criterios de Definición de Listo
- Código comentado
- 100% tipado TypeScript
- Tests >80% coverage
- No warnings de linting
- PR aprobada

### Recursos
- Docs: [TradingView Lightweight Charts](https://tradingview.github.io/lightweight-charts/)

---

## T169: Tabla Histórico + P&L Dashboard

**Story Points**: 8  
**Prioridad**: P0  
**Asignado a**: Frontend  
**Dependencias**: [T165]  
**Semana**: W8  

### Descripción
Desarrollar tabla de trades históricos con sorteo/filtrado, gráfico de P&L acumulado y métricas de performance. Incluye virtualization para grandes datasets y exportación a CSV/PDF.

### Acceptance Criteria
- [ ] Tabla de trades con sorteo
- [ ] Filtros por date, strategy, symbol
- [ ] Gráfico de P&L acumulado
- [ ] Métricas: Win rate, Sharpe, Max DD
- [ ] Virtualized rendering para 1000+ trades
- [ ] Botón exportar CSV/PDF
- [ ] Tests de tabla y filtros

### Tareas Técnicas
1. Crear componente `TradesTable` con virtualization
2. Integrar con endpoint GET /trades
3. Implementar sorting y filtering
4. Crear componente P&L Chart
5. Implementar metrics display
6. Crear export buttons
7. Tests con datos reales
8. Storybook stories

### Criterios de Definición de Listo
- Código comentado
- 100% tipado TypeScript
- Tests >80% coverage
- No warnings de linting
- PR aprobada

### Recursos
- Docs: [React-window](https://github.com/bvaughn/react-window), [Recharts](https://recharts.org)

---

# GRUPO 6: TESTING & DOCUMENTACIÓN (Semana 9)

## T170: Tests Completos (Unit/Integration/E2E)

**Story Points**: 13  
**Prioridad**: P0  
**Asignado a**: Backend + Frontend  
**Dependencias**: [T151-T169]  
**Semana**: W9  

### Descripción
Implementar cobertura completa: unit tests (Jest BE, Vitest FE), integration tests (críticos), E2E tests (Playwright) para flujo completo. Cobertura >85%, CI/CD pipeline verde.

### Acceptance Criteria
- [ ] 100% de critical paths testeados
- [ ] Coverage >85% en general
- [ ] Unit tests: RSI, MACD, Greeks correctos
- [ ] Integration: Analyzer→Strategist→Executor flujo
- [ ] E2E: Usuario crea trade, ve en histórico
- [ ] CI/CD pipeline verde
- [ ] No manual bugs encontrados en UAT

### Tareas Técnicas
1. Backend unit tests: `tests/unit/services/*.test.ts`
2. Backend integration tests: `tests/integration/agents/*.test.ts`
3. Frontend unit tests: `tests/unit/components/*.test.tsx`
4. Frontend integration tests: `tests/integration/pages/*.test.tsx`
5. E2E tests: `tests/e2e/*.spec.ts` con Playwright
6. Coverage report generation
7. CI/CD GitHub Actions setup
8. Performance test baselines

### Criterios de Definición de Listo
- Código comentado
- 100% tipado TypeScript
- Tests >85% coverage final
- CI/CD verde
- No warnings de linting
- PR aprobada

### Recursos
- Docs: [Jest](https://jestjs.io), [Vitest](https://vitest.dev), [Playwright](https://playwright.dev)

---

## T171: Performance & Load Testing - 1000 órdenes/día

**Story Points**: 8  
**Prioridad**: P0  
**Asignado a**: Backend 2 + QA  
**Dependencias**: [T154, T157, T158, T163, T164, T170]  
**Semana**: W9  

### Descripción
Diseñar y ejecutar pruebas de performance/carga para validar que el sistema soporta al menos **1000 órdenes/día** en condiciones realistas. Incluye pruebas de órdenes, persistencia y auditoría bajo carga, así como análisis de latencia y fallos controlados.

### Acceptance Criteria
- [ ] Carga sostenida de 1000 órdenes procesadas en 24 horas sin pérdida de datos
- [ ] Latencia promedio de orden < 2s y p95 < 5s para creación/registro de órdenes
- [ ] No más del 1% de errores de orden en el flujo simulado
- [ ] Auditoría y trade persistence mantienen integridad bajo carga
- [ ] Resultados documentados en reporte de performance
- [ ] Conclusiones y ajustes de capacidad registrados en runbook

### Tareas Técnicas
1. Definir escenario de carga simulado: 1000 órdenes/día con mix de Straddle/Strangle
2. Implementar pruebas de carga con k6 o Artillery contra API de ordenes y webhook de confirmación
3. Simular broker responses y fallback entre IBKR/Alpaca bajo carga
4. Monitorear métricas: throughput, latencia, error rate, CPU, memoria, DB connections
5. Validar persistencia de todas las órdenes y logs en Supabase/audit_log
6. Generar reporte de resultados y recomendaciones de tuning
7. Ajustar configuraciones de pool, rate limits y timeouts según hallazgos

### Criterios de Definición de Listo
- Pruebas ejecutables desde CI y localmente
- Reporte de performance completo entregado
- Recomendaciones de tuning incorporadas en runbook
- PR aprobada

### Recursos
- Docs: k6, Artillery, Node.js performance testing
- Ejemplos: load tests en Node.js + Supabase

---

## T172: Integration Tests - Broker Adapters & Persistence

**Story Points**: 8  
**Prioridad**: P0  
**Asignado a**: Backend 1 + 2  
**Dependencias**: [T154, T157, T163, T164]  
**Semana**: W9  

### Descripción
Diseñar y ejecutar pruebas de integración que validen la comunicación completa entre Analyzer, Strategist, Executor y los adaptadores de brokers. Asegura que los datos se persistan correctamente y que el flujo de órdenes respete los estados esperados.

### Acceptance Criteria
- [ ] Flujo Analyzer → Strategist → Executor integrado sin fallos
- [ ] Adaptadores IBKR y Alpaca procesan órdenes simuladas correctamente
- [ ] Trade persistence y audit logs se generan correctamente
- [ ] Todos los estados de orden (pending, submitted, filled, canceled) son manejados
- [ ] Reporte de cobertura de integración generado
- [ ] Tests ejecutan en CI sin fallos

### Tareas Técnicas
1. Configurar entorno de integración con mock brokers
2. Crear pruebas de integración para `ExecutorAgent` y adaptadores
3. Validar persistencia de órdenes y logs en Supabase
4. Verificar state transitions completas
5. Documentar escenarios de integración
6. Ejecutar pruebas en CI pipeline

### Criterios de Definición de Listo
- Tests pasan en CI
- Cobertura de integración documentada
- PR aprobada

### Recursos
- Docs: Jest integration testing, Supabase integration patterns
- Ejemplos: integration tests for backend workflows

---

## T173: E2E Tests - Full Workflow Validation

**Story Points**: 8  
**Prioridad**: P0  
**Asignado a**: Frontend + Backend  
**Dependencias**: [T152, T153, T154, T157, T165]  
**Semana**: W9  

### Descripción
Implementar pruebas end-to-end que cubran la experiencia completa del usuario desde la selección de estrategia hasta la confirmación de orden y visualización en el dashboard histórico.

### Acceptance Criteria
- [ ] Flujo de la UI al backend completo validado
- [ ] Orden generada desde la interfaz aparece en el histórico
- [ ] Mensajes de error y validación se muestran correctamente
- [ ] Rendimiento básico en escenarios happy path y edge cases
- [ ] Tests ejecutan en Playwright en CI

### Tareas Técnicas
1. Definir escenarios E2E principales
2. Implementar scripts Playwright para el flujo completo
3. Validar integración UI → API → persistence
4. Verificar manejo de errores en UI
5. Registrar resultados de E2E en CI
6. Refinar tests según hallazgos

### Criterios de Definición de Listo
- E2E passing en CI
- Escenarios documentados
- PR aprobada

### Recursos
- Docs: Playwright E2E tests
- Ejemplos: full-stack workflow tests

---

## T174: API & Architecture Documentation

**Story Points**: 5  
**Prioridad**: P1  
**Asignado a**: Lead + Backend 1  
**Dependencias**: [T165, T166, T170]  
**Semana**: W9  

### Descripción
Generar la documentación técnica necesaria para la API, la arquitectura del sistema y el runbook de despliegue. Incluye OpenAPI, ADRs, y guías de troubleshooting.

### Acceptance Criteria
- [ ] OpenAPI spec actualizada
- [ ] ADRs de arquitectura completados
- [ ] Runbook de despliegue listo
- [ ] Troubleshooting guide para errores comunes
- [ ] Documentación disponible en repo `/docs`

### Tareas Técnicas
1. Generar OpenAPI spec para endpoints clave
2. Escribir ADRs de decisiones técnicas
3. Crear runbook de despliegue y rollback
4. Documentar configuración de Docker y env vars
5. Crear guías de troubleshooting
6. Revisar documentación en PR

### Criterios de Definición de Listo
- Docs revisadas y aprobadas
- PR aprobada

### Recursos
- Docs: OpenAPI, ADR templates
- Ejemplos: backend documentation patterns

---

# DEPENDENCIAS Y FLUJO

```
FASE 1 (W1):
  ├─ T151: Setup Gemini + Langchain
  ├─ T151B: Docker y Dev Containerization
  └─ T157: Adaptadores Broker

FASE 2 (W2-W3):
  ├─ T152: Analyzer Agent (depend: T151)
  ├─ T153: Strategist Agent (depend: T152)
  ├─ T154: Executor Agent (depend: T153, T157)
  ├─ T155: Straddle Strategy (depend: T151)
  └─ T156: Strangle Strategy (depend: T155)

FASE 3 (W4-W5):
  ├─ T158: Backtesting (depend: T155, T156)
  ├─ T159: Indicadores Técnicos (depend: T151)
  ├─ T160: Volatilidad (depend: T159)
  ├─ T161: Patrones (depend: T159)
  └─ T162: Motor de Señales (depend: T159, T160, T161)

FASE 4 (W6):
  ├─ T163: Modelo de Datos (depend: T154)
  ├─ T164: Audit Logging (depend: T163)
  ├─ T165: Dashboard API (depend: T163, T164)
  └─ T166: Exportación (depend: T163)

FASE 5 (W7-W8):
  ├─ T167: Componentes React (depend: T155, T156)
  ├─ T168: Charts (depend: T159)
  └─ T169: Tabla Histórico (depend: T165)

FASE 6 (W9):
  ├─ T170: Tests Completos (depend: T151-T169)
  ├─ T171: Performance & Load Testing - 1000 órdenes/día (depend: T154, T157, T158, T163, T164, T170)
  ├─ T172: Integration Tests - Broker Adapters & Persistence (depend: T154, T157, T163, T164)
  ├─ T173: E2E Tests - Full Workflow Validation (depend: T152, T153, T154, T157, T165)
  └─ T174: API & Architecture Documentation (depend: T165, T166, T170)
```

---

## EJECUCIÓN EN PARALELO POR FASE

### Fase 2 (W2-W3) - Paralelo
- [ ] T152 + T155 (Analyzer + Straddle) - diferentes equipos
- [ ] T153 + T156 (Strategist + Strangle) - diferentes equipos
- [ ] T154 paralelo después de T157

### Fase 3 (W4-W5) - Paralelo
- [ ] T159 (Indicadores) en paralelo
- [ ] T158 (Backtesting) puede empezar cuando T155/T156 listas
- [ ] T160/T161/T162 pueden ser parcialmente paralelo con T159

### Fase 5 (W7-W8) - Paralelo
- [ ] T167 (React) + T168 (Charts) + T169 (Tabla) en paralelo

---

## NOTAS FINALES

- **Story Points**: Fibonacci 5, 8, 13 basado en complejidad
- **Prioridad**: P0 = blocker, P1 = nice-to-have
- **Dependencias**: Respetadas en plan de ejecución
- **DoD Universal**: TypeScript 100%, ESLint 0 warnings, PR reviewed, >80% tests
- **Recursos**: Todos en `projects/rest-api/inversions_api` (BE) y `projects/pwa/inversions_app` (FE)
