# Implementation Plan: Core de Indicadores Tecnicos + Chat IA (TEAM-02)

**Branch**: `003-team-02-core-indicadores` | **Date**: 2026-05-19 | **Updated**: 2026-05-25 (post-clarify + post-correcciones spec) | **Spec**: `./spec.md`
**Equipo**: TEAM-02 CocaDe6Lts
**Spec Status**: Clarified (5 items resueltos en sesion 2026-05-25); checklist `requirements.md` 46/46 cerrado.

## Summary

Implementar 5 indicadores tecnicos (RSI, MACD, EMA, ADX, Bollinger Bands), un motor de confluencia y un Chat IA explicativo, todo expuesto como endpoints REST en el workspace existente `projects/rest-api/inversions_api`. Cada indicador es modulo puro (calculo) + ruta Express (transporte), siguiendo el patron actual del repo. Confluencia compone los 5. Chat IA orquesta prompt + LLM y exige disclaimer no operativo.

## Technical Context

- **Language/Version**: TypeScript 5.6, Node 22.
- **Primary Dependencies**: express 4.21, vitest 4.1 (tests), supertest 7.2 (integration), jsonwebtoken 9 (auth), @supabase/supabase-js 2.105, **`@anthropic-ai/sdk` (Chat IA, Claude Opus 4.7 con prompt caching)**, **`express-rate-limit` (Q4)**.
- **Storage**: Supabase (Postgres). Tablas activas tras Phase 5: `ohlc_bars` (cache OHLC para Mode Offline), `chat_explanations` (TTL 90 dias, Q3), `confluence_signal_rows`, `signal_observations`, `option_legs`, `simulation_runs`, `confluence_columns`, `rate_limit_buckets` (production).
- **Testing**: vitest (`npm test` en workspace `@inversions/rest-api`).
- **Target Platform**: Linux/Windows server, Node runtime.
- **Project Type**: web-service (extension de monorepo existente).
- **Performance Goals**: < 200 ms p95 por indicador individual con 500 velas (SC-001); < 500 ms p95 confluencia compuesta (SC-002); **< 4 s p95 chat con Opus 4.7 + prompt caching (SC-010, fuera del path critico)**; **< 2 s p95 `POST /api/simulation/run` end-to-end (SC-008)**.
- **Constraints**: respuestas deterministas (mismo input -> mismo output), timestamps UTC, JSON body con `error_code|message|hint` en errores. **Rate limiting 60 req/min indicadores + 10 req/min chat por `user_id` (Q4)**.
- **Scale/Scope**: 5 indicadores + 1 confluencia + 1 chat + 1 health + 1 simulacion + 1 confluence-table = **10 endpoints REST**; uso interno team monorepo + dashboard PWA.

## Constitution Check

- **Modelo semi-automatico**: OK. Los indicadores y confluencia solo evaluan; no emiten ordenes.
- **IA no ejecuta (RNF-001)**: OK. Chat IA tiene gate `FR-011` (rechaza ejecucion + redirige) y `FR-019` (toda fila `core=A_IA` incluye `ia_revisada:true` + `disclaimer_id`). Auditable via `chat_explanations`.
- **Cores desacoplados (RNF-003)**: OK. Indicadores en `modules/indicators/`, sin acoplamiento a `modules/execution` ni `modules/brokers`.
- **Señales explicables y trazables (RNF-004)**: OK. Cada respuesta incluye `params`, `algorithm_version`, `computed_at`, `source_input_hash`. `chat_explanations` persiste tokens, model_version, indicators_cited (90 dias).
- **Reproducibilidad (RNF-002)**: OK. Cache por `last_bar_ts` + `source_input_hash` garantizan idempotencia (US3.3, US6.3, SC-003).
- **Latencia interactiva (RNF-005)**: OK separando chat (Opus 4.7, SC-010) del path critico (SC-001/SC-002).
- **Autenticacion (US7, FR-010)**: OK. Middleware existente `authContext.ts` reutilizado; 3 escenarios cubiertos (401 ausente, 401 invalido, 403 rol).
- **Idioma español**: artefactos Speckit en español; mensajes de error en español; comentarios FIC bilingues por convencion del repo.

## Data Source Routing & Runtime Modes

