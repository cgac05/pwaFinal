# Spec Quality Checklist: Core de Indicadores Tecnicos + Chat IA (TEAM-02)

**Feature**: 003-team-02-core-indicadores
**Generated**: 2026-05-25
**Audited**: 2026-05-25 (pase 1 — post-clarify) / 2026-05-25 (pase 2 — post-correcciones)
**Source**: `./spec.md` (post `/speckit.clarify` sesion 2026-05-25)
**Owner**: Hansel (lead)
**Convencion**: `[ ]` pendiente, `[x]` cumplido, `[~]` parcial / requiere accion, `N/A` no aplica.

> Objetivo: validar que el spec esta listo para `/speckit.plan` y `/speckit.tasks` sin huecos de definicion. Cada item se responde leyendo el spec, no el codigo.

---

## 1. Requirement Completeness

- [x] **CHK001** Todos los user stories tienen `Why this priority` explicito que justifica P1/P2. *(US1-US6 lo incluyen)*
- [x] **CHK002** Cada user story tiene `Independent Test` que se puede ejecutar sin las demas. *(presentes en US1-US6)*
- [x] **CHK003** Cada FR (FR-001..FR-020) esta mapeado a al menos un user story o success criteria. *(FR-001/002→US1; FR-003/4/5→US2; FR-006→US3; FR-007/11→US4; FR-014..FR-019→US5/US6; FR-008/9/10/12/13/20 infra/cross)*
- [x] **CHK004** Los 5 indicadores tienen FR dedicado con `params default` documentado. *(RSI p=14, MACD 12/26/9, EMA p=20, ADX p=14, BB p=20 σ=2)*
- [x] **CHK005** El endpoint de confluencia (FR-006) define que campos retorna. *(verdict, score, components, inputs_used, computed_at, degraded)*
- [x] **CHK006** El endpoint health (FR-013) especifica que dependencias chequea. *(corregido: FR-013 ahora lista OHLC, Anthropic, Supabase con status individual + regla de 503)*
- [x] **CHK007** Existe FR que cubre el contrato de error uniforme. *(FR-009: `error_code|message|hint`)*
- [x] **CHK008** Existe FR que obliga a publicar OpenAPI por endpoint. *(FR-012)*

## 2. Requirement Clarity (sin ambiguedades)

- [x] **CHK010** Ningun FR contiene `TBD`, `TODO`, `?`, `etc.` o `[NEEDS CLARIFICATION]`. *(verificado en FR-001..FR-020)*
- [x] **CHK011** Cada parametro configurable indica su default explicito. *(ver CHK004)*
- [x] **CHK012** Los timeframes soportados estan listados. *(Assumptions: 1m, 5m, 15m, 1h, 4h, 1d)*
- [x] **CHK013** Los umbrales de ADX estan documentados con valores numericos. *(corregido: US2.2 ahora cita <20, 20-25, 25-50, >=50)*
- [x] **CHK014** `score` de confluencia tiene rango explicito y semantica. *(corregido: FR-006 explicita positivo=alcista/negativo=bajista + umbrales 0.2 para verdict)*
- [x] **CHK015** El termino "degradado" esta definido. *(US3.2 + FR-016: `degraded:true` + lista faltantes)*
- [x] **CHK016** Idioma de respuesta del Chat IA esta especificado. *(Assumptions + Edge Cases)*

## 3. Requirement Consistency

- [x] **CHK020** Los user stories y FRs usan el mismo vocabulario. *(`verdict` = consolidado / `ConfluenceSignalRow` = fila por core, sin colisiones)*
- [x] **CHK021** El reparto operativo coincide con los FRs asignados. *(corregido: tabla extendida con US5/US6/US7 y FR-014..FR-020 repartidos entre Kevin/Edgar/Mauricio/Hansel)*
- [x] **CHK022** Las entidades en `Key Entities` aparecen referenciadas en al menos un FR o user story. *(verificado para las 10 entidades)*
- [x] **CHK023** No hay contradicciones entre `Assumptions` y `Requirements`. *(timeframes asumidos coinciden con los validados)*
- [x] **CHK024** El `Reparto Operativo` cubre el 100% de FRs sin huecos ni solapes. *(corregido junto con CHK021)*
- [x] **CHK025** La `Cobertura Canonica` mapea cada item canonico (RF-*, RNF-*) a un FR o user story. *(RF-001..006 y RNF-001..005 mapeados; FR-014..FR-020 son expansion, no canonicos)*

## 4. Acceptance Criteria Quality

