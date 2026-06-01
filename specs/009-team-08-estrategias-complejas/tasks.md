# Tasks: Estrategias Complejas de Opciones TEAM-08 GlassCoke

**Input**: Documentos de diseno desde `specs/009-team-08-estrategias-complejas/`
**Prerequisites**: `plan.md`, `spec.md`

**Tests**: Se incluyen tareas de tests automatizados (unit e integration) al final de cada fase, cubriendo modulos core, API endpoints y motores de simulacion/riesgo con cobertura minima del 80% en rutas criticas.

**Organization**: Tareas agrupadas por fase de implementacion para habilitar entrega incremental y validacion independiente.

## Format: `[ID] [P?] [Phase?] Description`

- `[P]`: Puede ejecutarse en paralelo (archivos diferentes, sin dependencia directa)
- `[Phase]`: Fase de implementacion (`[P1]` contratos, `[P2]` simulacion/riesgo, `[P3]` APIs/viz, `[P4]` APIs/viz/comparador, `[P5]` estandar, `[P6]` tests)
- Cada tarea incluye ruta de archivo exacta

## Matriz de Trazabilidad Canonica TEAM-08 → Feature

<!-- FIC: Canonical traceability matrix mapping Diana TEAM-08 global task IDs to feature task IDs,
     preserving functional intention without recycling global IDs literally /
     Matriz de trazabilidad canónica que relaciona IDs globales de Diana TEAM-08 con
     tareas del feature, preservando intención funcional sin reciclar IDs globales. -->

| Diana TEAM-08 (canónico) | Intención Funcional | Tarea(s) Feature |
|---|---|---|
| T153 | Contrato base de estrategias complejas | T004 |
| T154 | Core Iron Condor (short/wide/delta) | T005 |
| T155 | Core Iron Butterfly (short/broken wing) | T006 |
| T156 | Core Butterfly Spread (call/put) | T007 |
| T157 | Core Condor (call/put) | T008 |
| T158 | Motor de simulacion (Monte Carlo, deterministico, backtesting) | T009 |
| T159 | Risk Engine (limites, margen, stop-loss, asignacion temprana) | T010 |
| T160 | Modulo de visualizacion y reporting | T011 |
| T161 | APIs dedicadas + comparador de estrategias | T012, T013, T014, T015, T016 |
| T176 | Ajuste al estandar transversal | T017 |
| T193 | Tests unitarios ironCondorEngine, ironButterflyEngine, butterflySpreadEngine | T018 |
| T194 | Tests unitarios complexSimulationEngine, complexRiskEngine | T019 |
| T195 | Tests de integracion routes/strategies/complex/ | T020 |

### Mapeo Inverso: Speckit → Diana (todos los mappings)

| Tarea Speckit | Tarea(s) Diana TEAM-08 |
|---|---|
| T000 (feature structure + spec) | T038, T040, T055, T058 |
| T001 (plan + traceability) | — |
| T002 (tasks matrix) | — |
| T003 (checklist quality) | — |
| T004 (complexStrategyContract) | T153 |
| T005 (ironCondorEngine) | T154 |
| T006 (ironButterflyEngine) | T155 |
| T007 (butterflySpreadEngine) | T156 |
| T008 (condorEngine) | T157 |
| T009 (complexSimulationEngine) | T158 |
| T010 (complexRiskEngine) | T159 |
| T011 (complexReportEngine) | T160 |
| T012 (API ironCondor) | T161 |
| T013 (API ironButterfly) | T161 |
| T014 (API butterflySpread) | T161 |
| T015 (API condor) | T161 |
| T016 (API complexComparator) | T161 |
| T017 (estandar transversal) | T176 |
| T019 (unit tests core engines) | T193 |
| T020 (unit tests simulation/risk) | T194 |
| T021 (integration tests APIs) | T195 |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar el espacio de feature y baseline documental para ejecucion controlada.

