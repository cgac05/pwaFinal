# Feature Speckit: Calendar Spread & Diagonal Spread
## TEAM-09 — SquadISC

<!--
  ARCHIVO: spec.md — Especificacion Speckit para TEAM-09
  GENERADO POR: speckit.specify (via /diana.integrate)
  CANON DE ENTRADA: teams/TEAM-09/spec.md (Diana)
  PROPOSITO: Define el alcance, modulos, tareas, contratos y riesgos del feature.
  CONSUMIDO POR: speckit.plan (genera plan.md), speckit.tasks (genera tasks.md),
                  speckit.implement (guia implementacion), TEAM-09 (desarrollo)
-->
**Proyecto**: diana-inversions
**Iniciativa**: 001-inversions
**Equipo**: TEAM-09 (SquadISC)
**Engine**: speckit
**Etapa**: specify
**Idioma**: es
**Generado desde**: /diana.integrate action="run" engine="speckit" project="diana-inversions" initiative="001-inversions" team="TEAM-09" run_only="specify" language="es"
**Canon de entrada**: teams/TEAM-09/spec.md
**Version**: 1.2
**Estado**: Draft Speckit

---

## 1. Descripcion del Feature

Implementar el modelado, calculo, simulacion y exposition de las estrategias de opciones **Calendar Spread** y **Diagonal Spread** en sus variantes **call** y **put**, con un asistente Chat IA que explique el proposito, riesgo y condiciones de uso de cada estructura temporal.

Este feature es el slice operativo del equipo TEAM-09 dentro de la iniciativa 001-inversions, en topologia multi-equipo.

<!--
  SECCION 2-3: Requerimientos Funcionales y No Funcionales
  FUENTE: Canon Diana (teams/TEAM-09/spec.md)
  PROPOSITO: Define RF-001 a RF-006 (funcional) y RNF-001 a RNF-006 (no funcional).
  Trazabilidad directa: RF-001..RF-005 -> T162-T169; RF-004 -> S-T09-C01; RNF-006 -> T196-T198,T202,T203
-->

## 2. Requerimientos Funcionales (desde canon Diana)

| ID Canonico | Descripcion | Prioridad |
|-------------|-------------|-----------|
| RF-001 | Implementar contratos para modelar estrategias Calendar Spread y Diagonal Spread | Alta |
| RF-002 | Cubrir variantes call y put de ambas estructuras | Alta |
| RF-003 | Exponer escenarios de riesgo, tiempo y sensibilidad para cada estrategia | Alta |
| RF-004 | Integrar un Chat IA para explicar el proposito, riesgo y condiciones de uso | Media |
| RF-005 | Publicar salidas estructuradas para consumo por otros equipos y Speckit | Alta |
| RF-006 | Mantener trazabilidad entre estructura temporal, estrategia y decision sugerida | Alta |
| RF-007 | Implementar escenarios de stress test en engines (crash, rally, IV expansion/contraction) para evaluar comportamiento en condiciones extremas de mercado | Media |
| RF-008 | Implementar estimador forward IV para pricing preciso de la pata larga en Calendar/Diagonal Spread | Media |
| RF-009 | Generar probability cone y metricas extendidas (CVaR, stress P&L) en el reporte estructurado | Media |

---

## 3. Requerimientos No Funcionales (desde canon Diana)

| ID Canonico | Descripcion | Criticidad |
|-------------|-------------|------------|
| RNF-001 | La IA no ejecuta operaciones y no sustituye el juicio humano | Critica |
| RNF-002 | Las estructuras deben ser reproducibles y auditables | Alta |
| RNF-003 | Las estrategias deben permanecer desacopladas del broker y del frontend | Alta |
| RNF-004 | La salida debe ser clara para validacion humana y lectura operativa | Alta |
| RNF-005 | El componente debe conservar contratos estables de integracion | Alta |
| RNF-006 | Cada modulo o historia de usuario implementada DEBE contar con tests automatizados (unit e integration) que cubran la logica de negocio critica, los contratos de API y los flujos de error, con cobertura minima del 80% en rutas criticas | Alta |

