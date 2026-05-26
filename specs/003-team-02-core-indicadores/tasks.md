# Tasks: Core de Indicadores Tecnicos + Chat IA (TEAM-02)

**Feature**: 003-team-02-core-indicadores
**Equipo**: TEAM-02 CocaDe6Lts
**Source**: `./spec.md` + `./plan.md` + `teams/TEAM-02/tasks.md` (canon)

## Convencion

- `[P]` = paralelizable con otra `[P]` del mismo bloque (sin dependencias).
- Owner: K=Kevin, E=Edgar, M=Mauricio, H=Hansel.
- Estado inicial: `[ ]` pendiente, `[x]` completo, `[~]` en progreso.

---

## Phase 0: Setup

- [x] **T000** Crear estructura de specs (`spec.md`, `plan.md`, `contracts/`). Owner: H.

## Phase 1: Tipos compartidos y fuente OHLC (bloqueante)

- [x] **T001** Crear `src/modules/indicators/types.ts` con `OhlcBar`, `IndicatorResult`, `ConfluenceVerdict`, `IndicatorError`. Owner: K (compartido).
- [x] **T002** Crear `src/modules/indicators/ohlcSource.ts` con `getCandles(symbol, timeframe, count)` reusando logica determinista de `routes/market-data/ohlc.ts`. Owner: K (compartido).
- [x] **T003** Crear helper `src/modules/indicators/errors.ts` con `respondError(res, status, code, message, hint)`. Owner: K (compartido).

## Phase 2: Indicadores individuales (paralelo)

### Slice KEVIN (Momentum)

- [x] **T010** [P] Implementar `src/modules/indicators/rsi.ts` (funcion pura). Owner: K.
- [x] **T011** [P] Tests unitarios `tests/unit/indicators/rsi.test.ts` (valor conocido, edge cases). Owner: K.
- [x] **T012** [P] Implementar `src/modules/indicators/macd.ts` (linea MACD, señal, histograma, deteccion de cruces). Owner: K.
- [x] **T013** [P] Tests unitarios `tests/unit/indicators/macd.test.ts`. Owner: K.
- [x] **T014** Ruta `src/routes/indicators/rsi.ts` (`GET /api/indicators/rsi`). Owner: K. Depende: T010, T002, T003.
- [x] **T015** Ruta `src/routes/indicators/macd.ts` (`GET /api/indicators/macd`). Owner: K. Depende: T012, T002, T003.
- [x] **T016** Tests integracion `tests/integration/indicators/rsiRoute.test.ts`. Owner: K.
- [x] **T017** Tests integracion `tests/integration/indicators/macdRoute.test.ts`. Owner: K.
- [x] **T018** Contrato OpenAPI `contracts/rsi.openapi.yaml`. Owner: K.
- [x] **T019** Contrato OpenAPI `contracts/macd.openapi.yaml`. Owner: K.
- [x] **T020** Registrar routers en `src/index.ts`. Owner: K.

### Slice EDGAR (Tendencia/Volatilidad)

- [x] **T030** [P] `src/modules/indicators/ema.ts` + tests + ruta + contrato. Owner: E.
- [x] **T031** [P] `src/modules/indicators/adx.ts` + tests + ruta + contrato. Owner: E.
- [x] **T032** [P] `src/modules/indicators/bollinger.ts` + tests + ruta + contrato. Owner: E.
- [x] **T033** Registrar routers en `src/index.ts`. Owner: E.

### Slice MAURICIO (Confluencia + Trazabilidad + Health)

- [x] **T040** `src/modules/indicators/confluence.ts` (consume los 5, score [-1,1], degradacion). Owner: M. Depende: T010, T012, T030, T031, T032.
- [x] **T041** Tests unitarios `tests/unit/indicators/confluence.test.ts`. Owner: M.
- [x] **T042** Ruta `src/routes/indicators/confluence.ts`. Owner: M.
- [x] **T043** Tests integracion `tests/integration/indicators/confluenceRoute.test.ts`. Owner: M.
- [x] **T044** Ruta `src/routes/indicators/health.ts` (`GET /api/indicators/health`). Owner: M.
- [x] **T045** Helper `source_input_hash` + `algorithm_version` consolidado en `types.ts` (`ConfluenceVerdict` con `source_input_hash`, `algorithm_version`, `bars_used`). Owner: M.
- [x] **T046** Contrato OpenAPI `contracts/confluence.openapi.yaml`. Owner: M.

