# Plan Operativo Speckit: Calendar Spread & Diagonal Spread
## TEAM-09 — SquadISC

<!--
  ARCHIVO: plan.md — Plan Operativo Speckit para TEAM-09
  GENERADO POR: speckit.plan (via /diana.integrate)
  CANON DE ENTRADA: teams/TEAM-09/plan.md (Diana)
  SPEC VIGENTE: specs/010-team-09-calendar-diagonal/spec.md
  PROPOSITO: Define el plan de implementacion desglosado por modulo con dependencias,
  estimaciones, criterios de aceptacion, riesgos y grafo de dependencias.
  CONSUMIDO POR: speckit.tasks (genera backlog operativo), TEAM-09 (guia implementacion)
-->
**Proyecto**: diana-inversions
**Iniciativa**: 001-inversions
**Equipo**: TEAM-09 (SquadISC)
**Engine**: speckit
**Etapa**: plan
**Idioma**: es
**Generado desde**: `/diana.integrate action="run" engine="speckit" project="diana-inversions" initiative="001-inversions" team="TEAM-09" run_only="plan" language="es"`
**Canon de entrada (base)**: `teams/TEAM-09/plan.md`
**Spec Speckit vigente**: `specs/010-team-09-calendar-diagonal/spec.md`
**Version**: 1.0
**Estado**: Draft Speckit

---

## 1. Autoridad (desde canon Diana)

Este plan de equipo esta subordinado a:
1. `inv-constitution.md`
2. `001-inv-spec.md`
3. `001-inv-plan.md`
4. `teams/TEAM-09/spec.md`
5. `scope_primario.md`
6. `specs/010-team-09-calendar-diagonal/spec.md` — spec Speckit vigente del feature

**Regla de autoridad**: Ante conflicto entre este plan operativo y el canon Diana (`teams/TEAM-09/plan.md`), prevalece el canon. Este plan expande, detalla y complementa, pero NO omite ni contradice el canon fuente.

<!--
  SECCION 2: Objetivo
  FUENTE: Canon Diana preservado + Speckit expansion
  PROPOSITO: Declara el objetivo general del feature y su descomposicion en 8 modulos.
-->

## 2. Objetivo (desde canon Diana — preservado)

Implementar estrategias Calendar Spread y Diagonal Spread con explicabilidad, trazabilidad y consumo operativo.

**Ampliacion Speckit**: El objetivo se descompone en 8 modulos de implementacion con entregables concretos, rutas de integracion y criterios de aceptacion por modulo, manteniendo trazabilidad 1:1 con las fases tecnicas del canon.

<!--
  SECCION 3: Fases Tecnicas
  FUENTE: Canon Diana preservado y expandido
  PROPOSITO: 4 fases (T09-1 a T09-4) que agrupan los modulos por orden logico.
  T09-1: Fundacion (contratos + motores)
  T09-2: Calculo y escenarios (simulacion + riesgo)
  T09-3: Chat IA y API (exposicion)
  T09-4: Validacion (tests + calidad)
-->

## 3. Fases Tecnicas (desde canon Diana — preservado y expandido)

### Fase T09-1: Modelado temporal
- Contratos para estructuras calendar y diagonal.
- Parametrizacion call/put.

### Fase T09-2: Calculo y escenarios
- Riesgo, tiempo y sensibilidad.
- Reglas de evaluacion comparativa.

### Fase T09-3: Chat IA y API
- Narrativa explicativa de estructura temporal.
- Endpoints para consumo operativo.

### Fase T09-4: Validacion
- Trazabilidad y readiness para Speckit.

### Fase T09-5: Features extendidas
- Stress tests en engines para escenarios extremos de mercado (crash, rally, IV expansion/contraction, volatility spike).
- Forward IV estimator para pricing preciso de pata larga en Calendar/Diagonal Spread.
- Probability cone y metricas extendidas (CVaR, stress P&L) en el reporte estructurado.

### Fase T09-6: Enriquecimiento comparativo
- Griegas completas (delta, gamma, vega) en CalendarSpreadEngine para paridad con Diagonal.
- Helpers estáticos calculateBreakEvens y calculateNetCost en termReportEngine.
- Comparador side-by-side con 3 bloques (Capital & Risk, Greeks Exposure, DTE).

