# Plan de Implementacion: Dashboard de Brokers TEAM-01

**Branch**: `002-team-01-dashboard-brokers` | **Fecha**: 2026-05-13 | **Spec**: [spec.md](spec.md)
**Entrada**: Especificacion canonica en [spec.md](spec.md)

## Resumen

Implementar y consolidar un tablero operativo para TEAM-01 que muestre confluencia de senales por activo y broker, permita aprobacion o rechazo humano explicito, y exponga un historial auditable de la cadena senal -> evidencia -> decision -> intento de ejecucion. El slice debe respetar el modelo semi-automatico constitucional: no hay ejecucion sin aprobacion humana valida, la concurrencia se resuelve con optimistic lock por `version`, y la integracion con brokers entra en modo degradado visible ante caida, timeout o lag critico.

## Contexto Tecnico

**Language/Version**: TypeScript 5.x en frontend y backend; Node.js 22 LTS en API
**Primary Dependencies**: React 18, Vite, Express, Supabase JS client, JWT, TradingView Lightweight Charts, data-table/tree-view UI components, componentes existentes de señales/ejecucion/auditoria
**Storage**: Supabase como store operacional y de auditoria; retencion minima 365 dias
**Testing**: `npm test` y `npm run lint` en raiz; validacion de TypeScript por workspace
**Target Platform**: Web PWA + REST API
**Project Type**: Aplicacion web con frontend y backend separados
**Performance Goals**: respuestas de historial con objetivo de consulta rapida y metricas operativas actualizadas; visibilidad de degradacion en menos de 30 segundos
**Constraints**: control humano obligatorio, RLS con JWT claims, disclaimer no asesor visible, optimistic lock en `SenalConfluente`, trazabilidad con `trace_id` y `senal_id`, modo degradado ante fallas de broker
**Scale/Scope**: tablero de operaciones para acciones/opciones/futuros/forex/cripto con foco en TEAM-01; brokers IBKR, Alpaca, Capital.com, BlackBull Markets, Forex.com, Blueberry Markets y TradeStation; consulta historica + modo demo/real + online/offline

## Constitución Check

*GATE: Debe pasar antes de Phase 0 y revalidarse tras Phase 1.*

### Check Inicial

- Idioma oficial en espanol: **PASS**
- Modelo semi-automatico y control humano obligatorio: **PASS**
- Separacion frontend/backend: **PASS**
- Seguridad con JWT + Supabase RLS + claims: **PASS**
- Auditoria, disclaimer y retencion minima de 365 dias: **PASS**
- Control de concurrencia con `version` y rechazo atomico de conflictos: **PASS**
- Observabilidad estructurada por transicion: **PASS**
- Modo degradado visible ante fallas de broker: **PASS**
- Comentarios FIC: bilingues en codigo nuevo (§10 Constitucion): **PENDIENTE** — validar en cierre de cada tarea via checklist en requirements.md

Resultado del gate inicial: **PASS con observacion** (§10 pendiente de validacion en implementacion).

### Re-check Post-Phase 1

- El diseno mantiene aprobacion humana como condicion previa de ejecucion: **PASS**
- El modelo de datos conserva trazabilidad completa y versionado de contexto: **PASS**
- La UI refuerza el disclaimer no asesor en puntos criticos: **PASS**
- El plan no introduce auto-trading ni bypass de gobernanza: **PASS**

Resultado del re-check: **PASS**.

## Matriz de Trazabilidad FR/SC

<!-- FIC: Traceability matrix mapping each Functional Requirement to Success Criteria,
     User Story, and implementation phase / Matriz de trazabilidad que relaciona cada
     Requisito Funcional con Criterios de Éxito, Historia de Usuario y fase de implementación -->

