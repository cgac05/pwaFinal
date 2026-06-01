# Plan de Implementacion: Estrategias Complejas de Opciones TEAM-08 GlassCoke

**Branch**: `009-team-08-estrategias-complejas` | **Fecha**: 2026-05-21 | **Spec**: [spec.md](spec.md)
**Entrada**: Especificacion canonica en [spec.md](spec.md)

## Resumen

Implementar los motores backend de estrategias complejas de opciones para TEAM-08 (GlassCoke), cubriendo Iron Condor, Iron Butterfly, Butterfly Spread y Condor con modelado multi-pata, simulacion (Monte Carlo, deterministica, backtesting), Risk Engine con limites duros y deteccion de asignacion temprana, modulo de visualizacion/reporting, y APIs REST dedicadas con comparador de estrategias. Todo debe respetar el modelo semi-automatico constitucional: las salidas son trazables y reproducibles, y los motores permanecen desacoplados del broker y del frontend.

## Contexto Tecnico

**Language/Version**: TypeScript 5.x en backend; Node.js 22 LTS en API
**Primary Dependencies**: Express, Supabase JS client, JWT, APIs de pricing de opciones, modulo de calculo Monte Carlo
**Storage**: Supabase para configuraciones, resultados de simulacion y eventos de auditoria; retencion minima 365 dias
**Testing**: `npm test` y `npm run lint` en raiz; validacion de TypeScript por workspace
**Target Platform**: REST API (backend puro)
**Project Type**: Modulos backend desacoplados (motores de calculo, APIs, contratos)
**Performance Goals**: simulacion Monte Carlo 10K iteraciones <= 5 segundos; calculo de perfil de payoff <= 500 ms; respuesta de API <= 1 segundo
**Constraints**: control humano obligatorio, IA no ejecuta, resultados reproducibles y auditables, contratos estables de integracion, desacoplado de broker/frontend, comentarios FIC: bilingues en todo codigo nuevo
**Scale/Scope**: 4 estrategias core (Iron Condor, Iron Butterfly, Butterfly Spread, Condor) con variantes; simulacion multi-escenario; Risk Engine con limites configurables

## Constitución Check

*GATE: Debe pasar antes de Phase 0 y revalidarse tras Phase 1.*

### Check Inicial

- Idioma oficial en espanol: **PASS**
- Modelo semi-automatico: **PASS**
- La IA explica pero no ejecuta: **PASS**
- Separacion frontend/backend: **PASS** (motores puramente backend)
- Seguridad con JWT + Supabase RLS + claims: **PASS**
- Auditoria, disclaimer y retencion minima de 365 dias: **PASS**
- Resultados reproducibles y auditables: **PASS**
- Desacoplado de broker y frontend: **PASS**
- Comentarios FIC: bilingues en codigo nuevo (§10 Constitucion): **PENDIENTE** — validar en cierre de cada tarea via checklist en requirements.md

Resultado del gate inicial: **PASS con observacion** (§10 pendiente de validacion en implementacion).

### Re-check Post-Phase 1

- Las salidas de los motores son trazables y reproducibles: **PASS**
- Los contratos de estrategia no dependen de broker ni frontend: **PASS**
- El plan no introduce auto-trading ni bypass de gobernanza: **PASS**

Resultado del re-check: **PASS**.

## Matriz de Trazabilidad FR/SC

<!-- FIC: Traceability matrix mapping each Functional Requirement to Success Criteria,
     User Story, and implementation phase / Matriz de trazabilidad que relaciona cada
     Requisito Funcional con Criterios de Éxito, Historia de Usuario y fase de implementación -->