<!--
  SECCION 4: Mapeo Fases -> Modulos Speckit
  FUENTE: Speckit expansion
  PROPOSITO: Tabla que conecta cada fase canonica con su modulo, archivo fisico y tarea.
  Es el puente entre la vision Diana (fases) y la implementacion Speckit (modulos .ts).
-->

## 4. Mapeo de Fases Canonicas a Modulos Speckit (Speckit expansion)

Cada fase canonica se materializa en uno o mas modulos de la arquitectura definida en `spec.md`:

| Fase Canonica | Modulo Speckit | Artefacto(s) | IDs Tarea Asociados |
|---------------|----------------|--------------|---------------------|
| **T09-1** Modelado temporal | `termStrategyContract.ts` | Contrato base Calendar/Diagonal con validacion de consistencia temporal y estilo de opcion | T162 |
| **T09-1** Modelado temporal | `calendarSpreadEngine.ts` | Core Calendar Spread (call/put) con theta, vencimiento corto/largo, term structure IV | T163 |
| **T09-1** Modelado temporal | `diagonalSpreadEngine.ts` | Core Diagonal Spread (call/put) con combinacion strike+tiempo, griegas, perfiles de riesgo | T164 |
| **T09-2** Calculo y escenarios | `termSimulationEngine.ts` | Backtesting, Monte Carlo/escenarios deterministicos, proyeccion payoff/P&L | T165 |
| **T09-2** Calculo y escenarios | `termRiskEngine.ts` | Limites por vencimiento, riesgo de asignacion, stop-loss, alertas | T166 |
| **T09-2** Calculo y escenarios | `termRollOrchestrator.ts` | Reglas de roll/ajuste, cierre anticipado, control de deterioro temporal | T169 |
| **T09-3** Chat IA y API | `calendarSpread.ts` (API) | API REST Calendar Spread | T168 |
| **T09-3** Chat IA y API | `diagonalSpread.ts` (API) | API REST Diagonal Spread | T168 |
| **T09-3** Chat IA y API | `termComparator.ts` | Comparador Calendar vs Diagonal para recomendacion segun contexto | T168 |
| **T09-3** Chat IA y API | `termChatAssistant.ts` | Integracion Chat IA explicativo | — |
| **T09-3** Chat IA y API | `termReportEngine.ts` | Curvas de payoff, superficies tiempo-precio-IV, metricas riesgo/beneficio | T167 |
| **T09-3** Chat IA y API | Documentacion OpenAPI/Swagger | Anotaciones JSDoc + ruta `/api/docs` | T199 |
| **T09-3** Chat IA y API | Monte Carlo default en APIs | calendarSpread.ts, diagonalSpread.ts, term-verify.html | T201 |
| **T09-1** Modelado temporal | Validacion fechas en contrato | `termStrategyContract.ts` — Invalid Date + fecha pasada | T200 |
| **T09-4** Validacion | Tests unitarios y de integracion | `tests/unit/strategies/term/`, `tests/integration/strategies/term/` | T196, T197, T198 |
| **T09-4** Validacion | Estandarizacion transversal | Ajuste al estandar transversal de estrategias | T177 |
| **T09-4** Validacion | Cobertura tests chat assistant | termChatAssistant.test.ts (≥80%) | T202 |
| **T09-4** Validacion | Cobertura tests report engine | termReportEngine.test.ts (branch ≥80%) | T203 |
| **T09-5** Features extendidas | Stress Tests Calendar/Diagonal | `calendarSpreadEngine.ts`, `diagonalSpreadEngine.ts` — 5 escenarios predefinidos con P&L, IV y griegas | T204 |
| **T09-5** Features extendidas | Forward IV Estimator | `termUtils.ts` — `estimateForwardIv()` para pricing de pata larga | T205 |
| **T09-5** Features extendidas | Report Extendido | `termReportEngine.ts` — probability cone, CVaR, stress P&L summary | T206 |
| **T09-6** Enriquecimiento comparativo | Griegas completas Calendar | `calendarSpreadEngine.ts` — delta, gamma, vega via Black-Scholes | T207 |
| **T09-6** Enriquecimiento comparativo | Comparador side-by-side 3 bloques | `termComparator.ts` — Capital & Risk, Greeks, DTE | T208 |
| **T09-6** Enriquecimiento comparativo | Helpers break-even y net cost | `termReportEngine.ts` — calculateBreakEvens, calculateNetCost | T209 |