<!--
  SECCION 4: Arquitectura de Modulos
  FUENTE: Speckit expansion desde canon Diana
  PROPOSITO: Describe los 9 modulos a implementar. Cada modulo tiene su archivo .ts
  y su tarea asociada (T162-T169, S-T09-C01).
  MAPEO: T162(termStrategyContract) -> T163(calendarSpreadEngine) -> T164(diagonalSpreadEngine)
         -> T165(termSimulationEngine) -> T166(termRiskEngine) -> T169(termRollOrchestrator)
         -> T167(termReportEngine) -> T168(3 endpoints REST) -> S-T09-C01(termChatAssistant)
  NOTA: termUtils.ts NO aparece en spec.md pero fue creado como utilidad compartida
-->

## 4. Arquitectura de Modulos (Speckit expansion)

### 4.1 Modulo de Contratos Base
- `termStrategyContract.ts` — Contrato base Calendar/Diagonal con inputs por pata (strikes, expiraciones cercanas/lejana, primas, contratos), validacion de consistencia temporal y estilo de opcion

### 4.2 Motores de Estrategia
- `calendarSpreadEngine.ts` — Core de Calendar Spread (call/put) con modelado de theta, vencimiento corto/largo, impacto de term structure IV y escenarios de precio
- `diagonalSpreadEngine.ts` — Core de Diagonal Spread (call/put) con combinacion strike+tiempo, sensibilidad de griegas, perfiles de riesgo y ventanas de ajuste

### 4.3 Motor de Simulacion Temporal
- `termSimulationEngine.ts` — Backtesting, Monte Carlo/escenarios deterministicos y proyeccion de payoff/P&L en tiempo real

### 4.4 Motor de Riesgo
- `termRiskEngine.ts` — Limites por vencimiento, riesgo de asignacion, reglas de stop-loss y alertas push/email

### 4.5 Visualizacion y Reporting
- `termReportEngine.ts` — Curvas de payoff, superficies tiempo-precio-IV y metricas riesgo/beneficio auditables

### 4.6 APIs de Exposicion
- `calendarSpread.ts` — API REST para Calendar Spread
- `diagonalSpread.ts` — API REST para Diagonal Spread
- `termComparator.ts` — Comparador Calendar vs Diagonal para recomendacion segun contexto

### 4.7 Orquestador de Gestion Temporal
- `termRollOrchestrator.ts` — Reglas de roll/ajuste, cierre anticipado y control de deterioro temporal

### 4.8 Chat IA Explicativo
- `termChatAssistant.ts` — Integracion con Chat IA para explicar el proposito, riesgo y condiciones de uso de cada estructura temporal

### 4.9 Forward IV Utility
- `termUtils.ts` — Funcion `estimateForwardIv()` que calcula la volatilidad forward implicita entre dos tenores usando `sqrt((IV₂²·T₂ − IV₁²·T₁) / (T₂−T₁))`, mejorando el pricing de la pata larga cuando se provee curva IV. Incluye fallback conservador cuando la formula produce numerador negativo (extrema backwardation)
- Impacto directo en RF-008 y en la precision del pricing en calendarSpreadEngine y diagonalSpreadEngine

### 4.10 Stress Tests en Engines
- `calendarSpreadEngine.ts` — Generacion de 5 escenarios de stress predefinidos (Market Crash, Sharp Rally, IV Expansion, IV Contraction, Volatility Spike) con label, descripcion, precio estimado, P&L y cambios en IV por escenario
- `diagonalSpreadEngine.ts` — Mismos 5 escenarios de stress con reporte adicional de las 4 griegas (delta, gamma, theta, vega) por escenario
- Las salidas de stress tests se integran en `termReportEngine.ts` como parte de `StructuredReport.stressTests`
- Impacto directo en RF-007 y RF-009

---

## 5. Diagrama de Contexto (Speckit expansion)

```
[Market Data] --> [termStrategyContract]
                        |
            +-----------+-----------+
            |                       |
   [calendarSpreadEngine]  [diagonalSpreadEngine]
   (stressTests)            (stressTests + Greeks)
            |                       |
            +-----------+-----------+
                        |
              [termSimulationEngine]
                        |
                  [termRiskEngine]
                        |
            +-----------+-----------+
            |                       |
   [termReportEngine]    [termRollOrchestrator]
   (probabilityCone,     |
    stressTests,         |
    CVaR/metrics)        |
            +-----------+-----------+
                        |
                  [API Layer]
            (calendarSpread, diagonalSpread, termComparator)
                        |
                  [Chat IA Explicativo]
                        |
              [Consumo Frontend / Otros Equipos]

        [termUtils (shared utility)]
         (estimateForwardIv)
```