- [x] **CHK030** Todo `Acceptance Scenario` sigue el formato `Given/When/Then`. *(verificado en US1-US6, ~20 escenarios)*
- [x] **CHK031** Cada escenario tiene al menos una assertion concreta. *(no hay "funciona correctamente" generico)*
- [x] **CHK032** Los escenarios de error especifican el cuerpo de respuesta esperado. *(US1.3 cita `{ error_code, message, hint }`)*
- [x] **CHK033** US3 cubre el caso degradado sin fallar el endpoint. *(US3.2)*
- [x] **CHK034** US4 cubre los 3 escenarios constitucionales. *(cita 3+ indicadores, disclaimer, rechazo ejecucion)*
- [x] **CHK035** US3 scenario 3 (idempotencia) es verificable. *(mismo input → mismo output, alineado con SC-003)*

## 5. Scenario Coverage

- [x] **CHK040** Existe al menos 1 escenario de path feliz por cada FR. *(via US1-US6)*
- [x] **CHK041** Existe al menos 1 escenario de error por cada FR que valida input. *(corregido: US6.4 cubre `from>to`/`coresHabilitados=[]`/estrategia desconocida; US5.5 cubre `INVALID_RANGE` y `core` fuera de enum)*
- [x] **CHK042** Hay escenario para `symbol no soportado` (404). *(US1.3)*
- [x] **CHK043** Hay escenario para `parametros invalidos`. *(US1.4)*
- [x] **CHK044** Hay escenario para `N < period requerido` (422 `insufficient_data`). *(Edge Cases)*
- [x] **CHK045** Hay escenario para `auth ausente o invalida`. *(corregido: nuevo US7 con 3 scenarios — 401 AUTH_REQUIRED, 401 AUTH_INVALID, 403 AUTH_FORBIDDEN)*
- [x] **CHK046** Hay escenario para `concurrencia` (cache por `last_bar_ts`). *(Edge Cases + Q5)*

## 6. Edge Case Coverage

- [x] **CHK050** Series OHLC con gaps tienen comportamiento definido. *(no rellena con ceros)*
- [x] **CHK051** Cambio de zona horaria del servidor cubierto. *(UTC con sufijo Z)*
- [x] **CHK052** Chat IA con idioma distinto. *(responde en espanol)*
- [x] **CHK053** Llamadas concurrentes — cache definido. *(clave `last_bar_ts`)*
- [x] **CHK054** Tokens del LLM agotados / rate limit del proveedor Anthropic: manejo definido. *(corregido: Edge Case nuevo — degrada a `degraded:true` con `error_code: LLM_UNAVAILABLE|LLM_RATE_LIMITED`, 2 reintentos con backoff)*
- [x] **CHK055** `chat_explanations` TTL expirado: resiliencia del job definida. *(corregido: Edge Case nuevo — logs estructurados, retry al ciclo siguiente, alerta tras 3 fallos consecutivos)*

## 7. Non-Functional Requirements

- [x] **CHK060** Latencia indicadores y confluencia cuantificada. *(SC-001: <200ms p95; SC-002: <500ms p95)*
- [x] **CHK061** Latencia del chat cuantificada. *(SC-010: <4s p95 con Opus 4.7)*
- [x] **CHK062** Cobertura de tests cuantificada. *(SC-006: ≥80%)*
- [x] **CHK063** Precision numerica vs libreria de referencia cuantificada. *(SC-003: ≤1e-6, 95% casos)*
- [x] **CHK064** Calidad del Chat IA cuantificada. *(SC-004 cita ≥3 indicadores en ≥90%, SC-005 100% disclaimer)*
- [x] **CHK065** Rate limiting cuantificado + respuesta 429 estructurada. *(Q4: 60/10 req/min + cuerpo definido)*
- [x] **CHK066** Politica de cache cuantificada. *(Q5: TTL = duracion de 1 vela)*
- [x] **CHK067** Persistencia Chat IA tiene retencion definida. *(Q3: TTL 90 dias)*

## 8. Dependencies & Assumptions

- [x] **CHK070** Dependencia hacia TEAM-01 explicita. *(Dependencias section + Q2 Bloqueante)*
- [x] **CHK071** Variables de entorno requeridas listadas. *(`ANTHROPIC_API_KEY` en Q1, `RUNTIME_MODE` en Runtime Modes)*
- [x] **CHK072** Workspace destino especificado. *(`projects/rest-api/inversions_api` en Assumptions)*
- [x] **CHK073** Middleware de auth referenciado por path. *(Assumptions)*
- [x] **CHK074** Cores consumidores secundarios listados. *(TEAM-03..09 en Dependencias)*
- [x] **CHK075** Constitution Check referencia los items que aplican. *(formalmente en `plan.md`; el spec tambien los referencia via Cobertura Canonica)*