<!--
  SECCION 5: Plan de Implementacion por Modulo
  FUENTE: Speckit expansion
  PROPOSITO: 19 sub-secciones (5.1 a 5.19) detallando cada modulo del feature:
  dependencias, estimacion, criterios de aceptacion, habilitadores.
  INCLUYE: T199-T203 (adiciones Speckit v2) y T204-T206 (adiciones Speckit v3).
-->

## 5. Plan de Implementacion por Modulo (Speckit expansion)

### 5.1 Contrato Base — `termStrategyContract.ts`

**Dependencias**: Ninguna (modulo fundacional)
**Estimacion**: 1 unidad de desarrollo
**Criterio de aceptacion**:
- Valida consistencia temporal (expiracion corta < expiracion larga)
- Valida estilo de opcion (call/put) por pata
- Acepta inputs: strikes, expiraciones, primas, contratos
- Rechaza configuraciones invalidas con error descriptivo
**Depende de**: —
**Habilitador de**: calendarSpreadEngine, diagonalSpreadEngine

### 5.2 Calendar Spread Engine — `calendarSpreadEngine.ts`

**Dependencias**: termStrategyContract
**Estimacion**: 2 unidades de desarrollo
**Criterio de aceptacion**:
- Modela theta decay para vencimiento corto y largo
- Calcula impacto de term structure IV
- Genera escenarios de precio en rango configurable
- Soporta variantes call y put
**Depende de**: T162 completado
**Habilitador de**: termSimulationEngine, termRiskEngine

### 5.3 Diagonal Spread Engine — `diagonalSpreadEngine.ts`

**Dependencias**: termStrategyContract
**Estimacion**: 2 unidades de desarrollo
**Criterio de aceptacion**:
- Combina strike diferencial + expiracion diferencial
- Calcula sensibilidad de griegas (delta, gamma, theta, vega)
- Genera perfiles de riesgo por escenario de precio y tiempo
- Identifica ventanas de ajuste/roll
**Depende de**: T162 completado
**Habilitador de**: termSimulationEngine, termRiskEngine

### 5.4 Motor de Simulacion Temporal — `termSimulationEngine.ts`

**Dependencias**: calendarSpreadEngine, diagonalSpreadEngine
**Estimacion**: 2 unidades de desarrollo
**Criterio de aceptacion**:
- Soporta backtesting con datos historicos
- Ejecuta Monte Carlo con parametros configurables (iteraciones, distribuciones)
- Ejecuta escenarios deterministicos (precio fijo, shock de IV, paso temporal)
- Proyecta payoff y P&L en tiempo real
**Depende de**: T163, T164 completados
**Habilitador de**: termRiskEngine, termReportEngine

### 5.5 Motor de Riesgo — `termRiskEngine.ts`

**Dependencias**: termSimulationEngine
**Estimacion**: 1.5 unidades de desarrollo
**Criterio de aceptacion**:
- Aplica limites por vencimiento (max fecha, concentracion)
- Calcula riesgo de asignacion temprana
- Implementa reglas de stop-loss configurables
- Dispara alertas push/email en violacion de limites
**Depende de**: T165 completado
**Habilitador de**: termRollOrchestrator

### 5.6 Orquestador de Gestion Temporal — `termRollOrchestrator.ts`

**Dependencias**: termRiskEngine
**Estimacion**: 1.5 unidades de desarrollo
**Criterio de aceptacion**:
- Ejecuta reglas de roll programadas por calendario
- Evalua triggers de ajuste basados en umbrales de riesgo
- Calcula costos de roll y recomienda cierre anticipado si aplica
- Controla deterioro temporal con metrica theta residual
**Depende de**: T166 completado
**Habilitador de**: API layer

### 5.7 Visualizacion y Reporting — `termReportEngine.ts`

**Dependencias**: termSimulationEngine
**Estimacion**: 1.5 unidades de desarrollo
**Criterio de aceptacion**:
- Genera curvas de payoff para ambas estrategias
- Produce superficies tiempo-precio-IV
- Presenta metricas riesgo/beneficio auditables (formato JSON + visual)
- Exporta datos para consumo por TEAM-01 (dashboard)
**Depende de**: T165 completado
**Habilitador de**: API layer, Chat IA

### 5.8 APIs de Exposicion — `calendarSpread.ts`, `diagonalSpread.ts`, `termComparator.ts`