### Slice HANSEL (Chat IA + Tests Cross)

- [x] **T050** `src/modules/indicators/chatExplainer.ts` con interfaz `LlmExplainer` neutral. Owner: H.
- [x] **T051** Implementacion concreta (provider a definir en clarify): mock determinista en CI (`DeterministicMockExplainer`). Owner: H.
- [x] **T052** Ruta `src/routes/indicators/chatExplain.ts` (`POST /api/chat/explain`). Owner: H.
- [x] **T053** Tests integracion (incluye disclaimer obligatorio y rechazo de ejecucion). Owner: H.
- [x] **T054** Contrato OpenAPI `contracts/chat-explain.openapi.yaml`. Owner: H.
- [x] **T055** Test e2e que ejercite: ohlc -> 5 indicadores -> confluencia -> chat. Owner: H. Depende: todos.

## Phase 3: Cobertura y calidad

- [x] **T060** Cobertura unit >= 80% en `modules/indicators/` (94.75% stmts / 97.02% lines, `--coverage`). Owner: H.
- [x] **T061** Validar FIC comments en archivos nuevos (`npm run lint:fic` OK). Owner: H.
- [x] **T062** `npm run -w @inversions/rest-api lint` sin errores. Owner: H.

## Phase 4: Clarifications (resueltas a nivel spec en sesion 2026-05-25)

### Resolucion documental (cerrada)

- [x] **T070** Resolver proveedor LLM y modelo (clarify). **Resuelto Q1: Anthropic Claude Opus 4.7 + prompt caching**. Owner: H + lead.
- [x] **T071** Resolver fuente real OHLC (clarify con TEAM-01). **Resuelto Q2: IBKR via TEAM-01 `market-data`, mock determinista hasta que publiquen**. Owner: M.
- [x] **T072** Resolver politica de cache y rate limit. **Resuelto Q4 + Q5: 60/10 req/min por user_id + cache in-process TTL=1 vela**. Owner: K.

### Implementacion derivada (Phase 6, ver abajo)

Las decisiones documentales tienen sus tasks de implementacion concreta en **Phase 6**.

## Phase 5: Confluence Signals Table + Simulation Control Panel (extension PDF v1)

**Objetivo**: Alinear el dashboard con el PDF "DASBOARD Y TABLA (version 1)" — tabla canonica por core, panel de simulacion (rangos + estrategia + tolerancia + toggles SI/NO) y boton `EJECUTAR SIMULACION`. Tabla pasa a ser SoT; verdict consolidado pasa a derivado.

**Prioridad**: P1 (modelo de datos primero, ver bloque A).

### Bloque A — Modelo de datos y schema (PRIORIDAD)

- [x] **T080** Extender `src/modules/indicators/types.ts` con `CoreId`, `TipoSenal`, `Tendencia`, `EstadoSenal`, `DeltaPrev`, `ConfluenceSignalRow`, `SignalObservation`, `OptionGreeks`, `SimulationRequest`, `ConfluenceColumnConfig`. Owner: M.
- [x] **T081** Migracion Supabase: tablas `confluence_signal_rows`, `signal_observations`, `option_legs`, `simulation_runs`, `confluence_columns` + vista `v_confluence_table`. Owner: M. Depende: T080. *(archivo: `008_phase5_confluence_table.sql`)*
- [x] **T082** Adapter `src/modules/indicators/confluenceTable.ts`: a partir de los 5 indicadores produce `ConfluenceSignalRow[]` (una fila por subCore + agregada por core). Owner: M. Depende: T080.
- [x] **T083** `src/modules/indicators/coreStubs.ts`: emite filas `estado:"DEGRADADA"` para `A_FUNDAMENTAL`, `A_INSTITUCIONAL`, `A_NOTICIAS`, `A_IA` (cuando IA no respondio). Owner: M. Depende: T080.
- [x] **T084** [P] Contratos OpenAPI: `contracts/confluence-table.openapi.yaml`, `contracts/simulation-run.openapi.yaml`, `contracts/health.openapi.yaml` *(incluido por hallazgo G2 de /speckit.analyze)*. Owner: M. Depende: T080.