- [X] T000 Definir y documentar la estructura de la feature en `specs/009-team-08-estrategias-complejas/spec.md`, `specs/009-team-08-estrategias-complejas/plan.md` y `specs/009-team-08-estrategias-complejas/checklists/requirements.md`
- [X] T001 Consolidar alcance tecnico y trazabilidad FR/SC en `specs/009-team-08-estrategias-complejas/plan.md`
- [X] T002 Crear matriz de trazabilidad canonica TEAM-08 -> feature en `specs/009-team-08-estrategias-complejas/tasks.md`
- [X] T003 [P] Definir checklist operacional de validacion manual en `specs/009-team-08-estrategias-complejas/checklists/requirements.md`

---

## Phase 2: Contratos y Motores Core (T153-T157)

**Purpose**: Implementar contracto base y los 4 motores de estrategias complejas de opciones.

**Independent Validation**: Cada motor retorna perfiles de payoff completos con break-evens, riesgo maximo y escenarios de sensibilidad sin errores de calculo (SC-001).

- [X] T004 [P] [P1] Implementar contrato base de estrategias complejas con validacion de inputs en `projects/rest-api/inversions_api/src/modules/strategies/complex/complexStrategyContract.ts`
  - Inputs validados: ticker, expiracion, strikes por pata, primas, contratos, tipo de alas (short/wide/broken wing), tolerancia de riesgo, estilo de opcion (europea/americana)
  - Interfaz base para todos los motores
  - Serializacion JSON estandar
  - Campo `version` para optimistic lock

- [X] T005 [P] [P1] Implementar core de Iron Condor (short/wide/delta) en `projects/rest-api/inversions_api/src/modules/strategies/complex/ironCondorEngine.ts`
  - Construccion multi-leg (4 patas)
  - Calculo de credito neto
  - Break-evens superior e inferior
  - Perdida maxima y ganancia maxima
  - Variantes short y wide
  - Perfiles por configuracion de strikes

- [X] T006 [P] [P1] Implementar core de Iron Butterfly (short/broken wing) en `projects/rest-api/inversions_api/src/modules/strategies/complex/ironButterflyEngine.ts`
  - Variantes short y broken wing
  - Calculo de payoff/P&L temporal (T-30, T-15, T-7, T-0)
  - Sensibilidad a desplazamiento del subyacente
  - Desbalance de riesgo lateral en broken wing

- [X] T007 [P] [P1] Implementar core de Butterfly Spread (call/put) en `projects/rest-api/inversions_api/src/modules/strategies/complex/butterflySpreadEngine.ts`
  - Soporte call y put
  - Calculo de debito/credito neto
  - Ventanas optimas de beneficio
  - Escenarios por volatilidad implicita

- [X] T008 [P] [P1] Implementar core de Condor (call/put) en `projects/rest-api/inversions_api/src/modules/strategies/complex/condorEngine.ts`
  - Estructura por patas (4 patas equidistantes)
  - Riesgo por anchura de alas
  - Payoff/P&L temporal
  - Reglas de ajuste

**Checkpoint**: Contrato base + 4 motores core implementados. Validacion via tests unitarios (T019).

---

## Phase 3: Simulacion y Riesgo (T158-T159)

**Purpose**: Implementar motor de simulacion multi-escenario y Risk Engine con limites duros.

**Independent Validation**: Simulacion Monte Carlo 10K iteraciones <= 5s (SC-002). Risk Engine bloquea 100% de propuestas que exceden limites (SC-003).

- [X] T009 [P1] Implementar motor de simulacion para estrategias complejas en `projects/rest-api/inversions_api/src/modules/strategies/complex/complexSimulationEngine.ts`
  - Backtesting historico con datos reales de mercado
  - Monte Carlo configurable (1K-100K iteraciones)
  - Escenarios deterministicos con shocks de precio y volatilidad implicita
  - Costos reales (slippage, comisiones, spread) descontados del P&L
  - Distribucion de P&L, probabilidad de exito, drawdown
  - Resultados reproducibles (misma seed = mismos resultados)

- [X] T010 [P1] Implementar Risk Engine para estrategias complejas en `projects/rest-api/inversions_api/src/modules/strategies/complex/complexRiskEngine.ts`
  - Limites duros configurables (margen, riesgo maximo, perdida maxima)
  - Alertas de margen
  - Stop-loss automatico con notificacion
  - Deteccion de riesgo de asignacion temprana en opciones americanas ITM
  - Kill-switch para desactivar estrategias por perfil de riesgo
  - Registro de auditoria por cada evento de riesgo