| Requisito Funcional | Criterio(s) de Éxito | Historia | Fase |
|---|---|---|---|
| FR-001 Contrato base de estrategias complejas | SC-001, SC-008 | US1 | Phase 1 |
| FR-002 Core Iron Condor (short/wide/delta) | SC-001, SC-008 | US1 | Phase 1 |
| FR-003 Core Iron Butterfly (short/broken wing) | SC-001, SC-008 | US1 | Phase 1 |
| FR-004 Core Butterfly Spread (call/put) | SC-001, SC-008 | US1 | Phase 1 |
| FR-005 Core Condor (call/put) | SC-001, SC-008 | US1 | Phase 1 |
| FR-006 Motor de simulacion (Monte Carlo, deterministico, backtesting) | SC-002, SC-008 | US2 | Phase 2 |
| FR-007 Risk Engine (limites, margen, stop-loss, asignacion temprana) | SC-003, SC-006, SC-008 | US3 | Phase 2 |
| FR-008 Modulo de visualizacion y reporting | SC-007, SC-008 | US1/US2 | Phase 3 |
| FR-009 APIs REST dedicadas por estrategia | SC-001, SC-004 | US1/US2 | Phase 3 |
| FR-010 Endpoint comparador de estrategias (2-4 configs) | SC-004, SC-008 | US1 | Phase 3 |
| FR-011 Trazabilidad completa estructura→estrategia→simulacion→decision | SC-005 | Transversal | Phase 3 |
| FR-012 Salidas reproducibles y auditables | SC-001, SC-005 | Transversal | Phase 2-3 |
| FR-013 Desacoplado de broker y frontend | SC-001 | Transversal | Phase 1-2 |
| FR-014 Control de concurrencia (optimistic lock) sobre configuraciones | SC-005 | Transversal | Phase 1 |
| FR-015 Comentarios FIC: bilingues en todo codigo nuevo | SC-008 | Transversal | Phase 1-4 |
| FR-016 Tests automatizados ≥ 80% cobertura en rutas criticas | SC-007 | Transversal | Phase 1-4 |
| FR-017 Ajuste al estandar transversal (naming, estructura, exports) | SC-008 | Transversal | Phase 5 |

### Mapeo Inverso SC → FR(s)

| Criterio de Exito | Requisitos Funcionales que lo satisfacen |
|---|---|
| SC-001 100% estrategias retornan perfiles completos sin errores | FR-001, FR-002, FR-003, FR-004, FR-005, FR-009, FR-014, FR-015 |
| SC-002 Simulacion Monte Carlo 10K <= 5s | FR-006, FR-018 |
| SC-003 Risk Engine bloquea 100% propuestas que exceden limites | FR-007, FR-018 |
| SC-004 Comparador muestra metricas lado a lado sin degradacion | FR-009, FR-010 |
| SC-005 100% eventos de riesgo registrados con trazabilidad | FR-007, FR-011, FR-012, FR-014 |
| SC-006 Visualizacion genera payoff/heatmaps en <= 2s | FR-008, FR-016 |
| SC-007 Cobertura tests >= 80% en modulos core | FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-010, FR-016 |
| SC-008 100% modulos cumplen estandar transversal | FR-015, FR-017 |

---

## Estructura del Proyecto

### Documentacion de la feature

```text
specs/009-team-08-estrategias-complejas/
├── plan.md
├── spec.md
├── research.md            # Pendiente en fases posteriores
├── data-model.md          # Pendiente en fases posteriores
├── quickstart.md          # Pendiente en fases posteriores
└── contracts/             # Pendiente en fases posteriores
```

### Superficie de codigo a crear

```text
projects/rest-api/inversions_api/src/
├── modules/
│   └── strategies/
│       └── complex/
│           ├── complexStrategyContract.ts   # T153: Contrato base
│           ├── ironCondorEngine.ts           # T154: Core Iron Condor
│           ├── ironButterflyEngine.ts        # T155: Core Iron Butterfly
│           ├── butterflySpreadEngine.ts      # T156: Core Butterfly Spread
│           ├── condorEngine.ts               # T157: Core Condor
│           ├── complexSimulationEngine.ts    # T158: Motor de simulacion
│           ├── complexRiskEngine.ts          # T159: Risk Engine
│           └── complexReportEngine.ts        # T160: Visualizacion/reporting
└── routes/
    └── strategies/
        └── complex/
            ├── ironCondor.ts                 # T161: API Iron Condor
            ├── ironButterfly.ts              # T161: API Iron Butterfly
            ├── butterflySpread.ts            # T161: API Butterfly Spread
            ├── condor.ts                     # T161: API Condor
            └── complexComparator.ts          # T161: Comparador

projects/rest-api/inversions_api/tests/
├── unit/
│   └── strategies/
│       └── complex/
│           ├── ironCondorEngine.test.ts      # T193
│           ├── ironButterflyEngine.test.ts   # T193
│           ├── butterflySpreadEngine.test.ts # T193
│           ├── condorEngine.test.ts          # T193
│           ├── complexSimulationEngine.test.ts # T194
│           └── complexRiskEngine.test.ts     # T194
└── integration/
    └── strategies/
        └── complex/
            ├── ironCondor.test.ts            # T195
            ├── ironButterfly.test.ts         # T195
            ├── butterflySpread.test.ts       # T195
            └── condor.test.ts                # T195
```