<!--
  SECCION 6: Tareas Canonicas Asociadas
  FUENTE: Canon Diana teams/TEAM-09/tasks.md + adiciones Speckit v2
  PROPOSITO: Lista completa de tareas del feature, incluyendo las 9 canonicas (T162-T169, T177),
  las canonicas de tests (T196-T198) y las 5 adiciones Speckit v2 (T199-T203).
  NOTA: Las tareas T199-T203 fueron detectadas durante auditoria de calidad posterior
  a la implementacion inicial y completadas en la implementacion.
  Las tareas T204-T206 son adiciones Speckit v3 para features extendidas (stress tests,
  forward IV estimator, report extendido).
-->

## 6. Tareas Canonicas Asociadas (desde teams/TEAM-09/tasks.md)

| ID | Descripcion | Modulo |
|----|-------------|--------|
| T162 | Definir contrato base Calendar/Diagonal | termStrategyContract.ts |
| T163 | Implementar core de Calendar Spread (call/put) | calendarSpreadEngine.ts |
| T164 | Implementar core de Diagonal Spread (call/put) | diagonalSpreadEngine.ts |
| T165 | Implementar motor de simulacion temporal | termSimulationEngine.ts |
| T166 | Implementar Risk Engine Calendar/Diagonal | termRiskEngine.ts |
| T167 | Implementar modulo de visualizacion y reporting | termReportEngine.ts |
| T168 | Implementar APIs dedicadas y comparador | termComparator.ts |
| T169 | Implementar orquestador de gestion temporal | termRollOrchestrator.ts |
| T177 | Ejecutar ajuste al estandar transversal | Estandarizacion |
| T196 | Tests unitarios calendar/diagonal engines | Tests |
| T197 | Tests unitarios simulacion y orquestador | Tests |
| T198 | Tests de integracion para routes | Tests |
| T199 | Documentacion OpenAPI/Swagger para endpoints Term | calendarSpread.ts, diagonalSpread.ts, termComparator.ts |
| T200 | Validacion de fechas en contrato base (Invalid Date, fechas pasadas) | termStrategyContract.ts |
| T201 | Monte Carlo default en APIs + UI en term-verify.html | calendarSpread.ts, diagonalSpread.ts, term-verify.html |
| T202 | Cobertura tests termChatAssistant ≥80% | termChatAssistant.test.ts |
| T203 | Cobertura tests termReportEngine branch ≥80% | termReportEngine.test.ts |
| T204 | Implementar stress tests en engines (5 escenarios predefinidos) | calendarSpreadEngine.ts, diagonalSpreadEngine.ts |
| T205 | Implementar estimador forward IV para pricing de pata larga | termUtils.ts |
| T206 | Extender report engine con probability cone y metricas CVaR/stress P&L | termReportEngine.ts |
| T207 | Enriquecer CalendarSpreadEngine con griegas delta, gamma, vega completas | calendarSpreadEngine.ts |
| T208 | Expandir endpoint comparador (termComparator) con 3 bloques side-by-side (Capital & Risk, Greeks, DTE) | termComparator.ts |
| T209 | Agregar helpers estáticos calculateBreakEvens y calculateNetCost en termReportEngine | termReportEngine.ts |

<!--
  SECCION 7-9: Restricciones, Supuestos, Criterios de Exito
  FUENTE: Canon Diana
  PROPOSITO: Definen los limites del feature: no auto-trading, topologia multi_team,
  alcance limitado a Calendar/Diagonal, IA solo explicativa (RNF-001).
-->

## 7. Restricciones Tecnicas (desde canon Diana)

- Se mantiene la arquitectura semi-automatica constitucional
- No se permite auto-trading
- No se modifican los artefactos canonicos globales (001-inv-spec.md, 001-inv-plan.md, 001-inv-tasks.md)
- El alcance de TEAM-09 se limita a estrategias temporales Calendar y Diagonal
- La IA solo explica y contextualiza, no autoriza ejecucion

