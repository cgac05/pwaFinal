# Tasks: Dashboard de Brokers TEAM-01

**Input**: Documentos de diseno desde `specs/002-team-01-dashboard-brokers/`
**Prerequisites**: `plan.md`, `spec.md`

**Tests**: Se incluyen tareas de tests automatizados (unit e integration) al final de cada historia de usuario, cubriendo servicios backend, endpoints y componentes React criticos con cobertura minima del 80% en rutas de decision, concurrencia y auditoria.

**Organization**: Tareas agrupadas por historia de usuario para habilitar implementacion y validacion independiente.

## Format: `[ID] [P?] [Story?] Description`

- `[P]`: Puede ejecutarse en paralelo (archivos diferentes, sin dependencia directa)
- `[Story]`: Historia de usuario (`[US1]`, `[US2]`, `[US3]`)
- Cada tarea incluye ruta de archivo exacta

## Matriz de Trazabilidad Canonica TEAM-01 → Feature

<!-- FIC: Canonical traceability matrix mapping Diana TEAM-01 global task IDs to feature task IDs,
     preserving functional intention without recycling global IDs literally /
     Matriz de trazabilidad canónica que relaciona IDs globales de Diana TEAM-01 con
     tareas del feature, preservando intención funcional sin reciclar IDs globales. -->

| Diana TEAM-01 (canónico) | Intención Funcional | Tarea(s) Feature |
|---|---|---|
| T059 | Cliente Supabase compartido | T004 |
| T060 | Patrón base de repositorios | T005 |
| T061 | Migración baseline operativa | T006, T048 |
| T062 | Script de rollback baseline | T007 |
| T063 | Dashboard principal con filtros | T012, T039, T040 |
| T064 | Selector de cores activables | T013, T040 |
| T065 | Overlay de señales por core/confluencia | T014, T040 |
| T066 | Tabla de explicabilidad score/confidence | T015, T040 |
| T067 | Endpoint orquestador de vista consolidada | T016, T017 |
| T068 | Integración broker desacoplada con errores | T023 |
| T170 | Estándar transversal de output de estrategia | T011 |
| T022 | Servicio de señal confluente | T017 |
| T023 | Historial de señales | T028, T029 |
| T024 | API de señales frontend | T018 |
| T026 | Optimistic lock por `version` | T020, T041, T046 |
| T027 | Auditoría de ejecución y conflicto | T021, T046 |
| T028 | Bloqueo sin decisión humana válida | T022 |
| T029 | Respuesta explícita de restricción operativa | T024 |
| T030 | Respuesta explícita de bloqueo de ejecución | T025 |
| T031 | Métricas de historial y correlación | T031, T047 |
| T032 | Página de historial auditado | T032 |
| T033 | Timeline cronológico de eventos | T033 |
| T034 | Política de retención mínima 365 días | T034 |
| T035 | Métricas SLO de observabilidad | T035, T047 |
| T036 | Modo degradado y bloqueo por broker | T036, T047 |
| T041 | Tests unitarios de señales | T039 |
| T042 | Tests de componentes dashboard | T040 |

### Mapeo Inverso: Speckit → Diana (todos los mappings)

| Tarea Speckit | Tarea(s) Diana TEAM-01 |
|---|---|
| T000 (monorepo structure) | T000 |
| T039 (tests confluenceEngine/signalApi) | T063 |
| T040 (tests componentes dashboard) | T064, T065, T066 |
| T041 (tests approvalService/executionAudit) | T026 |
| T042 (tests integration approve/execute) | T031, T032 |
| T043 (tests historyService) | T041 |
| T044 (tests audit routes) | T042 |
| T045 (coverage report ≥ 80%) | T056 |
| T046 (tests executionService/failureRecovery) | T027, T033 |
| T047 (test SLA observabilidad) | T036 |
| T048 (migración context_snapshot) | T061 |
| T049 (validación FIC: comments) | T057 |

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar el espacio de feature y baseline documental para ejecucion controlada.