### Bloque B — Backend endpoints

- [x] **T085** Endpoint `GET /api/signals/confluence-table` (`src/routes/signals/confluenceTable.ts`) con filtros `ticket`, `timeframe`, `from`, `to`, `cores[]`. Owner: K. Depende: T082, T083.
- [x] **T086** Endpoint `POST /api/simulation/run` (`src/routes/simulation/run.ts`) recibe `SimulationRequest`, orquesta candles -> indicadores filtrados -> tabla -> verdict derivado. Owner: K. Depende: T082, T083.
- [x] **T087** `src/modules/simulation/runner.ts`: pipeline puro `SimulationRequest -> { verdict, table, inputs_echo }`, idempotente, hash `source_input_hash`. Owner: K. Depende: T080.
- [x] **T088** Persistir cada simulacion en `simulation_runs` para auditoria (FR-008). Owner: M. Depende: T086.
- [x] **T089** Refactor `routes/indicators/confluence.ts`: pasa a derivar verdict desde la tabla (eliminar calculo paralelo). Owner: M. Depende: T082.
- [x] **T090** Actualizar `routes/dashboard/confluenceColumns.ts` para incluir `applies_to_cores[]` y semillas iniciales (columnas del PDF + tecnicas). Owner: K.
- [x] **T091** Tests integracion `tests/integration/signals/confluenceTableRoute.test.ts` (filtrado por core, degradacion, IA marcada). Owner: K.
- [x] **T092** Tests integracion `tests/integration/simulation/runRoute.test.ts` (idempotencia, inputs_echo, cores deshabilitados). Owner: K.
- [x] **T093** Tests unitarios `tests/unit/indicators/confluenceTable.test.ts` y `tests/unit/simulation/runner.test.ts`. Owner: M.

### Bloque C — Frontend dashboard (PWA)

- [x] **T094** Crear snapshot `projects/pwa/inversions_app/src/features/dashboard.v1-baseline/` como copia literal git-tracked de `features/dashboard/` previo a cambios (rollback). Owner: K.
- [x] **T095** Reescribir `features/dashboard/ConfluenceSignalsTable.tsx` con las columnas del PDF v1 (`TICKET | CORE | SUBCORE | PRECIO | TIPO SEÑAL | FECHA | TIMEFRAME | TENDENCIA | SCORE | PESO | INVERTIR | ESTADO | OBSERVACION`), consumiendo `/api/signals/confluence-table`. Owner: E. Depende: T085.
- [x] **T096** [P] `features/dashboard/ObservationCell.tsx`: render estructurado de `SignalObservation` (Objetivo/Señal/Explicacion + chips de metricas). Owner: E.
- [x] **T097** [P] `features/dashboard/OptionGreeksRow.tsx`: subrow colapsable que muestra `OptionGreeks` cuando la fila la trae. Owner: E.
- [x] **T098** Crear `features/dashboard/simulation/SimulationControlPanel.tsx` con: rango historico (preset 2A/1A/6M/3M/1M), rango estrategia (date range), temporalidad, ESTRATEGIA (`StrategySelector`), TOLERANCIA RIESGO (`RiskToleranceToggle`), toggles SI/NO por core y por indicador, boton `EJECUTAR SIMULACION`. Owner: E. Depende: T086.
- [x] **T099** [P] `simulation/StrategySelector.tsx`, `simulation/RiskToleranceToggle.tsx`, `simulation/ExecuteSimulationButton.tsx`. Owner: E.
- [x] **T100** Actualizar `features/dashboard/MainDashboard.tsx`: integrar `SimulationControlPanel` arriba, `ConfluenceSignalsTable` debajo del chart; conservar `ExplainabilityTable` y `SignalEvidencePanel` como detalles. Owner: H. Depende: T095, T098.
- [x] **T101** Reemplazar toggles "enabled" del `CoreSelector` por toggles SI/NO explicitos por cada uno de los 6 analisis (PDF). Owner: H.
- [x] **T102** Wiring `useSignalStore`: al hacer click en una fila de la tabla, abrir `SignalEvidencePanel` con `evidencia_refs[]` resueltos. Owner: H. Depende: T095.
- [x] **T103** Tests PWA `tests/dashboard/ConfluenceSignalsTable.test.tsx` y `simulation/SimulationControlPanel.test.tsx`. Owner: E.