**Dependencias**: Todos los modulos anteriores
**Estimacion**: 2 unidades de desarrollo
**Criterio de aceptacion**:
- API REST con respuestas JSON estructuradas
- Endpoint Calendar Spread: calculo completo + escenarios
- Endpoint Diagonal Spread: calculo completo + escenarios
- Endpoint comparador: Calendar vs Diagonal segun contexto multi-core
- Documentacion OpenAPI/Swagger
**Depende de**: T163, T164, T165, T167 completados
**Habilitador de**: Consumo frontend y otros equipos

### 5.9 Chat IA Explicativo — `termChatAssistant.ts`

**Dependencias**: Todos los modulos anteriores
**Estimacion**: 2 unidades de desarrollo
**Criterio de aceptacion**:
- Explica proposito de la estructura temporal seleccionada
- Detalla riesgo y condiciones de uso en lenguaje natural
- Contextualiza basado en escenarios del motor de simulacion
- No autoriza ejecucion ni sustituye juicio humano (RNF-001)
**Depende de**: T163, T164, T165 completados
**Habilitador de**: Experiencia de usuario con IA conversacional

### 5.10 Tests — Unitarios y de Integracion

| ID Tests | Modulo(s) Bajo Prueba | Tipo | Archivo Destino |
|----------|----------------------|------|-----------------|
| T196 | calendarSpreadEngine, diagonalSpreadEngine | Unitario | `tests/unit/strategies/term/` |
| T197 | termSimulationEngine, termRollOrchestrator | Unitario | `tests/unit/strategies/term/` |
| T198 | calendarSpread (route), diagonalSpread (route), termComparator (route) | Integracion | `tests/integration/strategies/term/` |

**Cobertura minima requerida**: 80% en rutas criticas (logica de negocio, contratos de API, flujos de error)

### 5.11 Estandarizacion Transversal — T177

- Ajustar implementacion de TEAM-09 al estandar transversal definido en `001-inv-tasks.md`
- Asegurar consistencia de naming, estructura de archivos, manejo de errores y patrones de integracion con el resto de los equipos

### 5.12 Documentacion OpenAPI/Swagger — T199

**Dependencias**: T168 (APIs existentes)
**Estimacion**: 1 unidad de desarrollo
**Criterio de aceptacion**:
- Anotaciones JSDoc OpenAPI en los 3 endpoints (calendar, diagonal, compare)
- Ruta `/api/docs` servida con swagger-ui-express
- Esquemas de request/response documentados
- Documentacion consumible por TEAM-01 para integracion
**Depende de**: T168 completado
**Habilitador de**: Integracion con TEAM-01 (G-T09-03)

### 5.13 Validacion de Fechas en Contrato Base — T200

**Dependencias**: T162
**Estimacion**: 0.5 unidades de desarrollo
**Criterio de aceptacion**:
- Rechazar `Invalid Date` (NaN) en expiraciones
- Rechazar fechas de expiracion en pasado
- Errores descriptivos con codigo y campo afectado
**Depende de**: T162 completado
**Habilitador de**: Calidad de datos en motores T163, T164

### 5.14 Monte Carlo Default en APIs — T201

**Dependencias**: T165, T168
**Estimacion**: 0.5 unidades de desarrollo
**Criterio de aceptacion**:
- Ejecutar Monte Carlo por defecto (1000 iteraciones, normal) cuando no se especifique config
- Mostrar resultados de Monte Carlo en term-verify.html
- UI con controles basicos de Monte Carlo en pagina de verificacion
**Depende de**: T165, T168 completados
**Habilitador de**: Verificacion visual de simulacion Monte Carlo

### 5.15 Tests Chat Assistant — T202

**Dependencias**: S-T09-C01
**Estimacion**: 0.5 unidades de desarrollo
**Criterio de aceptacion**:
- Cobertura de sentencias ≥80% en termChatAssistant.ts
- Cobertura de ramas ≥80% en termChatAssistant.ts
- Tests para metodos: buildPurpose, buildRiskProfile, buildUsageConditions, buildScenarioSummary, extractMetrics
**Depende de**: S-T09-C01 completado
**Habilitador de**: Cumplimiento RNF-006

### 5.16 Tests Report Engine — T203

**Dependencias**: T167
**Estimacion**: 0.5 unidades de desarrollo
**Criterio de aceptacion**:
- Branch coverage ≥80% en termReportEngine.ts
- Tests para generateSurface con datos parciales/nulos
- Tests para calculateRiskMetrics con datos extremos
- Tests para generateReport con ambas estrategias (calendar/diagonal)
**Depende de**: T167 completado
**Habilitador de**: Cumplimiento RNF-006