**Checkpoint**: Simulacion y Risk Engine implementados. Validacion via tests unitarios (T020).

---

## Phase 4: APIs, Visualizacion y Comparador (T160-T161)

**Purpose**: Exponer APIs REST, modulo de visualizacion/reporting y endpoint comparador.

**Independent Validation**: APIs retornan perfiles completos (SC-001). Comparador muestra metricas lado a lado (SC-004).

- [X] T011 [P] [P2] Implementar modulo de visualizacion y reporting en `projects/rest-api/inversions_api/src/modules/strategies/complex/complexReportEngine.ts`
  - Payoff curves (P&L vs precio subyacente)
  - Heatmaps P&L (precio subyacente vs tiempo)
  - Velas anotadas con puntos de entrada/salida
  - Drawdown y resumen riesgo/beneficio
  - Exportacion a formato estructurado JSON

- [X] T012 [P] [P2] Implementar API REST de Iron Condor en `projects/rest-api/inversions_api/src/routes/strategies/complex/ironCondor.ts`
  - Endpoint: `POST /api/strategies/complex/iron-condor`
  - Recibe configuracion, retorna perfil completo + simulacion + riesgo
  - Validacion JWT y roles

- [X] T013 [P] [P2] Implementar API REST de Iron Butterfly en `projects/rest-api/inversions_api/src/routes/strategies/complex/ironButterfly.ts`
  - Endpoint: `POST /api/strategies/complex/iron-butterfly`
  - Recibe configuracion, retorna perfil completo + simulacion + riesgo

- [X] T014 [P] [P2] Implementar API REST de Butterfly Spread en `projects/rest-api/inversions_api/src/routes/strategies/complex/butterflySpread.ts`
  - Endpoint: `POST /api/strategies/complex/butterfly-spread`
  - Recibe configuracion, retorna perfil completo + simulacion + riesgo

- [X] T015 [P] [P2] Implementar API REST de Condor en `projects/rest-api/inversions_api/src/routes/strategies/complex/condor.ts`
  - Endpoint: `POST /api/strategies/complex/condor`
  - Recibe configuracion, retorna perfil completo + simulacion + riesgo

- [X] T016 [P] [P2] Implementar endpoint comparador de estrategias en `projects/rest-api/inversions_api/src/routes/strategies/complex/complexComparator.ts`
  - Endpoint: `POST /api/strategies/complex/compare`
  - Recibe 2-4 configuraciones de estrategia
  - Retorna tabla comparativa con metricas lado a lado (probabilidad de exito, riesgo maximo, rendimiento esperado, requisitos de margen, theta, vega, break-even spread)
  - Highlight de mejor opcion por metrica

**Checkpoint**: APIs REST y comparador implementados. Validacion via tests de integracion (T020).

---

## Phase 5: Estandarizacion Transversal (T176)

**Purpose**: Alinear todos los modulos de TEAM-08 al estandar transversal del proyecto.

**Independent Validation**: 100% de modulos cumplen estandar de naming, estructura, exports y convenciones FIC (SC-008).

- [X] T017 [P4] Ejecutar ajuste al estandar transversal sobre todos los modulos de TEAM-08 en:
  - `projects/rest-api/inversions_api/src/modules/strategies/complex/`
  - `projects/rest-api/inversions_api/src/routes/strategies/complex/`
  - `projects/rest-api/inversions_api/tests/unit/strategies/complex/`
  - `projects/rest-api/inversions_api/tests/integration/strategies/complex/`
  
  **Alcance del ajuste**:
  - Alineacion de naming de archivos, funciones y variables con convencion del proyecto
  - Estructura de archivos y directorios conforme al estandar
  - Export patterns consistentes (named exports, interfaces primero)
  - Comentarios `FIC:` bilingues ingles/espanol en modulos, funciones publicas, logica critica e integraciones (FR-015)
  - Validacion de que no existen dependencias circulares ni imports incorrectos
  - Consistencia de tipos y contratos entre modulos