### Bloque D — Chat IA estructurado

- [x] **T104** Extender `src/modules/indicators/chatExplainer.ts` para producir `SignalObservation` tipada (no solo texto libre) cuando se invoca desde el pipeline de simulacion. Owner: H. Depende: T080.
- [x] **T105** Garantizar `ia_revisada: true` + `disclaimer_id` en toda fila con `core = A_IA` (constitucional `RNF-001`, SC-009). Owner: H. Depende: T082.
- [x] **T106** Test e2e `tests/e2e/simulationPipeline.test.ts`: `POST /simulation/run` -> tabla -> filas IA con disclaimer -> verdict derivado coherente. Owner: H. Depende: T086, T104.

### Bloque E — Calidad y documentacion

- [x] **T107** Cobertura unit >= 80% en `modules/indicators/confluenceTable`, `modules/indicators/coreStubs`, `modules/simulation/runner`. Owner: H.
- [x] **T108** `npm run lint:fic` y `npm run -w @inversions/rest-api lint` sin errores en archivos Phase 5. Owner: H.
- [x] **T109** Documentar en `specs/003-team-02-core-indicadores/quickstart.md` el flujo "EJECUTAR SIMULACION -> tabla -> verdict" con ejemplo `curl`. Owner: H.
- [x] **T110** Actualizar OpenAPI `confluence.openapi.yaml` para marcar `metadata: Record<string, unknown>` como deprecado (FR-020). Owner: M.

### Phase 5 — Clarifications previas a implementacion

- [x] **T111** ¿Lista canonica de `estrategia` (IRON_CONDOR, BULL_CALL_SPREAD, ...) la define este feature o el cadenero de opciones?. Owner: lead.
- [x] **T112** ¿`invertir` (S/N) es regla backend o accion manual del usuario en la tabla? — define si hay `PATCH` por fila. Owner: lead.
- [x] **T113** ¿Greeks se calculan aqui, vienen del broker o son input manual?. Owner: M + TEAM-01.
- [x] **T114** Confirmar que los stubs `A_FUNDAMENTAL`, `A_INSTITUCIONAL`, `A_NOTICIAS` viven en TEAM-02 (temporal) o se delegan a un feature nuevo. Owner: lead.

---

## Resumen de progreso

- Completado: TODAS las phases 0-6 (T000-T148). 
- Backend: 233/233 tests passing (41 archivos). PWA: 16/16 tests passing (5 archivos). Lint TypeScript OK.
- Phase 5 Bloque B: nuevos endpoints `GET /api/signals/confluence-table` y `POST /api/simulation/run` + runner + persistencia + 12 tests nuevos.
- Phase 5 Bloque C: nueva `ConfluenceSignalsTable` (13 columnas PDF v1), `SimulationControlPanel` + `StrategySelector` + `RiskToleranceToggle` + `ExecuteSimulationButton`, `ObservationCell`, `OptionGreeksRow`, toggles SI/NO en `CoreSelector`, integracion en `MainDashboard`.
- Phase 5 Bloque D: `SignalObservation` tipada en `chatExplainer`, `ia_revisada:true` + `disclaimer_id` automaticos, e2e simulation pipeline.
- Phase 5 Bloque E: cobertura, lint, `quickstart.md` + metadata deprecado en `confluence.openapi.yaml`.
- Phase 6 Bloque A: `llmAnthropic.ts` con Claude Opus 4.7 + prompt caching + 2 reintentos + degradacion grace.
- Phase 6 Bloque B: `chatExplanationsStore.ts` con TTL 90 dias + job de purga con alerta tras 3 fallos.
- Phase 6 Bloque C: nuevo middleware `indicatorsRateLimit.ts` con dos buckets (60/min indicadores, 10/min chat) por user_id.
- Phase 6 Bloque D: tests US7 (401 AUTH_REQUIRED, 401 AUTH_INVALID, 403 AUTH_FORBIDDEN) en 4 endpoints representativos.
- Phase 6 Bloque E: health con 3 dependencias paralelas (OHLC + Anthropic + Supabase) timeout 1.5s c/u.
- Phase 6 Bloque F: `thresholds.ts` centraliza VERDICT_THRESHOLDS y ADX_THRESHOLDS + tests parametrizados con limites exactos.
- Phase 6 Bloque G: `cache.ts` in-process por sha256(symbol|timeframe|params|last_bar_ts), TTL = duracion de 1 vela.
- Phase 6 Bloque H: documentacion y contratos OpenAPI actualizados.