- [X] T000 Definir y documentar la estructura canónica del monorepo bajo `projects/packages`, `projects/pwa` y `projects/rest-api`, incluyendo criterios de reutilización, ownership por categoría y reglas de dependencia en `.drfic/diana-sdk/projects/diana-inversions/initiatives/001-inversions/monorepo-structure.md`
- [X] T001 Consolidar alcance tecnico y trazabilidad FR/SC en `specs/002-team-01-dashboard-brokers/plan.md`
- [X] T002 Crear matriz de trazabilidad canonica TEAM-01 -> feature en `specs/002-team-01-dashboard-brokers/tasks.md`
- [X] T003 [P] Definir checklist operacional de validacion manual en `specs/002-team-01-dashboard-brokers/checklists/requirements.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura bloqueante que debe completarse antes de cualquier historia.

**CRITICAL**: Ninguna historia puede iniciar sin esta fase.

- [X] T004 Implementar cliente Supabase compartido en `projects/rest-api/rest_api_inversions_drfic/src/database/supabase/client.ts`
- [X] T005 [P] Crear patron base de repositorios en `projects/rest-api/rest_api_inversions_drfic/src/repositories/baseRepository.ts`
- [X] T006 [P] Crear migracion baseline operativa en `projects/rest-api/rest_api_inversions_drfic/src/database/supabase/migrations/001_baseline_operativa.sql`
- [X] T007 [P] Crear script de rollback baseline en `projects/rest-api/rest_api_inversions_drfic/src/database/supabase/migrations/001_baseline_operativa.rollback.sql`
- [X] T008 Implementar validador de entorno en `projects/rest-api/rest_api_inversions_drfic/src/config/envValidator.ts`
- [X] T009 Implementar bootstrap de entorno seguro en `projects/rest-api/rest_api_inversions_drfic/src/config/environment.ts`
- [X] T010 Ajustar enforcement de claims/RLS sin duplicar permisos de frontend en `projects/rest-api/rest_api_inversions_drfic/src/middleware/authContext.ts`
- [X] T011 [P] Definir contrato transversal de outputs de estrategia en `projects/rest-api/rest_api_inversions_drfic/src/modules/strategies/standards/strategyOutputStandard.ts`

**Checkpoint**: Base de persistencia, gobernanza de acceso y contrato transversal listos.

---

## Phase 3: User Story 1 - Monitorear confluencia operativa (Priority: P1) MVP

**Goal**: Entregar tablero consolidado de confluencia por activo y broker con evidencia operativa.

**Independent Test**: Un operador abre tablero, revisa recomendacion con evidencia y emite decision humana trazable sin depender de otras historias.

### Implementation for User Story 1

- [ ] T012 [P] [US1] Crear dashboard principal con filtros de instrumento/tiempo en `projects/pwa/inversions_app/src/features/dashboard/MainDashboard.tsx`
- [ ] T013 [P] [US1] Implementar selector de cores activables en `projects/pwa/inversions_app/src/features/dashboard/CoreSelector.tsx`
- [ ] T014 [P] [US1] Implementar overlay de senales por core y confluencia en `projects/pwa/inversions_app/src/features/dashboard/SignalOverlay.tsx`
- [ ] T015 [P] [US1] Implementar tabla de explicabilidad con score/confidence/source en `projects/pwa/inversions_app/src/features/dashboard/ExplainabilityTable.tsx`
- [ ] T016 [US1] Construir endpoint orquestador de vista consolidada en `projects/rest-api/rest_api_inversions_drfic/src/routes/dashboard/orchestrator.ts`
- [ ] T017 [US1] Integrar servicio de confluencia para payload del tablero en `projects/rest-api/rest_api_inversions_drfic/src/modules/signals/confluenceEngine.ts`
- [ ] T018 [US1] Integrar consumo frontend del orquestador en `projects/pwa/inversions_app/src/services/signals/signalApi.ts`
- [ ] T019 [US1] Reforzar visualizacion de evidencia de recomendacion en `projects/pwa/inversions_app/src/features/signals/SignalEvidencePanel.tsx`

**Checkpoint**: US1 funcional y validable de forma independiente.

### Tests for User Story 1

- [ ] T039 [P] [US1] Tests unitarios para confluenceEngine y signalApi en `projects/rest-api/rest_api_inversions_drfic/tests/unit/signals/confluenceEngine.test.ts` y `projects/rest-api/rest_api_inversions_drfic/tests/unit/signals/signalApi.test.ts`
- [ ] T040 [P] [US1] Tests de componentes React para MainDashboard, CoreSelector, SignalOverlay y ExplainabilityTable en `projects/pwa/inversions_app/tests/components/dashboard/`

---

## Phase 4: User Story 2 - Aprobar o rechazar con control humano (Priority: P2)

**Goal**: Garantizar decision humana explicita, bloqueo por permisos y manejo de concurrencia por version.

**Independent Test**: Un aprobador autorizado decide una recomendacion (aprobar/rechazar), queda evento auditable, y un intento concurrente no autorizado/conflictivo se bloquea.

### Implementation for User Story 2

- [ ] T020 [P] [US2] Implementar optimistic lock atomico por `version` en decisiones en `projects/rest-api/rest_api_inversions_drfic/src/modules/execution/approvalService.ts`
- [ ] T021 [P] [US2] Registrar conflicto de concurrencia y motivo en `projects/rest-api/rest_api_inversions_drfic/src/modules/execution/executionAudit.ts`
- [ ] T022 [US2] Bloquear ejecucion sin decision humana valida en `projects/rest-api/rest_api_inversions_drfic/src/modules/execution/executionService.ts`
- [ ] T023 [US2] Integrar wiring broker desacoplado con manejo de errores en `projects/rest-api/rest_api_inversions_drfic/src/modules/brokers/brokerIntegration.ts`
- [ ] T024 [US2] Exponer respuesta explicita de restriccion operativa en `projects/rest-api/rest_api_inversions_drfic/src/routes/execution/approve.ts`
- [ ] T025 [US2] Exponer respuesta explicita de bloqueo de ejecucion en `projects/rest-api/rest_api_inversions_drfic/src/routes/execution/execute.ts`
- [ ] T026 [P] [US2] Ajustar flujo UI de aprobacion con mensajes de conflicto/permisos en `projects/pwa/inversions_app/src/features/execution/ApprovalFlow.tsx`
- [ ] T027 [P] [US2] Ajustar panel de ejecucion con estado de decision valida en `projects/pwa/inversions_app/src/features/execution/ExecutionPanel.tsx`

**Checkpoint**: US2 funcional y validable de forma independiente.

### Tests for User Story 2

- [ ] T041 [P] [US2] Tests unitarios para approvalService (optimistic lock atomico) y executionAudit en `projects/rest-api/rest_api_inversions_drfic/tests/unit/execution/approvalService.test.ts` y `projects/rest-api/rest_api_inversions_drfic/tests/unit/execution/executionAudit.test.ts`
- [ ] T042 [P] [US2] Tests de integracion para routes/execution/approve y routes/execution/execute en `projects/rest-api/rest_api_inversions_drfic/tests/integration/execution/`
- [ ] T046 [P] [US2] Tests unitarios para executionService (bloqueo sin decision humana) y failureRecovery (modo degradado y reintento) en `projects/rest-api/rest_api_inversions_drfic/tests/unit/execution/executionService.test.ts` y `projects/rest-api/rest_api_inversions_drfic/tests/unit/execution/failureRecovery.test.ts`

---

## Phase 5: User Story 3 - Auditar ciclo de vida de senal a intento de ejecucion (Priority: P3)

**Goal**: Entregar consulta historica completa y auditable de la cadena operacional.

**Independent Test**: Un auditor consulta una recomendacion historica y recupera secuencia completa senal -> evidencia -> decision -> intento de ejecucion con responsables y timestamps.

### Implementation for User Story 3

- [ ] T028 [P] [US3] Implementar servicio de historial consolidado por recomendacion en `projects/rest-api/rest_api_inversions_drfic/src/modules/audit/historyService.ts`
- [ ] T029 [P] [US3] Exponer endpoint de historial operativo en `projects/rest-api/rest_api_inversions_drfic/src/routes/audit/history.ts`
- [ ] T030 [P] [US3] Exponer endpoint de detalle operacional por recomendacion en `projects/rest-api/rest_api_inversions_drfic/src/routes/audit/operationDetail.ts`
- [ ] T031 [US3] Integrar metricas de historial y correlacion en `projects/rest-api/rest_api_inversions_drfic/src/observability/historyMetrics.ts`
- [ ] T032 [US3] Integrar pagina de historial auditado con cadena completa en `projects/pwa/inversions_app/src/features/audit/AuditHistoryPage.tsx`
- [ ] T033 [US3] Integrar timeline cronologico de eventos en `projects/pwa/inversions_app/src/features/audit/OperationTimeline.tsx`

**Checkpoint**: US3 funcional y validable de forma independiente.

### Tests for User Story 3

- [ ] T043 [P] [US3] Tests unitarios para historyService y historyMetrics en `projects/rest-api/rest_api_inversions_drfic/tests/unit/audit/historyService.test.ts` y `projects/rest-api/rest_api_inversions_drfic/tests/unit/audit/historyMetrics.test.ts`
- [ ] T044 [P] [US3] Tests de integracion para routes/audit/history y routes/audit/operationDetail en `projects/rest-api/rest_api_inversions_drfic/tests/integration/audit/`

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Hardening transversal, cumplimiento y readiness operativo.

- [ ] T034 [P] Implementar politica de retencion minima 365 dias para evidencia/auditoria en `projects/rest-api/rest_api_inversions_drfic/src/config/dataGovernance.ts`
- [ ] T035 [P] Integrar metricas obligatorias (`decision_latency_ms`, `decision_conflict_count`, `broker_sync_lag_ms`) en `projects/rest-api/rest_api_inversions_drfic/src/observability/availabilitySlo.ts`
- [ ] T036 Implementar modo degradado visible y bloqueo temporal por broker en `projects/rest-api/rest_api_inversions_drfic/src/modules/execution/failureRecovery.ts`
- [ ] T037 [P] Mostrar disclaimer no asesor en puntos criticos de decision en `projects/pwa/inversions_app/src/features/execution/ApprovalFlow.tsx`
- [ ] T038 Ejecutar validacion de estructura y consistencia de feature en `scripts/validate-structure.ps1`
- [ ] T045 [P] Ejecutar reporte de cobertura y validar umbral minimo 80% en rutas criticas mediante `npm test -- --coverage` en raiz del workspace
- [ ] T047 [P] Test de integracion de SLA de observabilidad: verificar que `decision_latency_ms`, `decision_conflict_count` y `broker_sync_lag_ms` se actualizan en el tablero en ciclos de maximo 60 segundos en `projects/rest-api/rest_api_inversions_drfic/tests/integration/observability/availabilitySlo.test.ts`
- [ ] T048 Agregar campo `context_snapshot` (JSON serializado de inputs de decision) a `SenalConfluente` en migracion `projects/rest-api/rest_api_inversions_drfic/src/database/supabase/migrations/002_context_snapshot.sql` para soportar reconstruccion de decisiones pasadas (FR-009)
- [ ] T049 Validar cobertura de comentarios `FIC:` bilingues en archivos nuevos de la feature mediante revision de checklist en `specs/002-team-01-dashboard-brokers/checklists/requirements.md` antes del cierre de cada tarea (FR-018)

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): inicia sin dependencias.
- Foundational (Phase 2): depende de Setup y bloquea todas las historias.
- User Stories (Phase 3-5): dependen de Phase 2; se pueden paralelizar por capacidad del equipo.
- Polish (Phase 6): depende de historias objetivo completadas.

### User Story Dependencies

- US1 (P1): inicia despues de Foundational; no depende de US2/US3.
- US2 (P2): inicia despues de Foundational; integra salidas de US1 pero valida independiente.
- US3 (P3): inicia despues de Foundational; consume datos de auditoria y valida independiente.

### Within Each User Story

- Contratos y payloads antes de integraciones UI finales.
- Servicios backend antes de endpoints.
- Endpoints antes del wiring frontend final.
- Validacion independiente de historia antes de avanzar.

### Parallel Opportunities

- Phase 2: T005, T006, T007, T011 en paralelo tras T004.
- US1: T012-T015 en paralelo; T016-T017 en paralelo; luego T018-T019.
- US2: T020-T021 y T026-T027 en paralelo; luego T022-T025.
- US3: T028-T030 en paralelo; luego T031-T033.
- Polish: T034, T035, T037 en paralelo; luego T036 y T038.

---

## Parallel Example: User Story 1

```bash
Task: "T012 [US1] MainDashboard en projects/pwa/inversions_app/src/features/dashboard/MainDashboard.tsx"
Task: "T013 [US1] CoreSelector en projects/pwa/inversions_app/src/features/dashboard/CoreSelector.tsx"
Task: "T014 [US1] SignalOverlay en projects/pwa/inversions_app/src/features/dashboard/SignalOverlay.tsx"
Task: "T015 [US1] ExplainabilityTable en projects/pwa/inversions_app/src/features/dashboard/ExplainabilityTable.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "T020 [US2] optimistic lock en projects/rest-api/rest_api_inversions_drfic/src/modules/execution/approvalService.ts"
Task: "T021 [US2] auditoria de conflicto en projects/rest-api/rest_api_inversions_drfic/src/modules/execution/executionAudit.ts"
Task: "T026 [US2] ApprovalFlow UI en projects/pwa/inversions_app/src/features/execution/ApprovalFlow.tsx"
Task: "T027 [US2] ExecutionPanel UI en projects/pwa/inversions_app/src/features/execution/ExecutionPanel.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "T028 [US3] historyService en projects/rest-api/rest_api_inversions_drfic/src/modules/audit/historyService.ts"
Task: "T029 [US3] route history en projects/rest-api/rest_api_inversions_drfic/src/routes/audit/history.ts"
Task: "T030 [US3] route operationDetail en projects/rest-api/rest_api_inversions_drfic/src/routes/audit/operationDetail.ts"
```

---

## Implementation Strategy

### MVP First (US1)

1. Completar Phase 1 (Setup).
2. Completar Phase 2 (Foundational).
3. Completar Phase 3 (US1).
4. Validar criterio independiente de US1 y hacer demo operativa.

### Incremental Delivery

1. Foundation completa.
2. Entregar US1 (tablero operativo).
3. Entregar US2 (control humano y concurrencia).
4. Entregar US3 (auditoria end-to-end).
5. Cerrar con Phase 6 (hardening/cumplimiento).

### Parallel Team Strategy

1. Equipo completo en Phase 1-2.
2. Luego por frente:
   - Dev A: frontend dashboard (US1)
   - Dev B: execution governance (US2)
   - Dev C: audit chain (US3)
3. Integracion final en Polish.

---

## Notes

- Todas las tareas usan formato estricto de checklist.
- La trazabilidad canonica TEAM-01 se preserva por intencion funcional, no por reciclaje literal de IDs globales.
- Si aparece conflicto entre implementacion actual y canon, prevalece constitucion + canon global + spec del feature.