### 5.17 Stress Tests en Engines — T204

**Dependencias**: T163, T164
**Estimacion**: 1 unidad de desarrollo
**Criterio de aceptacion**:
- CalendarSpreadEngine genera 5 escenarios de stress (Market Crash, Sharp Rally, IV Expansion, IV Contraction, Volatility Spike)
- Cada escenario incluye: label, descripcion, precio estimado, P&L, cambio en IV
- DiagonalSpreadEngine genera los mismos 5 escenarios con griegas adicionales (delta, gamma, theta, vega)
- Stress tests se integran en StructuredReport como campo stressTests
**Depende de**: T163, T164 completados
**Habilitador de**: T206 (report extendido)

### 5.18 Forward IV Estimator — T205

**Dependencias**: Ninguna (utilidad matematica pura)
**Estimacion**: 0.5 unidades de desarrollo
**Criterio de aceptacion**:
- Calcula IV forward entre dos tenores usando formula canonica
- Maneja casos borde (numerador negativo, tenores iguales, IV nula)
- Implementa fallback conservador cuando la formula produce backwardation extrema
- Output siempre positivo y acotado
**Depende de**: —
**Habilitador de**: Pricing preciso en T163, T164

### 5.19 Report Extendido — T206

**Dependencias**: T163, T164, T167, T204, T205
**Estimacion**: 1 unidad de desarrollo
**Criterio de aceptacion**:
- StructuredReport incluye field stressTests: StressTestEntry[]
- StructuredReport incluye field probabilityCone: ProbabilityConePoint[]
- RiskMetrics incluye stressTestMaxLoss, stressTestMaxGain, expectedShortfall (CVaR)
- generateStressTestSummary() consume stress tests de ambos engines
- generateProbabilityCone() genera percentiles 5/25/50/75/95
- estimateExpectedShortfall() calcula CVaR al 95%
**Depende de**: T165, T167, T204, T205 completados
**Habilitador de**: RF-009, UI extendida en term-verify.html

### 5.20 Griegas Completas Calendar — T207

**Dependencias**: T163
**Estimacion**: 0.5 unidades de desarrollo
**Criterio de aceptacion**:
- CalendarSpreadEngine.CalendarSpreadResult incluye field `greeks: GreekSensitivities`
- GreekSensitivities incluye delta, gamma, theta, vega (theta ya existia, se agregan delta/gamma/vega)
- Griegas calculadas via Black-Scholes con las mismas premisas que diagonalSpreadEngine
- Tests actualizados para reflejar el nuevo campo requerido
**Depende de**: T163 completado
**Habilitador de**: T208 (comparador con griegas completas para Calendar)

### 5.21 Comparador Side-by-Side 3 Bloques — T208

**Dependencias**: T163, T164, T167, T207, T209
**Estimacion**: 1 unidad de desarrollo
**Criterio de aceptacion**:
- POST /compare retorna `CalendarMetrics` y `DiagonalMetrics` con 3 bloques:
  1. Capital & Risk: cost, maxLoss, maxProfit, breakEvens, probabilityOfProfit
  2. Greeks Exposure: delta, gamma, theta, vega
  3. DTE: short, long
- La recomendacion incluye scores numericos y justificacion textual
- term-verify.html panel Comparador renderiza tabla side-by-side con los 3 bloques
**Depende de**: T207, T209 completados
**Habilitador de**: RF-009 en UI de comparacion

### 5.22 Helpers Break-Even y Net Cost — T209

**Dependencias**: T167
**Estimacion**: 0.5 unidades de desarrollo
**Criterio de aceptacion**:
- calculateBreakEvens(curve: PayoffCurvePoint[]): number[] — retorna precios donde P&L cruza cero
- calculateNetCost(legs): number — retorna suma de premium*contracts
- Maneja casos borde: curva con menos de 2 puntos, sin cruce por cero
- Tests unitarios para ambos metodos
**Depende de**: T167 completado
**Habilitador de**: T208 (comparador usa break-evens y cost)

<!--
  SECCION 6: Grafo de Dependencias
  FUENTE: Speckit expansion
  PROPOSITO: Arbol de dependencias entre tareas. La secuencia recomendada es 4 oleadas:
  Ola 1 (T162->T163+T164+T200) -> Ola 2 (T165->T166+T169) ->
  Ola 3 (T167+T168+T199+T201+S-T09-C01) -> Ola 4 (T196+T197+T198+T202+T203+T177)
  REGLA: No saltar oleadas — cada una depende de la anterior.