| Requisito Funcional | Criterio(s) de Éxito | Historia | Fase |
|---|---|---|---|
| FR-001 Tablero principal de confluencia | SC-001 | US1 | Phase 3 |
| FR-002 Estado, riesgo y evidencia por recomendacion | SC-001, SC-002 | US1 | Phase 3 |
| FR-003 Decision humana explicita de aprobacion/rechazo | SC-001, SC-002, SC-004 | US2 | Phase 4 |
| FR-004 Registro de decision con responsable y timestamp | SC-002, SC-004 | US2 | Phase 4 |
| FR-005 Trazabilidad completa senal→evidencia→decision→ejecucion | SC-002, SC-003 | US1-US3 | Phase 3-5 |
| FR-006 Bloqueo de ejecucion sin decision humana valida | SC-004 | US2 | Phase 4 |
| FR-007 Estado de integracion con brokers desacoplado | SC-006 | US1/US2 | Phase 3-6 |
| FR-008 Consulta historica por recomendacion | SC-003 | US3 | Phase 5 |
| FR-009 Versionado del contexto de recomendacion | SC-002, SC-003 | US3 | Phase 6 (T048) |
| FR-010 Mensajes claros de restriccion operativa | SC-004 | US2 | Phase 4 |
| FR-011 Retencion minima de 365 dias | SC-003 | US3 | Phase 6 (T034) |
| FR-012 Disclaimer no asesor en puntos criticos | SC-004 | US2 | Phase 6 (T037) |
| FR-013 Control de acceso via Supabase RLS + JWT claims | SC-004 | Transversal | Phase 2 (T010) |
| FR-014 Optimistic lock por `version` en `SenalConfluente` | SC-004 | US2 | Phase 4 (T020-T021) |
| FR-015 Observabilidad estructurada con trace_id/senal_id y metricas | SC-005 | Transversal | Phase 6 (T035, T047) |
| FR-016 Modo degradado visible ante falla de broker | SC-006 | Transversal | Phase 6 (T036) |
| FR-017 Tests automatizados ≥ 80% cobertura en rutas criticas | SC-001..SC-006 | Transversal | Phase 3-6 (T039-T047) |
| FR-018 Comentarios FIC: bilingues en todo codigo nuevo | SC-001..SC-006 | Transversal | Phase 6 (T049) |
| FR-019 Bootstrap de JWT local (generacion/sincronizacion) | SC-007 | Transversal | Phase 7 (T053, T055, T056) |
| FR-020 Scripts oficiales start/stop con modo silencioso/visible | SC-007 | Transversal | Phase 7 (T053, T054) |
| FR-021 Comando de estado operativo local | SC-008 | Transversal | Phase 7 (T054) |
| FR-022 Runbook y troubleshooting auth/puertos | SC-007, SC-008 | Transversal | Phase 7 (T057) |
| FR-023 Watchlist tree por categorias con alta/baja dinamica | SC-014 | US1 | Phase 8 (T059, T060, T070) |
| FR-024 Superchart de velas con overlays y tooltip enriquecido | SC-015, SC-017 | US1 | Phase 8 (T061, T066, T071) |
| FR-025 Temporalidades dinamicas segun capacidades de fuente | SC-015 | US1 | Phase 8 (T062, T071) |
| FR-026 Switch Online/Offline + Demo/Operativa Real | SC-016 | Transversal | Phase 8 (T063, T064, T072) |
| FR-027 Catalogo multi-broker ampliado | SC-013, SC-016 | Transversal | Phase 8 (T063, T064, T067) |
| FR-028 Configuracion por dominio (instrumentos/OHLC/indicadores/streaming) | SC-013, SC-016 | Transversal | Phase 8 (T064, T067, T072) |
| FR-029 Menu indicadores 3+overflow con modal dinamico | SC-018 | US1 | Phase 8 (T065, T073) |
| FR-030 Tabla avanzada de confluencia con capacidad macro (ordenamiento, filtrado, exportacion, sync) | SC-017, SC-021 | US1 | Phase 8 (T066, T071) |
| FR-031 Click de fila resalta senal en chart | SC-023 | US1 | Phase 8 (T069, T071) |
| FR-032 Tabla de confluencia con campos operativos avanzados (timing, derivados, entrada/salida, riesgo) | SC-019 | US1 | Phase 8 (T075, T076) |
| FR-033 Tabla de confluencia dinamica configurable por metadata/presets | SC-020, SC-024 | US1 | Phase 8 (T077, T078, T079, T080) |

### Mapeo Inverso SC → FR(s)