- **Source Domain `indicators`**: calculo local puro sobre candles OHLC. No depende de broker externo.
- **Source Domain `ohlc`** (insumo, resuelto Q2): Mode Online -> servicio `market-data` de TEAM-01 (IBKR). Mode Offline -> mock determinista. Hasta que TEAM-01 publique `market-data`, ambos modos retornan el mismo mock (compatible).
- **Routing Rule**: el modulo `ohlcSource` lee `runtime mode` desde header `X-Runtime-Mode` o env `RUNTIME_MODE`. Sin llamadas directas a Alpaca u otros brokers desde este feature.
- **Chat IA (resuelto Q1)**: Anthropic Claude **Opus 4.7** (`claude-opus-4-7`) via `@anthropic-ai/sdk`. Interface neutral `LlmExplainer.explain(prompt) -> { text, model, latency_ms, tokens_in, tokens_out }` se conserva para tests (mock determinista en CI). Prompt caching habilitado en system prompt + cita de indicadores.
- **Chat IA Persistencia (resuelto Q3)**: tabla `chat_explanations` con TTL 90 dias; job de purga diario con retry + alerta tras 3 fallos consecutivos (ver Edge Case en spec).
- **Rate Limiting (resuelto Q4)**: middleware `express-rate-limit` por `user_id` JWT. 60 req/min en `/api/indicators/*` y `/api/signals/*` y `/api/simulation/*`; 10 req/min en `/api/chat/explain`. Storage en memoria (dev/CI), `rate_limit_buckets` en Supabase (production). Respuesta 429 con `{ error_code: "RATE_LIMITED", retry_after_seconds, message, hint }`.
- **Cache (default Q5)**: in-process por clave `sha256(symbol|timeframe|params|last_bar_ts)`, TTL = duracion de 1 vela del timeframe. Migrar a Redis solo si SC-001 no se cumple.

## Project Structure

### Documentation (this feature)

```text
specs/003-team-02-core-indicadores/
├── plan.md          # este archivo
├── spec.md          # feature spec
├── contracts/       # OpenAPI/JSON Schema por endpoint
│   ├── rsi.openapi.yaml
│   ├── macd.openapi.yaml
│   ├── ema.openapi.yaml
│   ├── adx.openapi.yaml
│   ├── bollinger.openapi.yaml
│   ├── confluence.openapi.yaml
│   └── chat-explain.openapi.yaml
├── checklists/
└── tasks.md         # generado por /speckit.tasks
```

### Source Code (extension de monorepo existente)

```text
projects/rest-api/inversions_api/
├── src/
│   ├── modules/
│   │   └── indicators/                    # NUEVO modulo
│   │       ├── types.ts                   # OhlcBar, IndicatorResult, ConfluenceVerdict
│   │       ├── ohlcSource.ts              # adapter a market-data (mock por ahora)
│   │       ├── rsi.ts                     # KEVIN: calculo puro RSI
│   │       ├── macd.ts                    # KEVIN: calculo puro MACD
│   │       ├── ema.ts                     # EDGAR
│   │       ├── adx.ts                     # EDGAR
│   │       ├── bollinger.ts               # EDGAR
│   │       ├── confluence.ts              # MAURICIO
│   │       └── chatExplainer.ts           # HANSEL
│   └── routes/
│       └── indicators/
│           ├── catalog.ts                 # ya existe
│           ├── rsi.ts                     # KEVIN: ruta REST
│           ├── macd.ts                    # KEVIN: ruta REST
│           ├── ema.ts                     # EDGAR
│           ├── adx.ts                     # EDGAR
│           ├── bollinger.ts               # EDGAR
│           ├── confluence.ts              # MAURICIO
│           └── chatExplain.ts             # HANSEL
└── tests/
    ├── unit/indicators/
    │   ├── rsi.test.ts                    # KEVIN
    │   ├── macd.test.ts                   # KEVIN
    │   ├── ema.test.ts                    # EDGAR
    │   ├── adx.test.ts                    # EDGAR
    │   ├── bollinger.test.ts              # EDGAR
    │   └── confluence.test.ts             # MAURICIO
    └── integration/indicators/
        ├── rsiRoute.test.ts               # KEVIN
        ├── macdRoute.test.ts              # KEVIN
        ├── emaRoute.test.ts               # EDGAR
        ├── adxRoute.test.ts               # EDGAR
        ├── bollingerRoute.test.ts         # EDGAR
        ├── confluenceRoute.test.ts        # MAURICIO
        └── chatExplainRoute.test.ts       # HANSEL
```

**Structure Decision**: Extension del workspace `@inversions/rest-api` (no nuevo servicio). Cada indicador es par `(modules/indicators/<id>.ts, routes/indicators/<id>.ts)` siguiendo el patron de `routes/indicators/catalog.ts` y `routes/market-data/ohlc.ts`.

### Archivos adicionales tras correcciones (Phases 2-4)