**Decision de estructura**: no se crean nuevas raices de producto; el trabajo se concentra en la superficie existente bajo `projects/rest-api/inversions_api`, con la documentacion de la feature aislada en `specs/009-team-08-estrategias-complejas/`. Los motores se organizan como modulos desacoplados bajo `modules/strategies/complex/` con sus respectivos endpoints en `routes/strategies/complex/`.

## Enfoque de Implementacion

### 1. Contratos y modelado de estrategias (Phase 1)

- Implementar `complexStrategyContract` como interfaz/base共通 con validacion de inputs (ticker, expiracion, strikes, primas, contratos, tipo de alas, tolerancia de riesgo, estilo de opcion).
- Cada motor (ironCondorEngine, ironButterflyEngine, butterflySpreadEngine, condorEngine) implementa el contrato y expone metodos de calculo de payoff, break-evens, riesgo maximo y perfiles.
- Aplicar optimistic lock sobre configuraciones mediante campo `version` para evitar sobrescritura accidental.
- Todas las salidas deben ser estructuradas y serializables para consumo via API.

### 2. Simulacion y riesgo (Phase 2)

- `complexSimulationEngine`: soportar Monte Carlo (1K-100K iteraciones configurable), escenarios deterministicos con shocks de precio/IV, y backtesting historico sobre datos reales.
- Descontar costos reales (slippage, comisiones, spread) del P&L proyectado.
- `complexRiskEngine`: evaluar limites duros configurables, riesgo de margen, stop-loss automatico y riesgo de asignacion temprana en opciones americanas.
- Exponer kill-switch para desactivar estrategias por perfil de riesgo.

### 3. APIs, visualizacion y comparador (Phase 3)

- Exponer endpoints REST por cada estrategia (`POST /api/strategies/complex/iron-condor`, etc.) que reciben configuracion y retornan perfil completo.
- Endpoint de comparacion (`POST /api/strategies/complex/compare`) que recibe 2-4 configuraciones y retorna tabla comparativa.
- `complexReportEngine`: generar payoff curves, heatmaps P&L y resumen riesgo/beneficio en formato estructurado (JSON) consumible por cualquier UI.

### 4. Estandarizacion transversal (Phase 5)

- Alinear naming, estructura de archivos, export patterns y convenciones de codigo conforme al estandar definido por el canon global (T176).
- Verificar cumplimiento de comentarios FIC: bilingues en todos los modulos nuevos.
- Revision final de cobertura de tests y documentacion.

## Plan de Trabajo

1. Implementar contrato base (`complexStrategyContract`) y motores core (Iron Condor, Iron Butterfly, Butterfly Spread, Condor) con sus tests unitarios.
2. Implementar motor de simulacion (`complexSimulationEngine`) y Risk Engine (`complexRiskEngine`) con tests unitarios y de integracion.
3. Implementar modulo de visualizacion/reporting (`complexReportEngine`) y APIs REST dedicadas por estrategia con comparador.
4. Ejecutar ajuste al estandar transversal, revision FIC, cierre de documentacion y validacion final de cobertura de tests.

## Riesgos y Mitigaciones

| Riesgo | Mitigacion |
|---|---|
| Formulas de pricing de opciones incorrectas (calculos de payoff, break-evens, griegas) | Validar con datos de mercado conocidos y casos borde en tests unitarios; comparar contra calculadoras de opciones de referencia |
| Simulacion Monte Carlo lenta con muchas iteraciones | Optimizar con calculos vectorizados; limite default de 10K iteraciones con opcion a 100K bajo demanda; cache de resultados parciales |
| Riesgo de asignacion temprana mal detectado en opciones americanas | Algoritmo de deteccion basado en profundidad ITM + dividendos prox + ex-date; validar contra datos historicos reales |
| Dependencia de datos de mercado (primas, IV) no disponibles | Modo offline con datos cacheados o simulados; el motor funciona sin datos en vivo |
| Contratos de estrategia incompatibles con consumo por otros equipos | Contrato base desacoplado con serializacion JSON estandar; versionado semantico de contratos |

## Gaps Detectados

- Este plan usa la especificacion detallada como entrada canonica, pero no regenera `research.md`, `data-model.md`, `quickstart.md` ni `contracts/` en esta ejecucion.
- La base de codigo actual aun no contiene los directorios `modules/strategies/complex/` ni `routes/strategies/complex/`; se crearan como parte de la implementacion.
- No existen aun tests de referencia para estrategias complejas; la suite completa se construira desde cero en T193-T195.
- No se ha definido formalmente el catalogo de brokers del cual TEAM-08 consumira datos de mercado; se asume que TEAM-01 expondra los datos necesarios via sus adapters.
