# Especificacion de Funcionalidad: Estrategias Complejas de Opciones TEAM-08 GlassCoke

**Feature Branch**: `009-team-08-estrategias-complejas`
**Created**: 2026-05-21
**Status**: Active
**Input**: Especificacion canonica en `.drfic/diana-sdk/projects/diana-inversions/initiatives/001-inversions/teams/TEAM-08/spec.md`

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Modelar y simular estrategia compleja de opciones (Priority: P1)

Como operador humano, necesito modelar estrategias complejas de opciones (Iron Condor, Iron Butterfly, Butterfly Spread, Condor) con inputs reales de mercado y visualizar escenarios de riesgo/recompensa antes de considerar una operacion, para tomar decisiones informadas sin ejecutar sin aprobacion humana.

**Why this priority**: Es el core del equipo — sin el modelado de estrategias no existe base para analisis, simulacion ni decision.

**Independent Test**: Se valida de forma independiente cuando un operador puede modelar una estrategia compleja (ej: Iron Condor short con strikes 100/105/110/115 en SPX), obtener perfiles de payoff, break-evens, credito/debito neto y perdida/ganancia maxima, sin depender de otras historias.

**Acceptance Scenarios**:

1. **Given** que existen datos de mercado (prima, strike, expiracion, IV) para las 4 patas de una estrategia, **When** el operador configura una Iron Condor short con strikes delta-equilibrados, **Then** el sistema retorna credito neto, break-evens superior e inferior, perdida maxima y ganancia maxima con perfil de payoff.
2. **Given** una configuracion de Iron Butterfly con broken wing, **When** el sistema calcula el perfil, **Then** muestra el desbalance de riesgo lateral y la ventana optima de beneficio.
3. **Given** una configuracion de Condor call con strikes equidistantes, **When** se calcula el payoff, **Then** retorna el debito neto, riesgo por anchura de alas y escenarios de volatilidad implicita.

---

### User Story 2 — Simular escenarios y backtesting de estrategias (Priority: P2)

Como analista, necesito ejecutar simulaciones (Monte Carlo, escenarios deterministicos, backtesting historico) sobre estrategias complejas para evaluar su comportamiento bajo distintas condiciones de mercado antes de proponer una operacion.

**Why this priority**: La simulacion diferencial frente a estrategias simples es el valor distintivo de TEAM-08 y reduce riesgo operativo.

**Independent Test**: Se valida cuando un analista configura una simulacion Monte Carlo con 10,000 iteraciones sobre una Iron Condor y obtiene distribucion de P&L, probabilidad de exito y drawdown esperado.

**Acceptance Scenarios**:

1. **Given** una Iron Condor modelada con strikes y expiracion, **When** se ejecuta una simulacion Monte Carlo con shocks de precio y volatilidad, **Then** se obtienen heatmaps de P&L, probabilidad de exito y peor escenario.
2. **Given** un backtesting sobre datos historicos de 1 ano para una estrategia Butterfly Spread, **When** se ejecuta la simulacion, **Then** se retorna rendimiento acumulado, Sharpe ratio, max drawdown y tasa de aciertos.
3. **Given** costos reales de broker (slippage, comisiones, spread), **When** se ejecuta cualquier simulacion, **Then** los costos se descuentan del P&L proyectado.

---

### User Story 3 — Evaluar riesgo y limites de estrategia compleja (Priority: P2)

Como gestor de riesgo, necesito evaluar limites duros, riesgo de margen, stop-loss automatico y riesgo de asignacion temprana para cada estrategia compleja, asegurando que ninguna operacion supere los parametros de riesgo definidos.

**Why this priority**: Contener el riesgo en estrategias multi-pata es critico; el riesgo de asignacion temprana en opciones puede generar perdidas inesperadas.

**Independent Test**: Se valida cuando una Iron Condor que supera el limite de margen configurado es bloqueada con alerta explicita y queda registrada en auditoria.