## Phase 6: Implementacion post-clarify + post-correcciones (deriva de spec actualizado)

**Objetivo**: materializar en codigo las 5 decisiones de `/speckit.clarify` (Q1-Q5) y las 8 correcciones aplicadas al spec tras el checklist `requirements.md`. Estas tareas son ortogonales a Phase 5 (tabla canonica): pueden ejecutarse en paralelo, pero algunas (T120, T121) son prerequisito para que el LLM real funcione end-to-end.

### Bloque A — Integracion LLM Anthropic Opus 4.7 (Q1)

- [x] **T120** Instalar dependencia `@anthropic-ai/sdk` en workspace `@inversions/rest-api` y configurar `ANTHROPIC_API_KEY` en `.env.example`. Owner: H.
- [x] **T121** Crear `src/modules/indicators/llmAnthropic.ts` implementando `LlmExplainer` con Claude Opus 4.7 (`claude-opus-4-7`), prompt caching habilitado en system prompt + indicators_cited. Owner: H. Depende: T120.
- [x] **T122** Reemplazar `DeterministicMockExplainer` en runtime (mantenerlo solo para CI con flag `NODE_ENV=test`). Owner: H. Depende: T121.
- [x] **T123** Tests unitarios `tests/unit/indicators/llmAnthropic.test.ts`: degradacion (LLM caido, rate-limited), reintentos (1s + 2s backoff), preservacion de disclaimer. Owner: H. Depende: T121.
- [x] **T124** Edge Case en chatExplainer: try/catch con 2 reintentos exponenciales; si falla, respuesta 200 + `degraded:true` + `error_code:"LLM_UNAVAILABLE"|"LLM_RATE_LIMITED"` (spec Edge Cases). Owner: H. Depende: T121.

### Bloque B — Persistencia Chat IA con TTL 90 dias (Q3)

- [x] **T125** Migracion Supabase `migrations/00X_chat_explanations.sql`: tabla `chat_explanations` con campos `id, user_id, symbol, timeframe, question, explanation_text, indicators_cited (JSONB), disclaimer, model_version, tokens_in, tokens_out, computed_at, expires_at` + indice `expires_at`. Owner: M.
- [x] **T126** Modulo `src/modules/indicators/chatExplanationsStore.ts`: insert tras cada respuesta del chat + `expires_at = computed_at + 90 days`. Owner: H. Depende: T125.
- [x] **T127** Cron / pg_cron / Supabase Edge Function para purga diaria: `DELETE FROM chat_explanations WHERE expires_at < now()`. Owner: M. Depende: T125.
- [x] **T128** Resiliencia del job de purga: logs estructurados, retry al siguiente ciclo si falla, alerta tras 3 fallos consecutivos (spec Edge Cases). Owner: M. Depende: T127.
- [x] **T129** Tests integracion `tests/integration/chatExplanationsStore.test.ts`: insert + select + purga deterministica. Owner: M.

### Bloque C — Rate limiting 60/10 req/min (Q4)

- [x] **T130** Instalar `express-rate-limit` y crear `src/middleware/rateLimit.ts` con dos buckets: 60/min en `/api/indicators/*`, `/api/signals/*`, `/api/simulation/*`; 10/min en `/api/chat/explain`. Clave por `user_id` JWT. Owner: K.
- [x] **T131** Migracion Supabase `migrations/00Y_rate_limit_buckets.sql` (production multi-instancia). Owner: K.
- [x] **T132** Storage adapter: en memoria (`Map<userId, {count, resetAt}>`) en dev/CI; Supabase en production via env flag. Owner: K. Depende: T130, T131.
- [x] **T133** Respuesta 429 estructurada: `{ error_code:"RATE_LIMITED", retry_after_seconds, message, hint }` (FR-009). Owner: K. Depende: T130.
- [x] **T134** Tests integracion `tests/integration/rateLimit.test.ts`: limite exacto, reset, distincion por user_id. Owner: K.