---

## 8. Supuestos (desde canon Diana)

- La topologia activa de la iniciativa es multi_team
- TEAM-09 consume contratos de mercado y puede compartir contexto con otros cores
- Existen contratos comunes de persistencia y evidencia definidos por el canon global
- El Chat IA solo explica y contextualiza, no autoriza ejecucion

---

## 9. Criterios de Exito (desde canon Diana)

- Las estrategias Calendar y Diagonal se modelan con escenarios claros y trazables
- El Chat IA puede explicar por que una estructura temporal aplica o no
- Las salidas permiten validacion humana antes de cualquier intento de operacion
- El alcance del equipo no invade dominios de volatilidad, noticias o broker
- Las salidas pueden integrarse con Speckit sin perder la autoridad canonica

<!--
  SECCION 10: Trazabilidad
  FUENTE: Canon Diana
  PROPOSITO: Conecta este spec con la constitucion, UCC y scope_primario de la iniciativa.
  RELACION: Se vincula con 001-INV-UCC (cambio), scope_primario.md y 001-inv-spec.md.
-->

## 10. Trazabilidad (desde canon Diana)

- **Principios constitucionales**: modelo semi-automatico obligatorio, control humano explicito, arquitectura por cores desacoplados, senales explicables y trazables
- **UCC de origen**: 001-INV-UCC
- **Fuente de division funcional**: scope_primario.md
- **Relacion con canon global**: derivada de 001-inv-spec.md

<!--
  SECCION 11-12: Riesgos y Contratos de Integracion
  FUENTE: Speckit expansion
  PROPOSITO: R-01 a R-04 documentan riesgos del modelado temporal.
  Contratos de entrada: auth-context, broker-adapter, signal-lifecycle (consumidos por TEAM-09).
  Contratos de salida: API REST JSON + metricas theta para TEAM-01.
-->

## 11. Riesgos Identificados (Speckit expansion)

| Riesgo | Descripcion | Mitigacion |
|--------|-------------|------------|
| R-01 | Parametrizacion temporal incorrecta | Contratos robustos y pruebas unitarias |
| R-02 | Salidas ambiguas para validacion humana | Explicabilidad y supuestos visibles en cada salida |
| R-03 | Dependencia de datos de mercado no disponibles | Contratos desacoplados con validacion de existencia |
| R-04 | Complejidad de modelado de IV term structure | Documentacion de supuestos por mercado |

---

## 12. Contratos de Integracion (Speckit expansion)

### Contratos de entrada:
- `auth-context.md` — Contexto de autenticacion
- `broker-adapter.md` — Adaptador de broker para datos de mercado
- `signal-lifecycle.md` — Ciclo de vida de senales

### Contratos de salida:
- API REST con respuestas JSON estructuradas para consumo por frontend y otros equipos
- Formato de metricas de theta decay y sensibilidad temporal para UI consolidada

<!--
  SECCION 13: Gaps
  FUENTE: team-agent-bootstrap.md
  PROPOSITO: 3 gaps pendientes de coordinar con Riesgo Institucional y TEAM-01.
  ESTADO: Los gaps NO bloquean la funcionalidad actual, solo la afinacion para produccion.
-->

## 13. Gaps y Decisiones Pendientes (desde team-agent-bootstrap.md)

| Gap | Descripcion | Estado |
|-----|-------------|--------|
| G-T09-01 | Definir supuestos de modelado de curva temporal e IV term structure por mercado | Pendiente (parcialmente mitigado por T205 forward IV estimator) |
| G-T09-02 | Validar reglas de roll (calendario, triggers, costos) con politica de riesgo institucional | Pendiente |
| G-T09-03 | Acordar formato de metricas de theta decay y sensibilidad temporal para UI consolidada | Pendiente |

---

*Este documento fue generado por speckit.specify a partir del canon Diana `teams/TEAM-09/spec.md`. Cumple con la regla de no-omision: todo el contenido canonico de entrada esta preservado, expandido o mergeado. Ver reporte de cobertura para detalle.*