```text
projects/rest-api/inversions_api/
├── src/
│   ├── middleware/
│   │   └── rateLimit.ts                 # NUEVO: 60/10 req/min por user_id (Q4)
│   └── modules/
│       └── indicators/
│           ├── health.ts                # NUEVO: chequeo de 3 dependencias (FR-013)
│           ├── llmAnthropic.ts          # NUEVO: implementacion concreta del LlmExplainer con Opus 4.7 + caching
│           └── chatExplanationsStore.ts # NUEVO: insert/purge en `chat_explanations`
├── migrations/
│   ├── 00X_chat_explanations.sql        # NUEVO: tabla + indice expires_at (Q3)
│   └── 00Y_rate_limit_buckets.sql       # NUEVO: production multi-instancia
└── tests/
    ├── unit/indicators/
    │   ├── health.test.ts               # NUEVO
    │   └── llmAnthropic.test.ts         # NUEVO: degradacion + reintentos
    ├── integration/
    │   ├── auth/
    │   │   └── authScenarios.test.ts    # NUEVO: US7 (401, 403)
    │   └── indicators/
    │       └── healthRoute.test.ts      # NUEVO
    └── contract/
        └── errorEnvelope.test.ts        # NUEVO: valida cuerpo `{error_code,message,hint}` en todos los endpoints
```

## Decisiones Tecnicas

1. **Calculo local puro**: cada indicador es funcion pura `(candles, params) => IndicatorResult`. No dependencias externas para calculo. SC-003 se valida en CI contra `technicalindicators` npm como referencia (no en runtime).
2. **OHLC source**: helper compartido `ohlcSource.getCandles(symbol, timeframe, count)` reutiliza la logica determinista de `routes/market-data/ohlc.ts`. Cuando TEAM-01 publique IBKR via `market-data`, solo cambia este modulo (Q2).
3. **Auth (US7)**: reutilizar `middleware/authContext.ts` global. Los endpoints requieren rol `viewer|trader|admin`. Casos: sin header -> 401 `AUTH_REQUIRED`; JWT invalido/expirado -> 401 `AUTH_INVALID`; rol no autorizado -> 403 `AUTH_FORBIDDEN`. Cuerpo siempre `{ error_code, message, hint }` (FR-009).
4. **Errores**: helper `respondError(res, status, code, message, hint)` para formato uniforme.
5. **Trazabilidad (FR-008)**: cada respuesta incluye `algorithm_version: "1.0.0"`, `computed_at: ISO`, `source_input_hash: sha256(candles_truncated)`.
6. **Confluencia degradada**: si un indicador falla, el endpoint retorna 200 con `degraded: true` y omite ese componente; nunca 500 por indicador faltante.
7. **Umbrales ADX**: clasificacion canonica `sin_tendencia` (`<20`), `debil` (`20-25`), `fuerte` (`25-50`), `muy_fuerte` (`>=50`) — constantes en `adx.ts`, tests deterministas (FR-004, US2.2).
8. **Verdict de confluencia (FR-006)**: `score` numerico `[-1,1]`; verdict literal derivado con umbrales `alcista` (`>0.2`), `neutral` (`[-0.2, 0.2]`), `bajista` (`<-0.2`). Constantes en `confluence.ts`.
9. **Health endpoint (FR-013)**: `GET /api/indicators/health` chequea 3 dependencias en paralelo (timeout 1.5 s c/u): (a) OHLC source (1 candle), (b) Anthropic ping con `max_tokens=1`, (c) Supabase select trivial. Respuesta `{ status, dependencies: [{name, status, latency_ms}] }`. 200 incluso si una degrada; 503 solo si TODAS down.
10. **LLM degradacion (Edge Case)**: `chatExplainer` envuelve la llamada Anthropic en try/catch con 2 reintentos exponenciales (1s, 2s). Si tras retries falla, retorna 200 con `degraded:true`, `explanation_text:""`, `error_code: "LLM_UNAVAILABLE"|"LLM_RATE_LIMITED"`, `disclaimer` presente. Nunca propaga 5xx del proveedor.
11. **Job de purga TTL `chat_explanations`**: cron diario que ejecuta `DELETE FROM chat_explanations WHERE expires_at < now()`. Implementado como Supabase Edge Function o pg_cron. Logs estructurados, retry al siguiente ciclo si falla, alerta si 3 fallos consecutivos. No bloquea inserts nuevos.
12. **Rate limiting**: middleware separado del auth (despues de auth para identificar `user_id`). Buckets en memoria (`Map<userId, {count, resetAt}>`) en dev/CI; `rate_limit_buckets` en Supabase para production multi-instancia.

