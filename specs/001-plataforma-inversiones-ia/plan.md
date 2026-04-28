# Plan de Implementacion: Plataforma de Inversiones con IA

**Branch**: `003-run-git-feature` | **Date**: 2026-04-28 | **Spec**: `specs/001-plataforma-inversiones-ia/spec.md`  
**Input**: `--input .drfic\diana-sdk\projects\diana-inversions\initiatives\001-inversions\001-inv-plan.md`

## Resumen

Implementar una plataforma web de inversiones asistida por IA con modelo semi-automatico estricto: la IA analiza y recomienda, pero toda ejecucion requiere aprobacion humana explicita. La arquitectura objetivo separa `frontend` (PWA React) y `backend` (REST API Express), con Supabase como store operacional primario, adaptadores desacoplados para IBKR/Alpaca, y trazabilidad completa de senales, decisiones, ejecuciones, auditoria y cumplimiento.

## Contexto Tecnico

**Language/Version**: TypeScript 5.x en frontend y backend; Node.js 22 LTS en API  
**Primary Dependencies**: React 18, Vite, Zustand, TailwindCSS, Express, Supabase JS client, TradingView Lightweight Charts, SDKs IBKR y Alpaca, cliente Claude API  
**Storage**: Supabase primario; MongoDB opcional para historicos/archivos de contexto IA  
**Testing**: `npm test`; lint con `npm run lint`; pruebas unitarias/integracion/contrato por capa  
**Target Platform**: Web (PWA) + servidor Node.js  
**Project Type**: Aplicacion web con frontend + backend separados  
**Performance Goals**: `SC-006` p95 <= 1s para frescura de market data activa; `SC-003` >=98% de consultas historicas <3s; disponibilidad mensual >=99.5%  
**Constraints**: Control humano obligatorio (`FR-004`,`FR-005`,`FR-009`), no auto-trading (`FR-010`), retencion >=365 dias (`FR-007`), rate limiting con `429` (`FR-015`), optimistic locking (`FR-016`), MFA para trader/admin (`FR-019`)  
**Scale/Scope**: v1 enfocado en acciones y opciones US, brokers IBKR+Alpaca, señales BUY/SELL/HOLD explicables

## Constitution Check

*GATE: Debe pasar antes de Phase 0 research. Revalidar despues de Phase 1 design.*

### Check Inicial (Pre-Phase 0)

- Idioma oficial en espanol: **PASS** (artefactos de plan en espanol).
- Modelo semi-automatico y control humano obligatorio: **PASS** (`FR-004`,`FR-005`,`FR-009`,`FR-010`).
- Separacion PWA y REST API: **PASS** (estructura `frontend/` + `backend/`).
- Seguridad minima (JWT, RBAC, MFA): **PASS** (`FR-012`,`FR-017`,`FR-019`).
- Auditoria, disclaimer y retencion: **PASS** (`FR-007`,`FR-013`).
- Broker scope constitucional v1 (IBKR/Alpaca, Market/Limit): **PASS** (`FR-008`,`FR-014`).
- Resiliencia y recuperacion operativa (RTO/RPO): **PASS** (`FR-018`).

Resultado del gate inicial: **PASS (sin violaciones)**.

### Re-check Post-Phase 1

- Data model y contratos mantienen aprobacion humana como condicion previa de ejecucion: **PASS**.
- Contratos mantienen trazabilidad y auditoria de extremo a extremo: **PASS**.
- Quickstart y diseno no introducen auto-trading ni bypass de gobernanza: **PASS**.

Resultado del re-check: **PASS (sin excepciones constitucionales)**.

## Project Structure

### Documentacion de la feature

```text
specs/001-plataforma-inversiones-ia/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── auth-context.md
│   ├── broker-adapter.md
│   └── signal-lifecycle.md
└── tasks.md   # se genera en /speckit.tasks
```

### Estructura de codigo (repo)

```text
backend/
frontend/
tests/
```

**Structure Decision**: Se mantiene arquitectura web de dos capas (`frontend` + `backend`) con carpeta `tests` transversal, alineada al stack constitucional y a la separacion de responsabilidades del proyecto.

## Phase 0: Outline y Research

### Unknowns y Resolucion

No quedaron `NEEDS CLARIFICATION` abiertos en el contexto tecnico. Se consolidaron decisiones y mejores practicas en `research.md` para:
- confluencia de cores y explicabilidad,
- market data realtime p95<=1s,
- integracion desacoplada de brokers,
- gobernanza de ejecucion human-in-the-loop,
- observabilidad y recuperacion operativa.

## Phase 1: Design y Contracts

### Artefactos de diseno generados

- `data-model.md`: entidades, relaciones, validaciones y transiciones de estado.
- `contracts/auth-context.md`: contrato de autenticacion/autorizacion (JWT+RBAC+MFA).
- `contracts/broker-adapter.md`: contrato de adaptadores IBKR/Alpaca, estados e idempotencia.
- `contracts/signal-lifecycle.md`: contrato de ciclo de vida de señal/aprobacion/ejecucion.
- `quickstart.md`: secuencia de implementacion recomendada para iniciar desarrollo.

### Actualizacion de contexto de agente

Accion requerida por workflow: ejecutar `.specify/scripts/powershell/update-agent-context.ps1 -AgentType copilot`.

## Complejidad y Excepciones

No se registran violaciones constitucionales ni excepciones de complejidad que requieran justificacion.

## Recomendaciones de Knowledge

Los siguientes temas mejorarian el knowledge base con `/diana.knowledge`:
- `/diana.knowledge topic="sdd-lifecycle-sdk" scope="sdk"` - Actualmente el indice SDK reporta metodologia SDD como esqueleto; enriquecerlo reduce ambiguedad operativa multi-proyecto.
- `/diana.knowledge topic="diana-agent-roles-sdk" scope="sdk"` - Completar roles profundos de agentes en SDK fortaleceria trazabilidad de responsabilidades en flujos Speckit.