| Criterio de Exito | Requisitos Funcionales que lo satisfacen |
|---|---|
| SC-001 Revision de recomendacion en < 3 min | FR-001, FR-002, FR-003, FR-017 |
| SC-002 100% trazabilidad senal→ejecucion | FR-004, FR-005, FR-009, FR-017 |
| SC-003 ≥ 90% auditorias sin hallazgos | FR-005, FR-008, FR-009, FR-011, FR-017 |
| SC-004 0 decisiones no autorizadas por mes | FR-003, FR-006, FR-010, FR-012, FR-013, FR-014 |
| SC-005 100% transiciones con trace_id/metricas en ≤ 60 s | FR-015, FR-017 |
| SC-006 Degradacion visible en < 30 s, decisiones bloqueadas | FR-007, FR-016 |
| SC-007 Arranque local de un comando + dashboard sin 401 post-sync | FR-019, FR-020, FR-022 |
| SC-008 Status local en < 5 s con health/puertos/log tail | FR-021, FR-022 |
| SC-014 Watchlist tree dinamico con persistencia por usuario | FR-023 |
| SC-015 Superchart y temporalidades dinamicas con rendimiento estable | FR-024, FR-025 |
| SC-016 Conmutacion Demo/Real y fuentes online/offline por broker | FR-026, FR-027, FR-028 |
| SC-017 Tabla confluencia avanzada sincronizada con chart | FR-024, FR-030, FR-031 |
| SC-018 Menu de indicadores y overflow funcional con busqueda | FR-029 |
| SC-019 Senales con metadata operativa completa y consistente tabla/chart | FR-030, FR-032 |
| SC-020 Tabla evolutiva configurable sin cambios de codigo | FR-033 |
| SC-021 Superchart interactivo con p95 latencia <= 120 ms en 5k velas | FR-024, FR-030 |
| SC-022 Render inicial tablero <= 2.5 s (watchlist+chart+tabla) | FR-001, FR-024, FR-030 |
| SC-023 Sincronizacion click-fila a marcador-resaltado p95 <= 300 ms | FR-031 |
| SC-024 Selector temporalidad solo muestra granularidades soportadas (0 errores) | FR-025, FR-033 |

---

## Estructura del Proyecto

### Documentacion de la feature

```text
specs/002-team-01-dashboard-brokers/
├── plan.md
├── spec.md
├── research.md            # Pendiente en fases posteriores, no regenerado en esta ejecucion
├── data-model.md          # Pendiente en fases posteriores, no regenerado en esta ejecucion
├── quickstart.md          # Pendiente en fases posteriores, no regenerado en esta ejecucion
└── contracts/             # Pendiente en fases posteriores, no regenerado en esta ejecucion
```

### Superficie de codigo existente a extender

```text
│
└── projects/                           # Portafolio completo de proyectos y shared code
    ├── packages/                       # Librerías/código reutilizable para cualquier proyecto
    │   ├── ui-library/                 # Librería interna de componentes UI
    │   │   ├── src/
    │   │   ├── package.json
    │   │   └── tsconfig.json
    │   ├── utils/                      # Funciones utilitarias compartidas
    │   │   ├── src/
    │   │   ├── package.json
    │   │   └── tsconfig.json
    │   └── types/                      # Tipos globales compartidos
    │       ├── src/
    │       ├── package.json
    │       └── tsconfig.json
    ├── pwa/                            # Todos los proyectos PWA del portafolio
    │   ├── inversions_app/             # Proyecto: Plataforma de Inversiones IA
    │   │   ├── public/
    │   │   ├── data/                   # Contratos/modelos de referencia por base de datos
    │   │   │   ├── supabase/
    │   │   │   │   ├── models/
    │   │   │   │   ├── schema/
    │   │   │   │   └── data/
    │   │   │   ├── mongodb/
    │   │   │   │   ├── models/
    │   │   │   │   ├── schema/
    │   │   │   │   └── data/
    │   │   │   └── ...
    │   │   ├── src/                    # Código ejecutable de la PWA
    │   │   │   ├── assets/
    │   │   │   ├── components/
    │   │   │   │   └── ui/
    │   │   │   ├── features/
    │   │   │   │   ├── dashboard/
    │   │   │   │   ├── market-scanner/
    │   │   │   │   ├── options-chain/
    │   │   │   │   ├── signals/
    │   │   │   │   ├── portfolio/
    │   │   │   │   ├── broker-connect/
    │   │   │   │   ├── backtesting/
    │   │   │   │   └── alerts/
    │   │   │   ├── hooks/
    │   │   │   ├── layouts/
    │   │   │   ├── pages/
    │   │   │   ├── routes/
    │   │   │   ├── services/
    │   │   │   │   ├── broker/
    │   │   │   │   ├── market-data/
    │   │   │   │   ├── indicators/
    │   │   │   │   ├── technical-analysis/
    │   │   │   │   ├── fundamental-analysis/
    │   │   │   │   ├── ai-analysis/
    │   │   │   │   ├── institutional-analysis/
    │   │   │   │   ├── news/
    │   │   │   │   └── strategies/
    │   │   │   ├── store/
    │   │   │   ├── styles/
    │   │   │   ├── utils/
    │   │   │   ├── types/
    │   │   │   ├── App.tsx
    │   │   │   ├── main.tsx
    │   │   │   └── vite-env.d.ts
    │   │   ├── tests/
    │   │   │   └── e2e/
    │   │   ├── index.html
    │   │   ├── package.json
    │   │   ├── tsconfig.json
    │   │   └── vite.config.ts
    └── rest-api/                       # Todos los proyectos REST API del portafolio
        └── inversions_api/  # Persistencia real y exposición de endpoints
            ├── src/
            │   ├── config/
            │   ├── controllers/
            │   ├── database/
            │   │   ├── supabase/
            │   │   │   ├── migrations/
            │   │   │   └── scripts/
            │   │   └── mongodb/
            │   ├── domain/
            │   ├── jobs/
            │   ├── middleware/
            │   ├── migrations/
            │   ├── models/
            │   ├── modules/
            │   ├── observability/
            │   ├── repositories/
            │   ├── routes/
            │   ├── services/
            │   ├── types/
            │   └── utils/
            ├── DATABASE_CONFIG.yaml
            ├── .env.example
            ├── package.json
            └── tsconfig.json
```