**Acceptance Scenarios**:

1. **Given** una estrategia con parametros que exceden el limite de margen configurado, **When** el risk engine evalua la operacion, **Then** bloquea la propuesta con mensaje claro del limite excedido.
2. **Given** una estrategia con riesgo de asignacion temprana (opciones ITM cerca de ex-date), **When** el risk engine detecta el riesgo, **Then** emite alerta y sugiere ajuste de strikes o vencimiento.
3. **Given** una estrategia en simulacion que alcanza el stop-loss configurado, **When** el motor de riesgo ejecuta la regla, **Then** registra la alerta, notifica al operador y actualiza el estado.

---

### Edge Cases

- Que ocurre cuando los strikes seleccionados no son validos para la expiracion elegida (ej: strike fuera del rango disponible).
- Como se comporta el modelador cuando una pata tiene prima cero o precio no disponible.
- Que sucede si la simulacion Monte Carlo converge lentamente por alta complejidad de escenarios.
- Como se gestiona una estrategia donde el credito neto es menor que las comisiones proyectadas (operacion no rentable).
- Que ocurre cuando el riesgo de asignacion temprana es detectado a pocos dias del vencimiento y no hay tiempo para ajuste.
- Como se comporta el comparador cuando las estrategias a comparar tienen diferentes vencimientos o simbolos subyacentes.

## Success Criteria *(mandatory, measurable outcomes)*

