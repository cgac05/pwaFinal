# Plan Tecnico Canonico
## Plataforma de Inversiones con IA

Identificador: 001-INV-PLAN
Proyecto: DIANA Inversions
Iniciativa: 001-inversions
Version de regeneracion: 2026-04-28
Accion: /diana.plan action="regenerate" scope="project" project="diana-inversions"

Especificacion implementada:
- 001-DIANA-INVERSIONS-SPEC
- specs/001-plataforma-inversiones-ia/spec.md (operativa)

Autoridad:
Este plan tecnico esta subordinado a:
1. inv-constitution.md
2. 001-inv-spec.md
3. spec.md (operativa derivada)

Ante conflicto, prevalece la constitucion y la especificacion canonica.

## 0. Entradas Oficiales Consumidas

Fuentes de negocio y canon:
- .drfic/diana-sdk/projects/knowledge/indexes/projects-knowledge-radar.yaml
- .drfic/diana-sdk/projects/diana-inversions/inv-constitution.md
- .drfic/diana-sdk/projects/diana-inversions/initiatives/001-inversions/001-inv-spec.md
- specs/001-plataforma-inversiones-ia/spec.md
- .drfic/diana-sdk/projects/diana-inversions/governance/change-requests/001-inv-ucc.md
- .drfic/diana-sdk/projects/diana-inversions/governance/tickets/001-inv-tkt.md
- .drfic/diana-sdk/projects/diana-inversions/initiatives/001-inversions/meta.md

Skills y knowledge first:
- .drfic/diana-sdk/projects/diana-inversions/knowledge/indexes/skills-manifest.yaml
- .drfic/diana-sdk/projects/diana-inversions/knowledge/indexes/agent-skill-matrix.yaml
- .drfic/diana-sdk/projects/diana-inversions/knowledge/indexes/sdd-engine-matrix.yaml
- .drfic/diana-sdk/projects/knowledge/indexes/master-index.md
- .drfic/diana-sdk/projects/diana-inversions/knowledge/indexes/master-index.md
- .drfic/diana-sdk/sdk/diana/knowledge/indexes/master-index.md

## 1. Objetivo del Plan

Definir el como tecnico para implementar una plataforma de inversion asistida por IA, con control humano obligatorio, trazabilidad completa y ejecucion asistida en IBKR y Alpaca, sin introducir nuevos requisitos fuera de FR-001..FR-019 y SC-001..SC-008.

## 2. Alcance y Exclusiones

Incluye:
- Arquitectura modular PWA + REST API.
- Orquestacion de cores analiticos y motor de confluencia.
- Flujo operativo de propuesta, aprobacion y ejecucion asistida.
- Seguridad, observabilidad, resiliencia y cumplimiento.
- Base de trazabilidad para /speckit.plan.

Excluye:
- Auto-trading.
- IA como unica fuente de decision.
- Nuevos mercados fuera de acciones/opciones US.
- Redefinicion funcional de la especificacion.

## 3. Skills Requeridas para Etapa Plan

Required skills (speckit.plan):
- 001-inv-technical-analysis-structure
- 002-inv-indicator-signal-logic
- 004-inv-options-strategy-engine
- 005-inv-institutional-options-flow
- 006-inv-realtime-news-impact
- 007-inv-ai-confluence-orchestration
- 008-inv-market-data-and-realtime
- 010-inv-broker-integration-ibkr-alpaca
- 011-inv-portfolio-and-performance-analytics

Cobertura actual: completa en skills-manifest.yaml.
Politica de fallback: si un skill/knowledge faltara en futuras ejecuciones, continuar con metodologia estandar y reportar gap.

## 4. Arquitectura Tecnica Objetivo

### 4.1 Vista de capas

1. Capa Frontend (PWA):
- Dashboard, watchlists, detalle de senales, historial.
- Flujo de aprobacion humana explicita.
- Visualizacion de evidencia y disclaimers.

2. Capa API (Node.js/Express):
- AuthN JWT Bearer.
- AuthZ RBAC (viewer, trader, admin).
- Politicas MFA para aprobacion/ejecucion sensible.
- Orquestacion de analisis, propuestas y ejecucion asistida.

3. Capa Dominio:
- Entidades: Usuario, Fuente Analitica, Senal, Propuesta Operativa, Decision Humana, Intento de Ejecucion, Registro de Auditoria.
- Maquina de estados de orden y control de concurrencia por version.

4. Capa Integraciones:
- Brokers: IBKR y Alpaca por adaptadores desacoplados.
- Market data en tiempo real con objetivo p95 <= 1s.
- Servicio IA para confluencia/explicabilidad (sin autonomia de ejecucion).

5. Capa Datos:
- Supabase como store operacional primario.
- MongoDB opcional para historicos y contexto IA.
- Retencion minima de evidencia: 365 dias.

### 4.2 Controles tecnicos obligatorios

- Fail-fast en fallas de broker: estado FALLIDA y nueva aprobacion humana para reintento.
- Optimistic locking por version de orden para concurrencia.
- Rate limiting por usuario y endpoint sensible con 429 y cooldown.
- RTO <= 30 min y RPO <= 5 min para servicios criticos.
- Trazabilidad de aprobacion/ejecucion con MFA para trader/admin.