### Bloque D — Auth scenarios (US7, CHK045)

- [x] **T135** Tests integracion `tests/integration/auth/authScenarios.test.ts` cubriendo los 3 escenarios de US7:
  - 401 `AUTH_REQUIRED` (sin header `Authorization`)
  - 401 `AUTH_INVALID` (JWT expirado o firma invalida)
  - 403 `AUTH_FORBIDDEN` (rol fuera de `viewer|trader|admin`)
  - Aplicado a 1 endpoint representativo por familia (`/api/indicators/rsi`, `/api/signals/confluence-table`, `/api/simulation/run`, `/api/chat/explain`).
  Owner: H. Depende: middleware existente `authContext.ts` (sin cambios de codigo, solo cobertura).

### Bloque E — Health endpoint con 3 dependencias (FR-013, CHK006)

- [x] **T136** Extender `src/modules/indicators/health.ts` para chequear las 3 dependencias en paralelo con timeout 1.5 s c/u: (a) OHLC source (1 candle), (b) Anthropic ping con `max_tokens=1`, (c) Supabase select trivial. Owner: M. Depende: T121, T125.
- [x] **T137** Refactor `src/routes/indicators/health.ts` para devolver `{ status, dependencies: [{name, status:"up"|"degraded"|"down", latency_ms}] }`. 200 si al menos 1 up; 503 si TODAS down. Owner: M. Depende: T136.
- [x] **T138** Tests integracion `tests/integration/indicators/healthRoute.test.ts`: cada combinacion (up/up/up, mixto, down/down/down). Owner: M.

### Bloque F — Constantes de umbrales (FR-006 verdict + FR-004 ADX)

- [x] **T139** Centralizar umbrales ADX en `src/modules/indicators/adx.ts` como constantes exportadas: `ADX_THRESHOLDS = { sin_tendencia: 20, debil: 25, fuerte: 50 }`. Actualizar tests para usar las constantes y cubrir los 4 buckets. Owner: E.
- [x] **T140** Centralizar umbrales de verdict en `src/modules/indicators/confluence.ts`: `VERDICT_THRESHOLDS = { alcista: 0.2, bajista: -0.2 }`. Asegurar que `score=0.2` cae en `neutral` (inclusivo en ambos lados). Owner: M.
- [x] **T141** Tests parametrizados en `tests/unit/indicators/adx.test.ts` y `confluence.test.ts` que validen los limites exactos. Owner: E + M.

### Bloque G — Cache in-process (Q5)

- [x] **T142** Modulo `src/modules/indicators/cache.ts` con interface `IndicatorCache.get/set`, clave `sha256(symbol|timeframe|params|last_bar_ts)`, TTL = duracion de 1 vela (`{ "1m":60, "5m":300, ..., "1d":86400 }`). Owner: K.
- [x] **T143** Aplicar cache a las 5 rutas de indicadores + confluencia. Cache miss recomputa, cache hit retorna identica respuesta con flag `cached:true` opcional. Owner: K. Depende: T142.
- [x] **T144** Tests `tests/unit/indicators/cache.test.ts`: hit/miss, TTL exacto, invalidacion por `last_bar_ts` nuevo. Owner: K.

### Bloque H — Cierre Phase 6

- [x] **T145** Pasada de cobertura: `npm run -w @inversions/rest-api test -- --coverage` debe mantenerse >= 80% incluyendo los modulos nuevos (`llmAnthropic`, `chatExplanationsStore`, `rateLimit`, `cache`, `health`). Owner: H.
- [x] **T146** `npm run lint:fic` y `npm run -w @inversions/rest-api lint` sin errores. Owner: H.
- [x] **T147** Actualizar `contracts/chat-explain.openapi.yaml` y `contracts/health.openapi.yaml` con los nuevos campos (`degraded`, `error_code: LLM_*`, `dependencies[]`). Owner: H + M.
- [x] **T148** Documentar en `quickstart.md`: como configurar `ANTHROPIC_API_KEY`, como simular degradacion del LLM, como inspeccionar `chat_explanations`. Owner: H.