-->

## 6. Grafo de Dependencias (Speckit expansion)

```
T162 (termStrategyContract)
  ├──> T200 (validacion fechas) ← desde T162
  │
  ├──> T163 (calendarSpreadEngine)
  ├──> T164 (diagonalSpreadEngine)
  │
  ├──> T165 (termSimulationEngine)
  │     ├──> T166 (termRiskEngine)
  │     │     └──> T169 (termRollOrchestrator)
  │     └──> T167 (termReportEngine)
  │           └──> T203 (tests report engine)
  │
  ├──> T168 (APIs + Comparator) ← depende de T163, T164, T165, T167
  │     ├──> T199 (OpenAPI/Swagger)
  │     └──> T201 (Monte Carlo default) ← desde T165
  │
  ├──> T204 (stress tests) ← desde T163, T164
  │     └──> T206 (report extendido) ← desde T204 + T205
  │
  ├──> T205 (forward IV estimator) ← utilidad compartida
  │     └──> T206 (report extendido)
  │
  ├──> S-T09-C01 (Chat IA) ← depende de T163, T164, T165
  │     └──> T202 (tests chat assistant)
  │
  └──> T196 (tests unitarios engines)
  └──> T197 (tests unitarios simulacion)
  └──> T198 (tests integracion routes)
  └──> T177 (estandarizacion transversal)
```

**Secuencia recomendada de implementacion**:
1. **Ola 1**: T162 → T163 + T164 (fundacion)
2. **Ola 2**: T165 → T166 + T167 (simulacion y riesgo)
3. **Ola 3**: T169 + T168 + Chat IA (orquestacion y exposicion)
4. **Ola 4**: T196 + T197 + T198 + T177 (calidad y cierre)
5. **Ola 5**: T204 + T205 → T206 (features extendidas)

<!--
  SECCION 7-9: Riesgos, Criterios de Validacion, Contratos de Integracion
  FUENTE: Canon Diana preservado + Speckit expansion
  PROPOSITO: Documenta 6 riesgos (R-01 a R-06), criterios de exito del plan,
  y los contratos de integracion obligatorios (auth-context, broker-adapter, signal-lifecycle).
-->

## 7. Riesgos (desde canon Diana — preservado y expandido)

### Del canon (preservado):
- Parametrizacion temporal incorrecta; mitigar con contratos y pruebas.
- Salidas ambiguas; mitigar con explicabilidad y supuestos visibles.

### Ampliacion Speckit (expandido desde spec.md):

| ID Riesgo | Descripcion | Mitigacion | Fase de impacto |
|-----------|-------------|------------|-----------------|
| R-01 | Parametrizacion temporal incorrecta | Contratos robustos (`termStrategyContract`) con validacion de consistencia + tests unitarios T196 | T09-1 |
| R-02 | Salidas ambiguas para validacion humana | Explicabilidad y supuestos visibles en cada salida de `termReportEngine` y `termChatAssistant` | T09-3, T09-4 |
| R-03 | Dependencia de datos de mercado no disponibles | Contratos desacoplados con validacion de existencia en `termSimulationEngine` | T09-2 |
| R-04 | Complejidad de modelado de IV term structure | Documentacion de supuestos por mercado en `calendarSpreadEngine` y `diagonalSpreadEngine` | T09-1 |
| R-05 | Riesgo de asignacion temprana no detectado | Reglas en `termRiskEngine` con alertas push/email | T09-2 |
| R-06 | Deterioro temporal no controlado | `termRollOrchestrator` con metrica theta residual y triggers de roll | T09-2 |

---

## 8. Criterios de Validacion (desde canon Diana — preservado y expandido)

### Del canon (preservado):
- Las estrategias temporales quedan modeladas y explicadas.
- La salida es trazable y util para validacion humana.
- El plan queda listo para `/speckit.plan`.

### Ampliacion Speckit:
- Cada modulo pasa sus criterios de aceptacion individuales (seccion 5).
- La suite de tests T196-T198 pasa con cobertura >= 80% en rutas criticas.
- El grafo de dependencias se respeta en la secuencia de implementacion.
- Los contratos de integracion (`auth-context.md`, `broker-adapter.md`, `signal-lifecycle.md`) se cumplen sin desviaciones.
- Los gaps G-T09-01, G-T09-02 y G-T09-03 estan resueltos o con plan de cierre definido.
- No hay omision de contenido canonico vs `teams/TEAM-09/plan.md`.