## 9. Ambiguities & Conflicts (post-clarify)

- [x] **CHK080** Las 5 `[NEEDS CLARIFICATION]` originales tienen resolucion documentada en seccion `Clarifications`.
- [x] **CHK081** Cada resolucion de clarify incluye `Impacto` concreto sobre el codigo. *(Q1-Q4 traen linea de Impacto)*
- [x] **CHK082** El riesgo de latencia Opus 4.7 vs Haiku esta documentado con mitigacion. *(Q1: Riesgo + Mitigacion + SC-010)*
- [x] **CHK083** No quedan `TBD` ni placeholders en el spec post-clarify. *(grep limpio en FR/US/SC)*
- [x] **CHK084** Defaults aplicados sin preguntar (Q5 cache) estan marcados como `decision tecnica` y son reversibles. *(seccion "Defaults aplicados", justificacion "migrar a Redis es trivial")*

## 10. Constitucion & Compliance

- [x] **CHK090** RNF-001 "IA no ejecuta" tiene gate FR. *(FR-011 + FR-019)*
- [x] **CHK091** RNF-002 reproducibilidad tiene escenario verificable. *(US3.3, US6.3, SC-003)*
- [x] **CHK092** RNF-003 desacople frontend tiene reflejo. *(API-first en `Experience & Component Contract`)*
- [x] **CHK093** RNF-004 auditabilidad tiene reflejo. *(FR-008 + tabla `chat_explanations` Q3)*
- [x] **CHK094** RNF-005 latencia interactiva tiene SC concreto. *(SC-001, SC-002)*
- [x] **CHK095** Disclaimer no operativo aparece textual en spec. *(US4.2: "esta explicacion no constituye orden ni recomendacion ejecutable")*
- [x] **CHK096** Persistencia de claves API NO esta en spec. *(Q1 menciona solo el NOMBRE `ANTHROPIC_API_KEY`, no el valor — OK)*

---

## Resultado del pase de auditoria 2026-05-25

### Pase 1 (post-clarify)

35 / 46 `[x]` (76%) — 7 `[~]` + 2 `[ ]` pendientes.

### Pase 2 (post-correcciones, 2026-05-25)

**Estado global**: **46 / 46 `[x]` (100%)** — **spec listo para `/speckit.plan` sin acciones pendientes**.

| Marca | Cantidad | Items |
|---|---|---|
| `[x]` cumplido | 46 | todos |
| `[~]` parcial | 0 | — |
| `[ ]` pendiente | 0 | — |

### Resumen de correcciones aplicadas en pase 2

| Item | Cambio en `spec.md` |
|---|---|
| CHK006 | FR-013 reescrito con dependencias concretas (OHLC, Anthropic, Supabase) + regla 503 |
| CHK013 | US2.2 ahora cita umbrales ADX numericos (<20, 20-25, 25-50, >=50) |
| CHK014 | FR-006 explicita semantica del score y umbrales 0.2 para verdict literal |
| CHK021 + CHK024 | Tabla `Reparto Operativo` extendida con US5/US6/US7 y FR-014..FR-020 |
| CHK041 | US5.5 y US6.4 nuevos (errores `INVALID_RANGE`, `INVALID_SIMULATION_REQUEST`, enum invalido) |
| CHK045 | Nuevo US7 con 3 scenarios de auth (401 AUTH_REQUIRED, 401 AUTH_INVALID, 403 AUTH_FORBIDDEN) |
| CHK054 | Edge Case nuevo: LLM caido/429 -> `degraded:true` + 2 reintentos con backoff |
| CHK055 | Edge Case nuevo: resiliencia del job de purga TTL (retry, alerta tras 3 fallos) |

### Recomendacion final

Spec en estado `Clarified` con todos los items del checklist cerrados. Listo para correr `/speckit.plan` para regenerar el plan con los cambios incorporados (especialmente FR-013 health endpoint, FR-006 verdict thresholds, US7 auth scenarios y los nuevos Edge Cases del LLM/TTL).

## Items recomendados a auditar primero (re-pase futuro)

- **CHK010** (sin `[NEEDS CLARIFICATION]` residuales) — verificar tras cada `clarify`.
- **CHK034** (US4 cubre los 3 escenarios constitucionales) — verificar tras cualquier cambio en FR-011/019.
- **CHK054** (manejo de rate limit del LLM externo) — sigue siendo gap hasta que se cierre.
- **CHK060-CHK067** (NFRs cuantificados) — base para tests de carga y aceptacion.