**Decision de estructura**: no se crean nuevas raices de producto; el trabajo se concentra en las superficies existentes bajo `projects/pwa/inversions_app` y `projects/rest-api/inversions_api`, con la documentacion de la feature aislada en `specs/002-team-01-dashboard-brokers/`.

## Enfoque de Implementacion

### 1. Contrato funcional del dashboard

- Consolidar la lectura de `SenalConfluente`, `DecisionHumana`, `IntentoEjecucion`, `EvidenciaOperacion` y `EventoAuditoria` como una cadena unica de trazabilidad.
- Mantener el estado de la senal y la evidencia visible en la misma vista operativa, con acceso rapido al detalle historico.
- Alinear la UI con los mensajes de restriccion operativa y permisos del dominio.

### 2. Gobernanza y autorizacion

- Respetar Supabase RLS con JWT claims como unica fuente de autorizacion fina.
- Evitar duplicar logica de permisos en frontend o middleware aparte.
- Validar que aprobador, operador y auditor queden distinguidos por claims y contexto autenticado.

### 3. Aprobacion y ejecucion controladas

- Mantener el flujo de aprobacion humana explicita antes de cualquier intento de ejecucion.
- Rechazar de forma atomica cualquier decision con `version` desactualizada.
- Registrar conflicto, motivo y contexto de auditoria sin sobrescribir el estado terminal valido.

### 4. Observabilidad y auditoria

- Correlacionar cada transicion con `trace_id` y `senal_id`.
- Exponer al menos `decision_latency_ms`, `decision_conflict_count` y `broker_sync_lag_ms` en el tablero operativo.
- Mantener historial y evidencia con retencion minima de 365 dias.

### 5. Degradacion operativa

- Si el broker cae, timeoutea o supera el lag critico, marcar la vista como degradada de forma visible.
- Bloquear nuevas decisiones sobre senales afectadas hasta recuperacion o timeout operacional.
- Activar reintentos automaticos y emitir alerta operativa.

### 6. Operabilidad local (JWT + scripts)

- Estandarizar el bootstrap de autenticacion local con token JWT dev firmado por `JWT_SECRET` backend y sincronizado al frontend por script oficial.
- Mantener comandos oficiales de arranque/parada con modo silencioso por defecto y modo visible solo bajo demanda.
- Incluir comando de estado operativo para verificar `health`, puertos y logs recientes sin exponer salida interactiva permanente.
- Documentar troubleshooting de `401 AUTH_CONTEXT_*`, desalineacion de secretos y conflictos de puertos en el runbook del feature.
- T057 cierra la guia operativa reproducible para arranque y recuperacion local.
- T058 cierra la validacion automatizada del bootstrap auth entre backend y frontend.

### 7. Superchart + Workspace Operativo (Phase 8)