---

## 9. Contratos de Integracion (desde spec.md)

### Contratos de entrada obligatorios:
- `specs/001-plataforma-inversiones-ia/contracts/auth-context.md`
- `specs/001-plataforma-inversiones-ia/contracts/broker-adapter.md`
- `specs/001-plataforma-inversiones-ia/contracts/signal-lifecycle.md`

### Contratos de salida:
- API REST con respuestas JSON estructuradas para consumo por frontend y otros equipos.
- Formato de metricas de theta decay y sensibilidad temporal para UI consolidada (coordinado con TEAM-01).

<!--
  SECCION 10-11: Gaps e Integracion con Speckit
  FUENTE: team-agent-bootstrap.md + canon Diana
  PROPOSITO: G-T09-01 a G-T09-03 son gaps pendientes que requieren coordinacion
  externa. La seccion 11 documenta el flujo de integracion Speckit post-plan.
-->

## 10. Gaps y Decisiones Pendientes (desde team-agent-bootstrap.md — preservado)

| Gap | Descripcion | Estado | Responsable |
|-----|-------------|--------|-------------|
| G-T09-01 | Definir supuestos de modelado de curva temporal e IV term structure por mercado | Pendiente | TEAM-09 + Riesgo Institucional |
| G-T09-02 | Validar reglas de roll (calendario, triggers, costos) con politica de riesgo institucional | Pendiente | TEAM-09 + Riesgo Institucional |
| G-T09-03 | Acordar formato de metricas de theta decay y sensibilidad temporal para UI consolidada | Pendiente | TEAM-09 + TEAM-01 |

**Recomendacion**: Resolver G-T09-01 y G-T09-02 antes de iniciar T169 (termRollOrchestrator). Resolver G-T09-03 antes de T167 (termReportEngine).

---

## 11. Integracion con Speckit (desde canon Diana — preservado)

- `/diana.plan action="generate" project="diana-inversions" initiative="001-inversions" team="TEAM-09"`
- Luego `/speckit.plan`

**Nota Speckit**: Este plan operativo constituye la salida de `speckit.plan` para TEAM-09. La siguiente etapa es `speckit.tasks` para generar el backlog operativo detallado con asignacion de recursos y estimaciones.

<!--
  SECCION 12-13: SDD Engine Matrix y Cobertura Canonica
  FUENTE: Speckit expansion
  PROPOSITO: Verifica que todas las skills requeridas para speckit.plan estan disponibles
  en el proyecto. El reporte de cobertura garantiza que NO hay omisiones del canon Diana.
  ESTADO: 12 preserved + 6 expanded + 2 merged + 0 dropped. SIN GAPS.
-->

## 12. Trazabilidad con SDD Engine Matrix

**Etapa**: speckit.plan
**Required skills** (desde `sdd-engine-matrix.yaml`):
| Skill ID | Nombre | Estado |
|----------|--------|--------|
| 001-inv-technical-analysis-structure | Technical Analysis Structure | Disponible |
| 002-inv-indicator-signal-logic | Indicator Signal Logic | Disponible |
| 004-inv-options-strategy-engine | Options Strategy Engine | Disponible |
| 005-inv-institutional-options-flow | Institutional Options Flow | Disponible |
| 006-inv-realtime-news-impact | Realtime News Impact | Disponible |
| 007-inv-ai-confluence-orchestration | AI Confluence Orchestration | Disponible |
| 008-inv-market-data-and-realtime | Market Data and Realtime | Disponible |
| 010-inv-broker-integration-ibkr-alpaca | Broker Integration IBKR/Alpaca | Disponible |
| 011-inv-portfolio-and-performance-analytics | Portfolio and Performance Analytics | Disponible |

**Gaps detectados**: Ninguno. Todos los required skills para `speckit.plan` estan disponibles en el proyecto.

---

## 13. Reporte de Cobertura Canonica (obligatorio)

### Fuente: `teams/TEAM-09/plan.md`