- **SC-001**: El 100% de las estrategias complejas modeladas (Iron Condor, Iron Butterfly, Butterfly Spread, Condor) retornan perfiles completos de payoff, break-evens y riesgo maximo sin errores de calculo en suite de tests unitarios.
- **SC-002**: La simulacion Monte Carlo con 10,000 iteraciones se completa en <= 5 segundos para una estrategia de 4 patas en hardware de desarrollo (CPU i5+, RAM 8GB).
- **SC-003**: El risk engine bloquea el 100% de las propuestas que exceden limites de margen configurados, con alerta explicita y registro en auditoria (0 falsos negativos en tests de integracion).
- **SC-004**: El comparador de estrategias muestra metricas lado a lado para 2-4 estrategias simultaneamente sin degradacion de rendimiento perceptible.
- **SC-005**: El 100% de los eventos de riesgo (limite excedido, stop-loss alcanzado, asignacion temprana detectada) se registran con trazabilidad completa (timestamp, estrategia, parametros, accion tomada).
- **SC-006**: El modulo de visualizacion genera payoff curves, heatmaps P&L y resumen riesgo/beneficio en <= 2 segundos para cualquier estrategia de hasta 6 patas.
- **SC-007**: La cobertura de tests automatizados alcanza minimo 80% en modulos core (ironCondorEngine, ironButterflyEngine, butterflySpreadEngine, condorEngine, complexSimulationEngine, complexRiskEngine).
- **SC-008**: El 100% de los modulos de TEAM-08 cumplen el estandar transversal (naming, estructura de archivos, export patterns, convenciones FIC) verificado mediante revision de codigo automatizada antes del cierre de la feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE implementar un contrato base de estrategias complejas (`complexStrategyContract`) con inputs validados: ticker, expiracion, strikes por pata, primas, contratos, tipo de alas (short/wide/broken wing), tolerancia de riesgo y estilo de opcion (europea/americana).
- **FR-002**: El sistema DEBE implementar el core de Iron Condor (`ironCondorEngine`) con construccion multi-leg, calculo de credito neto, break-evens superior e inferior, perdida maxima y ganancia maxima, soportando variantes short y wide.
- **FR-003**: El sistema DEBE implementar el core de Iron Butterfly (`ironButterflyEngine`) con variantes short y broken wing, calculo de payoff/P&L temporal y sensibilidad a desplazamiento del subyacente.
- **FR-004**: El sistema DEBE implementar el core de Butterfly Spread (`butterflySpreadEngine`) con soporte call y put, calculo de debito/credito neto, ventanas optimas de beneficio y escenarios por volatilidad implicita.
- **FR-005**: El sistema DEBE implementar el core de Condor (`condorEngine`) con estructura por patas, riesgo por anchura de alas, payoff/P&L temporal y reglas de ajuste.
- **FR-006**: El sistema DEBE implementar un motor de simulacion (`complexSimulationEngine`) con backtesting historico, Monte Carlo, escenarios deterministicos, shocks de precio/IV y costos reales (slippage, comisiones, spread).
- **FR-007**: El sistema DEBE implementar un Risk Engine (`complexRiskEngine`) con limites duros configurables, alertas de margen, stop-loss automatico, deteccion de riesgo de asignacion temprana y kill-switch.
- **FR-008**: El sistema DEBE implementar un modulo de visualizacion y reporting (`complexReportEngine`) con payoff curves, heatmaps P&L, velas anotadas, drawdown y resumen riesgo/beneficio.
- **FR-009**: El sistema DEBE exponer APIs REST dedicadas para cada estrategia y un endpoint de comparacion de estrategias (`/api/strategies/complex/`).
- **FR-010**: El sistema DEBE integrar el API endpoint de comparacion (`complexComparator`) que recibe 2-4 configuraciones y retorna tabla comparativa con metricas clave lado a lado.
- **FR-011**: El sistema DEBE mantener trazabilidad completa entre estructura de opcion, estrategia modelada, simulacion ejecutada y decision sugerida.
- **FR-012**: Las salidas de los motores de estrategias DEBEN ser reproducibles y auditables, permitiendo reconstruir el estado en cualquier punto del calculo.
- **FR-013**: El sistema DEBE permanecer desacoplado del broker y del frontend; los contratos de estrategia deben ser consumibles via API sin dependencia de UI.
- **FR-014**: El sistema DEBE aplicar control de concurrencia (optimistic lock) sobre configuraciones de estrategia usando campo `version` para evitar sobrescritura accidental.
- **FR-015**: Todo codigo nuevo generado en esta feature DEBE incluir comentarios con prefijo `FIC:` en formato bilingue ingles/espanol, cubriendo modulos, funciones publicas, logica critica e integraciones. La ausencia de este estandar bloquea el cierre de cualquier tarea.
- **FR-016**: El equipo DEBE implementar tests automatizados (unit e integration) para cada modulo core, API endpoint y motor de simulacion/riesgo, con cobertura minima del 80% en rutas criticas.
- **FR-017**: El sistema DEBE ejecutar ajuste al estandar transversal sobre todos los modulos de TEAM-08 (ironCondorEngine, ironButterflyEngine, butterflySpreadEngine, condorEngine, complexSimulationEngine, complexRiskEngine, complexReportEngine) incluyendo alineacion de naming, estructura de archivos, export patterns y convenciones de codigo conforme al estandar definido por el canon global.

### Key Entities *(include if feature involves data)*

- **ComplexStrategyConfig**: Representa la configuracion completa de una estrategia compleja con ticker, expiracion, strikes por pata, primas, cantidad de contratos, tipo de alas, tolerancia de riesgo, estilo de opcion y metadatos de auditoria.
- **StrategyProfile**: Representa el perfil de payoff calculado para una estrategia, incluyendo credito/debito neto, break-evens, perdida maxima, ganancia maxima, puntos de equilibrio por pata y matriz de sensibilidad.
- **SimulationRun**: Representa una ejecucion de simulacion (Monte Carlo, deterministica o backtesting) sobre una estrategia, con parametros, resultados, distribuciones de P&L y metadatos de ejecucion.
- **RiskAssessment**: Representa la evaluacion de riesgo de una estrategia, incluyendo limites evaluados, alertas de margen, riesgo de asignacion, estado de stop-loss y recomendaciones de ajuste.
- **ComparisonResult**: Representa el resultado de una comparacion entre 2-4 estrategias, con metricas clave lado a lado y recomendacion contextual.