## 5. Fases Tecnicas de Implementacion

### Fase 1: Fundacion de Plataforma

Objetivo:
Establecer bases de arquitectura, seguridad y observabilidad.

Entregables:
- Estructura backend/frontend y contratos base.
- Middleware JWT, RBAC y hooks de MFA.
- Health checks, logging estructurado y metricas base.

Trazabilidad:
- FR-012, FR-017, FR-019, SC-005

### Fase 2: Core de Analisis y Confluencia

Objetivo:
Construir pipeline analitico multi-core y salida explicable.

Entregables:
- Evaluacion de fuentes activas.
- Motor de confluencia con evidencia trazable.
- Definicion de propuesta operativa asociada a senal.

Trazabilidad:
- FR-001, FR-002, FR-003, FR-010, SC-001, SC-004

### Fase 3: Flujo Operativo Human-in-the-loop

Objetivo:
Implementar ciclo de vida operativo con aprobacion humana estricta.

Entregables:
- Estados de propuesta/orden e historial.
- Bloqueo de ejecucion sin aprobacion valida.
- Fail-fast y reintento controlado post-falla.
- Optimistic locking en acciones concurrentes.

Trazabilidad:
- FR-004, FR-005, FR-006, FR-009, FR-016, SC-002

### Fase 4: Integracion Broker y Market Data

Objetivo:
Habilitar ejecucion asistida y datos de mercado en tiempo real.

Entregables:
- Adaptadores IBKR y Alpaca para Market/Limit.
- Normalizacion de estados broker -> dominio.
- Telemetria de latencia y frescura de market data.

Trazabilidad:
- FR-008, FR-014, SC-006

### Fase 5: Auditoria, Cumplimiento y Resiliencia

Objetivo:
Completar requisitos de cumplimiento, evidencia y recuperacion.

Entregables:
- Registro de auditoria inmutable.
- Politicas de retencion 365 dias y evidencia operativa.
- Disclaimer explicito en puntos de decision/ejecucion.
- Estrategia operativa para RTO/RPO objetivos.

Trazabilidad:
- FR-007, FR-011, FR-013, FR-018, SC-003, SC-007, SC-008

### Fase 6: Endurecimiento y Readiness Speckit

Objetivo:
Dejar artefactos listos para descomposicion en /speckit.plan y /speckit.tasks.

Entregables:
- Matriz final FR/SC -> componentes -> pruebas.
- Lista de riesgos residuales y mitigaciones activas.
- Criterios de salida por fase y checkpoints.

## 6. Matriz de Trazabilidad Minima

- Analisis y confluencia: FR-001/002/003/010 -> Fase 2.
- Control humano y ciclo de orden: FR-004/005/006/009/016 -> Fase 3.
- Integracion de brokers y tipos de orden: FR-008/014 -> Fase 4.
- Seguridad y acceso: FR-012/017/019 -> Fase 1.
- Cumplimiento y auditoria: FR-007/011/013/015/018 -> Fases 5 y 1.
- Resultados medibles: SC-001..SC-008 -> Fases 2..5.

## 7. Riesgos Tecnicos y Mitigaciones

1. Deriva entre estados internos y broker.
Mitigacion: reconciliacion periodica, idempotencia y mapeo canonico de estados.

2. Degradacion de market data en alta volatilidad.
Mitigacion: buffering, fallback de feed y alertas de p95.

3. Riesgo de bypass de controles de aprobacion.
Mitigacion: enforce server-side de aprobacion, RBAC y MFA.

4. Falla de servicios criticos fuera de objetivos RTO/RPO.
Mitigacion: runbooks, backups, restauracion probada y simulacros.

5. Ambiguedad futura por cambios no trazados al canon.
Mitigacion: gate de trazabilidad obligatorio previo a tareas/implementacion.

## 8. Validacion de Consistencia Plan/Spec

Resumen de validacion actual:
- OK: 9
- GAPS: 0

Chequeos OK:
1. El plan no contradice constitucion ni especificacion canonica.
2. El plan mantiene modelo semi-automatico y control humano obligatorio.
3. Cada fase mapea a FR/SC verificables.
4. Se consideran skills requeridas para etapa plan.
5. Se contempla seguridad minima (JWT, RBAC, MFA).
6. Se contempla resiliencia minima (RTO/RPO).
7. Se contempla observabilidad para operaciones criticas.
8. Se contempla cumplimiento (disclaimer, auditoria, retencion).
9. El resultado es apto como entrada de /speckit.plan.

## 9. Cambios Significativos vs Version Previa

1. Se alineo el plan a FR-016..FR-019 y SC-006..SC-008.
2. Se reemplazo enfoque generico por trazabilidad explicita a canon operativo.
3. Se incorporaron controles operativos obligatorios:
- optimistic locking
- fail-fast con nueva aprobacion
- RBAC
- MFA
- RTO/RPO
4. Se adiciono matriz de skills requeridas para etapa plan.
5. Se formalizo resumen de consistencia OK/GAPS.

## 10. Salida

Este documento queda listo como plan tecnico canonico regenerado para consumo en:
- /diana.plan action="validate"
- /speckit.plan