| Seccion Canonica | Estado | Detalle |
|------------------|--------|---------|
| Autoridad (1-5) | **preserved** | Seccion 1 reproduce literal con adicion de spec.md como item 6 |
| Objetivo | **preserved** | Seccion 2 reproduce literal + ampliacion Speckit |
| Fase T09-1: Modelado temporal | **expanded** | Mapeado a modulos termStrategyContract, calendarSpreadEngine, diagonalSpreadEngine |
| Fase T09-2: Calculo y escenarios | **expanded** | Mapeado a termSimulationEngine, termRiskEngine, termRollOrchestrator |
| Fase T09-3: Chat IA y API | **expanded** | Mapeado a APIs, termComparator, termChatAssistant, termReportEngine |
| Fase T09-4: Validacion | **expanded** | Mapeado a tests T196-T198 y estandarizacion T177 |
| Riesgos (2 items canon) | **expanded** | Preservados y expandidos a 6 riesgos con mitigaciones por fase |
| Criterios de Validacion (3 items canon) | **expanded** | Preservados y expandidos con criterios por modulo y tests |
| Integracion con Speckit | **preserved** | Seccion 11 reproduce literal |

### Fuente: `specs/010-team-09-calendar-diagonal/spec.md`

| Seccion Spec Speckit | Estado | Detalle |
|----------------------|--------|---------|
| 8 modulos arquitectonicos | **merged** | Integrados como plan de implementacion por modulo (seccion 5) |
| Diagrama de contexto | **preserved** | Reflejado en grafo de dependencias (seccion 6) |
| Tareas canonicas T162-T169, T177, T196-T198 | **preserved** | Mapeadas a modulos y plan de tests (secciones 4, 5, 5.10) |
| Restricciones tecnicas | **preserved** | Reflejadas en criterios de aceptacion y contratos |
| Supuestos | **preserved** | Reflejados en contratos de integracion |
| Criterios de exito | **preserved** | Reflejados en criterios de validacion |
| Trazabilidad | **preserved** | Reflejada en autoridad y seccion 12 |
| Riesgos R-01 a R-04 | **merged** | Integrados en matriz de riesgos (seccion 7) |
| Contratos de integracion | **preserved** | Reflejados en seccion 9 |
| Gaps G-T09-01 a G-T09-03 | **preserved** | Reflejados en seccion 10 con responsables |

### Resumen de cobertura:

| Categoria | Conteo |
|-----------|--------|
| **preserved** | 12 |
| **expanded** | 6 |
| **merged** | 2 |
| **added (Speckit expansion v2)** | 5 (T199-T203) |
| **added (Speckit expansion v3)** | 3 (T204-T206) |
| **added (Speckit expansion v4)** | 3 (T207-T209) |
| **dropped** | 0 |

**Resultado: SIN GAPS. Todo el contenido canonico de `teams/TEAM-09/plan.md` y `specs/010-team-09-calendar-diagonal/spec.md` esta preservado, expandido o mergeado. No hay omisiones no justificadas. Se agregaron 5 nuevas tareas Speckit (T199-T203) en v2 para cubrir brechas de calidad, 3 nuevas tareas (T204-T206) en v3 para features extendidas (stress tests, forward IV, report extendido), y 3 nuevas tareas (T207-T209) en v4 para enriquecimiento comparativo (griegas Calendar, comparador side-by-side, helpers break-even).**

---

## 14. Ready / Next Steps

- [x] Plan operativo generado con trazabilidad 1:1 al canon Diana
- [x] Modulos mapeados a fases canonicas y tareas
- [x] Grafo de dependencias definido
- [x] Riesgos preservados y expandidos
- [x] Cobertura canonica validada (preserved: 12, expanded: 6, merged: 2, dropped: 0)
- [x] Plan operativo generado con trazabilidad 1:1 al canon Diana (v1)
- [x] Tareas T199-T203 agregadas para cubrir brechas de calidad (v2)
- [x] Tareas T204-T206 agregadas para features extendidas (v3)
- [x] Tareas T207-T209 agregadas para enriquecimiento comparativo (v4)
- [ ] Pendiente: `/diana.integrate action="run" engine="speckit" run_only="tasks"` para generar backlog operativo detallado
- [ ] Pendiente: Resolver G-T09-01, G-T09-02, G-T09-03 antes de implementacion

---

*Este documento fue generado por `speckit.plan` a partir del canon Diana `teams/TEAM-09/plan.md` y el spec Speckit vigente `specs/010-team-09-calendar-diagonal/spec.md`. Cumple con la regla de no-omision: todo el contenido canonico de entrada esta preservado, expandido o mergeado.*