## UI Architecture & Component Stack *(professional TradingView-like design)*

> **Nota**: El diseno de UI que sigue es **referencial** para consumo del equipo de UI/FE en una fase posterior. TEAM-08 implementa exclusivamente los motores backend, APIs y contratos. La arquitectura de componentes se incluye para garantizar que las salidas de los motores sean consumibles por la UI sin adaptaciones posteriores.

### 1. Main Strategy Lab Layout
- **Library**: React 18 + Vite + TailwindCSS
- **Chart Component**: TradingView Lightweight Charts v4.x (payoff curves, heatmaps)
- **Reference Design**: OptionStrat, Tastytrade, Interactive Brokers Strategy Builder

### 2. Component Specifications

#### 2.1 Strategy Type Selector
- **Type**: Card grid or segmented control
- **Options**: Iron Condor, Iron Butterfly, Butterfly Spread, Condor, Comparador
- **Behavior**: On select → carga template de configuracion para esa estrategia

#### 2.2 Strategy Configuration Panel
- **Type**: Form panel con inputs agrupados por pata
- **Fields comunes**: Ticker, Fecha expiracion, Cantidad contratos, Tipo (Call/Put)
- **Fields por pata**: Strike, Prima (bid/ask), Tipo ala (short/wide/broken)
- **Features**:
  - Validacion en tiempo real de strikes y expiraciones
  - Vista previa de perfil basico al completar configuracion
  - Carga automatica de primas desde market data disponible
- **Behavior**: On change → recalcula perfil de payoff

#### 2.3 Payoff Chart (Core Visualization)
- **Type**: TradingView Lightweight Charts con serie de lineas
- **Content**: Curva de P&L a vencimiento + curvas temporales (T-30, T-15, T-7, T-0)
- **Overlays**:
  - Break-evens (lineas verticales punteadas)
  - Zona de ganancia (fondo verde)
  - Zona de perdida (fondo rojo)
  - Punto maximo ganancia/perdida (marcadores)
- **Interactivity**:
  - Hover en curva → tooltip con precio subyacente y P&L
  - Click en punto → detalle de esa pata
  - Zoom/pan

#### 2.4 Risk & Metrics Dashboard
- **Type**: Summary cards panel
- **Metrics**: Max Gain, Max Loss, Credit/Debit, Break-evens, Probability of Profit, IV Impact, Theta, Vega, Delta net
- **Features**:
  - Color-coded (green for positive, red for negative)
  - Alert badges when risk limits exceeded
  - Expandable detail per metric

#### 2.5 Simulation Panel
- **Type**: Configuration pane + results view
- **Tabs**: Monte Carlo, Deterministic, Backtesting
- **Monte Carlo config**: Iterations (1K-100K), Price shock %, IV shock %, Confidence interval
- **Backtesting config**: Date range, Rebalance frequency, Slippage, Commission
- **Results**: Distribution histogram, Probability cone, Key stats (mean, median, std, VaR, CVaR)

#### 2.6 Strategy Comparator
- **Type**: Side-by-side comparison view
- **Layout**: Tabla horizontal con una columna por estrategia
- **Metrics comparadas**: Probabilidad de exito, Riesgo maximo, Rendimiento esperado, Requisitos de margen, Theta, Vega, Break-even spread
- **Features**: Highlight de mejor opcion por metrica, Export a CSV