## Data Model v2 (Phase 5 — Tabla Canonica de Confluencia)

A partir de Phase 5, la fuente unica de verdad de la confluencia es la **tabla de filas por core**, no el verdict consolidado. `ConfluenceVerdict` pasa a ser una **proyeccion derivada** de `ConfluenceSignalRow[]`.

### Entidades nuevas (TypeScript)

```ts
type CoreId =
  | "A_INDICADORES" | "A_FUNDAMENTAL" | "A_TECNICO"
  | "A_INSTITUCIONAL" | "A_NOTICIAS" | "A_IA";

type TipoSenal = "CALL" | "PUT" | "HOLD";
type Tendencia = "ALCISTA" | "BAJISTA" | "LATERAL";
type EstadoSenal = "ACTIVA" | "EXPIRADA" | "INVALIDADA" | "DEGRADADA";
type DeltaPrev = "NUEVA" | "CONFIRMADA" | "INVERTIDA" | "DEGRADADA";

interface SignalObservation {
  objetivo: string;
  senal: string;
  explicacion: string;
  metricas: Partial<Record<
    "MARKET_CAP" | "CASH" | "DIVIDENDO" | "EMPLEADOS" | "VOLATILIDAD"
    | "VOLUMEN" | "SENTIMIENTO" | "MONTO_USD" | "FONDO" | "FILING_DATE"
    | "PERIODO" | "MODEL_VERSION",
    number | string
  >>;
}

interface OptionGreeks {
  ala: "ALA1" | "ALA2";
  vencimiento: string;
  strike: number;
  gamma: number; theta: number; delta: number;
  posicion: "SHORT" | "LONG";
  tolerancia: "BAJO" | "MEDIO" | "ALTO";
}

interface ConfluenceSignalRow {
  ticket: string;
  core: CoreId;
  subCore?: "RSI" | "MACD" | "EMA" | "ADX" | "BB" | string;
  precio: number;
  tipoSenal: TipoSenal;
  fecha: string;          // ISO date
  timeframe: string;
  tendencia: Tendencia;
  score: number;          // [-1, 1]
  peso: number;           // contribucion al verdict
  invertir: boolean;
  estado: EstadoSenal;
  vigencia: string;       // ISO timestamp
  fuente: string;
  evidencia_refs: string[];
  ia_revisada: boolean;
  disclaimer_id?: string;
  delta_vs_anterior: DeltaPrev;
  observacion: SignalObservation;
  optionLeg?: OptionGreeks;
  algorithm_version: string;
  computed_at: string;
  source_input_hash: string;
}

interface SimulationRequest {
  ticket: string;
  rangoHistorico: "2A" | "1A" | "6M" | "3M" | "1M" | { from: string; to: string };
  rangoEstrategia: { from: string; to: string };
  temporalidad: string;
  runtimeMode: "ONLINE" | "OFFLINE";
  coresHabilitados: CoreId[];
  indicadoresHabilitados: ("RSI"|"MACD"|"EMA"|"ADX"|"BB")[];
  estrategia: string;     // "IRON_CONDOR" | ...
  toleranciaRiesgo: "BAJO" | "MEDIO" | "ALTO";
}
```

### Schema Supabase (propuesto)

- `confluence_signal_rows` (1 fila por core por corrida) con FK opcional a `signal_observations` y `option_legs`.
- `signal_observations` (objetivo/senal/explicacion + JSONB `metricas`).
- `option_legs` (greeks).
- `simulation_runs` (auditoria de cada `POST /simulation/run` con `inputs_echo` JSONB).
- `confluence_columns` (config metadata-driven con `field_key`, `label`, `data_type`, `visible`, `order_index`, `applies_to_cores TEXT[]`).
- Vista `v_confluence_table` que une fila + observacion + greeks para servir el endpoint sin N+1.

### Source of Truth

`POST /api/simulation/run` y `GET /api/signals/confluence-table` retornan filas frescas. `GET /api/indicators/confluence` se mantiene por compatibilidad pero queda marcado como **derivado**: agrega por `ticket+timeframe` las filas de la tabla y produce `ConfluenceVerdict`.

### Cores no implementados (stubs)

`A_FUNDAMENTAL`, `A_INSTITUCIONAL`, `A_NOTICIAS` se emiten como filas `estado: "DEGRADADA"` con `observacion.explicacion = "core no implementado en este feature"` y `score=0`, `peso=0`. No bloquean Phase 5 y se sustituyen cuando lleguen los features dedicados.

## Frontend Structure (Phase 5)