- Implementar watchlist tree por categorias de mercado (Indices, Stocks, Futures, Forex, Cripto, Bonos, References IDX) con alta/baja dinamica por usuario.
- Integrar superchart con velas historicas, overlays de senales y resaltado de fila->senal para inspeccion rapida.
- Unificar selector de periodo/temporalidad dinamica en funcion de capacidades del broker/fuente activa.
- Implementar doble conmutador de operacion (`ONLINE/OFFLINE` y `DEMO/OPERATIVA REAL`) con trazabilidad en auditoria.
- Integrar menu estilo TradingView de indicadores (3 accesos + overflow) y modal dinamico de busqueda/seleccion.
- Extender tabla de confluencia con columnas de riesgo, griegas, checklist y motivos de senal.
- Extender tabla de confluencia con metadata operativa completa de entrada/salida y derivados (timing_d, timing_h, pre-senal, senal real, stop, objetivo, divergencia, z_extrema, qty sugerida, vencimiento, strike, call/put, bid/ask, zonas exactas, alertas, max/min refs, variantes, recolocacion stop, liquidez, riesgo y retorno/perdida maximos).
- Implementar esquema dinamico de columnas y presets para la tabla de confluencia, evitando acoplar el frontend a una lista fija de campos.

### 8. Broker Routing + Catalogos Configurables

- Extender catalogo de brokers con IBKR, Alpaca, Capital.com, BlackBull Markets, Forex.com, Blueberry Markets y TradeStation.
- Mantener tablas de configuracion por broker y cuentas por modo (demo/real) en Supabase.
- Permitir configuracion por dominio de datos (instrumentos, OHLC, indicadores, streaming) sin cambios de codigo.
- Aplicar fallback controlado a datos locales para continuidad operativa en offline o degradacion.

## Plan de Trabajo

1. Ajustar el contrato de backend para que el flujo de confluencia, aprobacion y auditoria use las entidades canonicas del dominio y preserve trazabilidad completa.
2. Alinear la UI existente de señales, aprobacion, ejecucion y auditoria para que el dashboard del equipo consolide estado, riesgo, evidencia y cadena historica en un recorrido unico.
3. Reforzar reglas de gobernanza: disclaimer no asesor visible, control de acceso por roles con Supabase RLS, optimistic lock por `version`, y bloqueo ante degradacion de broker.
4. Unificar observabilidad y mensajes operativos para conflicto, latencia, degradacion y consulta historica.
5. Validar el slice con TypeScript/lint y, cuando exista contrato de runtime, con una comprobacion focalizada del flujo de aprobacion y auditoria.
6. Ejecutar Phase 8: superchart, watchlist tree, temporalidades dinamicas, menu indicadores y tabla de confluencia avanzada.
7. Implementar broker routing multi-fuente y modo demo/real con configuracion en catalogos Supabase.
8. Validar end-to-end que seleccion de simbolo/periodo/core sincroniza chart y tabla, con degradacion correcta online/offline.

## Riesgos y Mitigaciones

| Riesgo | Mitigacion |
|---|---|
| Divergencia entre la UI actual de señales y el nuevo modelo de dashboard | Reusar las vistas existentes como base y solo ampliar la superficie funcional necesaria |
| Permisos duplicados fuera de Supabase RLS | Mantener la autorizacion fina en RLS y usar frontend/backend solo para presentar contexto y bloquear acciones visibles |
| Conflictos por aprobacion concurrente | Optimistic lock atomico con evento de auditoria y mensaje explicito de conflicto |
| Degradacion de broker no visible a tiempo | Indicador visible en la UI y bloqueo inmediato de decisiones nuevas sobre senales afectadas |
| Poca trazabilidad historica | Auditoria con campos minimos obligatorios y retencion de 365 dias |

## Gaps Detectados

- Este plan usa la especificacion aclarada como entrada canonica, pero no regenera `research.md`, `data-model.md`, `quickstart.md` ni `contracts/` en esta ejecucion.
- La base de codigo actual ya contiene stubs y componentes parciales para señales, aprobacion, ejecucion y auditoria; la brecha principal es conectarlos a datos reales y a Supabase con las reglas del dominio.
- Si se desea formalizar contratos adicionales del dashboard, eso quedaria para una fase posterior de documentacion o tareas.
- La especificacion original no hacia explicita la operabilidad local (bootstrap JWT + scripts start/stop/status), por eso no quedo trazada de forma nativa en la primera ronda de plan/tareas.
- Para evitar regresiones de UX/alcance, toda feature de dashboard debera declarar obligatoriamente: stack visual objetivo, tipo de control por campo, fuente de datos por atributo y reglas de fallback operacional.