### 3. UI Layout Structure
```
┌────────────────────────────────────────────────────────────┐
│ [Strategy Lab] | [Iron Condor ▼] | [SPX] | [Exp: 21d]    │
├────────────────────────────────────────────────────────────┤
│ ┌──────────────┬──────────────────────────────────────┐   │
│ │ Configuration │                                      │   │
│ │ Panel        │     Payoff Chart                     │   │
│ │ ─────────── │     (OHLC + curves + overlays)        │   │
│ │ Pata 1: Call │                                      │   │
│ │ Pata 2: Put  │                                      │   │
│ │ Pata 3: Call │                                      │   │
│ │ Pata 4: Put  │                                      │   │
│ └──────────────┴──────────────────────────────────────┘   │
├────────────────────────────────────────────────────────────┤
│ ┌──── Metrics ────┐ ┌── Risk ──┐                        ││
│ │ Max Gain: $450  │ │ Margin   │                        ││
│ │ Max Loss: $550  │ │ OK ✅    │                        ││
│ │ Break-evens     │ │ Stop     │                        ││
│ │  @ 195 / 205    │ │ Loss OFF │                        ││
│ │ Prob: 68%       │ │          │                        ││
│ └─────────────────┘ └──────────┘                        ││
└────────────────────────────────────────────────────────────┘
```

## Assumptions

- TEAM-08 actua como equipo de motores de estrategias complejas, no de ejecucion ni UI operativa.
- TEAM-08 consume datos de mercado (primas, strikes, IV) de los catalogos/adapters definidos por TEAM-01 y el canon global.
- Las estrategias se modelan como motores backend puros (desacoplados de broker y frontend).
- La simulacion usa datos historicos de mercado disponibles en Supabase o proveedor configurado.
- No existe auto-trading ni ejecucion automatica de estrategias complejas en v1 — todo requiere aprobacion humana explicita.
- El scope de TEAM-08 se limita a Iron Condor, Iron Butterfly, Butterfly Spread y Condor en v1.
- TEAM-08 no invade dominios de otros equipos (volatilidad, noticias, broker, frontend operativo).
- Los costos reales (slippage, comisiones, spread) se configuran por broker y se consumen del catalogo de brokers de TEAM-01.
- Los resultados de simulacion y riesgo son referenciales y no garantizan resultados futuros.

## Cobertura de Knowledge Aplicado

- Investigado con knowledge local: contratos de opciones, pricing de opciones (Black-Scholes, arbol binomial), griegas (delta, gamma, theta, vega), riesgo de asignacion temprana en opciones americanas.
- Resuelto con metodologia estandar: patron de motores de calculo desacoplados, contratos de API REST, modelo de simulacion Monte Carlo.
- No se detectaron skills requeridas faltantes para la etapa speckit.specify.
- Nuevo en esta iteracion: arquitectura de Strategy Lab con payoff charts, motor de simulacion multi-escenario, Risk Engine para opciones complejas.

## Recomendaciones de Knowledge

Los siguientes temas mejorarian el knowledge base con /diana.knowledge:
- /diana.knowledge topic="options-pricing-models" scope="sdk" — Modelos de pricing de opciones (Black-Scholes, binomial, Monte Carlo) para estandarizar calculos entre equipos.
- /diana.knowledge topic="complex-options-strategies" scope="sdk" — Estrategias complejas de opciones (Iron Condor, Butterfly, Condor) con formulas, riesgos y casos de uso.

## Clarifications

### Session 2026-05-21

- Q: ¿TEAM-08 debe implementar frontend o solo backend/motores? → A: Solo backend/motores. El frontend (Strategy Lab) queda como responsabilidad futura de equipo de UI/FE. Los motores exponen APIs REST y salidas estructuradas.
- Q: ¿Que metodos de simulacion se soportan en v1? → A: Monte Carlo (configurable 1K-100K iteraciones), deterministico (shocks de precio/IV) y backtesting historico sobre datos reales.
- Q: ¿Como se maneja el riesgo de asignacion temprana en opciones americanas? → A: El Risk Engine evalua patas ITM con dividendos prox o ex-date cercano y emite alerta con sugerencia de ajuste.
- Q: ¿El comparador compara estrategias del mismo subyacente o entre distintos? → A: Inicialmente del mismo subyacente y ventana temporal similar para metricas comparables.