```text
projects/pwa/inversions_app/src/features/
├── dashboard.v1-baseline/           # snapshot pre-cambios (rollback)
└── dashboard/
    ├── ConfluenceSignalsTable.tsx   # REWRITE: columnas del PDF v1
    ├── ObservationCell.tsx          # NUEVO: render estructurado
    ├── OptionGreeksRow.tsx          # NUEVO: subrow colapsable
    ├── simulation/
    │   ├── SimulationControlPanel.tsx   # NUEVO: panel del PDF
    │   ├── StrategySelector.tsx         # IRON_CONDOR | ...
    │   ├── RiskToleranceToggle.tsx
    │   └── ExecuteSimulationButton.tsx
    └── MainDashboard.tsx            # UPDATE: wiring del panel + tabla
```

## Backend Structure (Phase 5)

```text
projects/rest-api/inversions_api/src/
├── modules/
│   ├── indicators/
│   │   ├── confluenceTable.ts       # NUEVO: emite ConfluenceSignalRow[]
│   │   └── coreStubs.ts             # NUEVO: stubs Fundamental/Inst/Noticias
│   └── simulation/
│       └── runner.ts                # NUEVO: orquesta SimulationRequest
├── routes/
│   ├── signals/
│   │   └── confluenceTable.ts       # NUEVO: GET /api/signals/confluence-table
│   ├── simulation/
│   │   └── run.ts                   # NUEVO: POST /api/simulation/run
│   └── dashboard/
│       └── confluenceColumns.ts     # UPDATE: applies_to_cores[]
```

## Decisiones tecnicas adicionales (Phase 5)

1. **Tabla = SoT**: la confluencia consolidada se deriva de filas; nunca se calcula en paralelo. Evita drift entre tabla y verdict.
2. **Stubs por core no implementado**: emitir fila `DEGRADADA` (no omitir) mantiene el contrato visual del PDF y permite a TEAM-01 maquetar con datos reales desde el dia 1.
3. **Tipos opcionales**: `subCore`, `optionLeg`, `disclaimer_id` son opcionales por fila; el contrato OpenAPI lo refleja con `nullable: true`.
4. **Metadata-driven columns**: el dashboard NO hardcodea columnas; lee `confluence_columns` con `applies_to_cores[]` para mostrar/ocultar segun core de la fila.
5. **Idempotencia simulacion**: misma `SimulationRequest` + mismo `last_bar_ts` => mismas filas (hash en `source_input_hash`).
6. **Deprecacion controlada**: `GET /api/signals/confluence` (que usa `metadata: Record<string, unknown>`) se mantiene durante Phase 5; se retira en feature siguiente cuando el dashboard migre.

## Complexity Tracking

| Item | Justificacion |
|---|---|
| 6 entidades nuevas (Phase 5) | Necesarias para cumplir contrato visual del PDF v1; no hay forma de plegarlas sin perder columnas. |
| Stubs de 3 cores no implementados | Mejor que omitir: mantiene UX consistente y evita rework del PWA cuando lleguen los features reales. |
| Deprecacion de `metadata: Record<string, unknown>` | Es deuda tecnica conocida; reemplazo por schema tipado mejora auditabilidad (FR-008) y trazabilidad constitucional. |
| Tabla `confluence_columns` runtime-config | Permite al lead operativo activar/ocultar columnas sin redeploy; baja friccion entre TEAM-01 y TEAM-02. |
| LLM Opus 4.7 (vs Haiku) | Decision explicita del lead (Q1). Riesgo de latencia mitigado con SC-010 separado y prompt caching nativo. Reversible: cambio de `model` en `llmAnthropic.ts` sin tocar contratos. |
| Rate limiting con buckets en memoria (dev) + Supabase (prod) | Tradeoff simplicidad/horizontalidad. Implementacion unica detras del middleware; cambio de storage es transparente. |

## Plan-Ready Summary

- **Spec**: Clarified, checklist 46/46.
- **Plan**: 12 decisiones tecnicas (1-12) + Data Model v2 (Phase 5) + structures backend/frontend.
- **Endpoints totales**: 10 REST (5 indicadores + confluence + chat + health + simulation + confluence-table).
- **Migraciones nuevas**: `chat_explanations`, `confluence_signal_rows`, `signal_observations`, `option_legs`, `simulation_runs`, `confluence_columns`, `rate_limit_buckets` (production).
- **Riesgos abiertos**: latencia Opus 4.7 (mitigado por SC-010), dependencia bloqueante TEAM-01 (mitigado por mock determinista).
- **Listo para `/speckit.tasks`**: si.