**Checkpoint**: Modulos alineados al estandar transversal. Validacion via checklist en requirements.md.

---

## Phase 6: Tests Automatizados (T193-T195)

**Purpose**: Garantizar cobertura minima del 80% en rutas criticas y validacion de integracion de APIs.

- [X] T018 [P] [P5] Tests unitarios para motores core en `projects/rest-api/inversions_api/tests/unit/strategies/complex/`
  - `ironCondorEngine.test.ts` — credito neto, break-evens, perdida/ganancia maxima, variantes short/wide
  - `ironButterflyEngine.test.ts` — short/broken wing, payoff temporal, sensibilidad
  - `butterflySpreadEngine.test.ts` — call/put, debito/credito neto, ventanas de beneficio
  - `condorEngine.test.ts` — estructura por patas, riesgo por anchura, payoff temporal

- [X] T019 [P] [P5] Tests unitarios para motores de simulacion y riesgo en `projects/rest-api/inversions_api/tests/unit/strategies/complex/`
  - `complexSimulationEngine.test.ts` — Monte Carlo, deterministico, backtesting, costos reales, reproducibilidad
  - `complexRiskEngine.test.ts` — limites duros, margen, stop-loss, asignacion temprana, kill-switch

- [X] T020 [P] [P5] Tests de integracion para APIs REST en `projects/rest-api/inversions_api/tests/integration/strategies/complex/`
  - `ironCondor.test.ts` — endpoint recibe config, retorna perfil completo
  - `ironButterfly.test.ts` — endpoint recibe config, retorna perfil completo
  - `butterflySpread.test.ts` — endpoint recibe config, retorna perfil completo
  - `condor.test.ts` — endpoint recibe config, retorna perfil completo
  - `complexComparator.test.ts` — comparacion 2-4 estrategias, metricas lado a lado

**Nota**: Ejecutar `npm test -- --coverage` al finalizar para validar umbral minimo 80% en modulos core (SC-007).

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): inicia sin dependencias.
- Contratos y Motores Core (Phase 2): depende de Setup.
- Simulacion y Riesgo (Phase 3): depende de Phase 2 (consume contratos).
- APIs, Visualizacion y Comparador (Phase 4): depende de Phase 2-3 (consume motores + simulacion + riesgo).
- Estandarizacion Transversal (Phase 5): depende de Phase 2-4 (ejecuta sobre codigo existente).
- Tests (Phase 6): depende de Phase 2-4 (prueba los modulos implementados).

### Parallel Opportunities

- Phase 2: T004, T005, T006, T007, T008 en paralelo (contrato base primero, luego motores en paralelo).
- Phase 3: T009 y T010 en paralelo (simulacion y riesgo son independientes).
- Phase 4: T011-T016 en paralelo (report engine + APIs).
- Phase 6: T018 y T019 en paralelo; T020 despues de T018.

---

## Implementation Strategy

### Incremental Delivery

1. Completar Phase 1 (Setup).
2. Completar Phase 2 (Contratos + 4 motores core).
3. Completar Phase 3 (Simulacion + Riesgo).
4. Completar Phase 4 (APIs + Visualizacion + Comparador).
5. Ejecutar Phase 5 (Estandarizacion transversal).
6. Cerrar con Phase 6 (Tests y cobertura).

### Parallel Team Strategy

1. Equipo completo en Phase 1-2.
2. Luego por frente:
   - Dev A: contratos + Iron Condor + Iron Butterfly (T004, T005, T006)
   - Dev B: Butterfly Spread + Condor + Simulacion (T007, T008, T009)
   - Dev C: Risk Engine + APIs + Comparador (T010, T012-T016)
3. Integracion final en Phase 4-5.

---

## Notes

- Todas las tareas usan formato estricto de checklist.
- La trazabilidad canonica TEAM-08 se preserva por intencion funcional, no por reciclaje literal de IDs globales.
- Si aparece conflicto entre implementacion actual y canon, prevalece constitucion + canon global + spec del feature.
- Las tareas T038, T040, T055 y T058 del canon global ya estan completadas en fases anteriores del proyecto; no se incluyen en este tasks.md.
