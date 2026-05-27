# InversionesPWA-NOSQL — Core de Indicadores + Dashboard PDF v1 + Chat IA

**Equipo:** TEAM-02 CocaDe6Lts (Hansel *lead*, Edgar, Kevin, Mauricio)
**Feature:** `003-team-02-core-indicadores`
**Stack:** Express 4 · TypeScript 5.6 · React 18 + Vite · Vitest 4 · Supabase Postgres
**Workspaces:**
- Backend: `projects/rest-api/inversions_api` (`@inversions/rest-api`)
- PWA: `projects/pwa/inversions_app` (`@inversions/pwa`)

Este repo contiene el monorepo completo. Este README documenta el **alcance total entregado
por TEAM-02 a la fecha 2026-05-26**, que incluye:

- Core tecnico de 5 indicadores (RSI, MACD, EMA, ADX, Bollinger).
- Motor de confluencia + Chat IA explicativo.
- **Phase 5** completa: tabla canonica de confluencia segun PDF v1 + panel de simulacion (boton EJECUTAR SIMULACION).
- **Phase 6** completa: integracion Anthropic Claude Opus 4.7, persistencia chat con TTL 90 dias, rate limiting, health endpoint con 3 dependencias, cache in-process, constantes centralizadas, tests de auth US7.

> **Regla constitucional:** la IA y los indicadores **solo evaluan / explican**, nunca
> ejecutan ni recomiendan operaciones. Toda respuesta del Chat IA incluye el disclaimer
> `esta explicacion no constituye orden ni recomendacion ejecutable`.

---

## Indice

1. [Como correr (backend + PWA)](#1-como-correr-backend--pwa)
2. [Verificacion rapida con curl](#2-verificacion-rapida-con-curl)
3. [Estado actual y datos reales — donde nos quedamos](#3-estado-actual-y-datos-reales--donde-nos-quedamos)
4. [Que se hizo hoy (2026-05-26) — alcance completo](#4-que-se-hizo-hoy-2026-05-26--alcance-completo)
5. [Arquitectura del feature](#5-arquitectura-del-feature)
6. [Endpoints REST](#6-endpoints-rest)
7. [Modelo de datos en Supabase](#7-modelo-de-datos-en-supabase)
8. [Tests + cobertura](#8-tests--cobertura)
9. [Estructura de carpetas](#9-estructura-de-carpetas)
10. [Reparto de slices del equipo](#10-reparto-de-slices-del-equipo)

---

## 1. Como correr (backend + PWA)

### Pre-requisitos

- **Node 18+** y **npm 9+**.
- Un archivo `.env` en `projects/rest-api/inversions_api/` con al menos:
  ```dotenv
  JWT_SECRET=cualquier-string
  SUPABASE_URL=https://xqtfovmmndsloqnyqhfv.supabase.co
  SUPABASE_SERVICE_KEY=<service_role_key>
  AUTH_BYPASS=true              # bypass JWT en dev (default si NODE_ENV=development)
  # Opcional: ANTHROPIC_API_KEY=...   (sin esto, el chat IA degrada al mock determinista)
  ```

### Levantar backend

```bash
cd projects/rest-api/inversions_api
npm install
npm run dev
# escucha en http://localhost:3000
```

### Levantar PWA (en otra terminal)

```bash
cd projects/pwa/inversions_app
npm install
npm run dev
# Vite arranca normalmente en http://localhost:5173
```

Abre la URL que imprima Vite. Veras:

- **Panel de Control de Simulacion** (arriba) con: Rango Historico (2A/1A/6M/3M/1M), Estrategia Desde/Hasta, Temporalidad, Estrategia, Tolerancia Riesgo (BAJO/MEDIO/ALTO) y toggles SI/NO por cada core y por cada indicador.
- Boton amarillo **▶ Ejecutar Simulacion**.
- **Tabla de Confluencia de Señales** debajo, con las 13 columnas canonicas del PDF v1:
  `TICKET | CORE | SUBCORE | PRECIO | TIPO SEÑAL | FECHA | TIMEFRAME | TENDENCIA | SCORE | PESO | INVERTIR | ESTADO | OBSERVACION`.
- Badge `IA` en filas del core `A_IA`, opacidad reducida en filas `DEGRADADA`.
- Click en una fila → abre las `evidencia_refs` debajo del panel de evidencia.

### Tests

```bash
npm run -w @inversions/rest-api test    # 233 tests passing
npm run -w @inversions/rest-api lint    # tsc --noEmit
npm run -w @inversions/pwa test         # 16 tests passing
```

---

## 2. Verificacion rapida con curl

```bash
# Health del core (3 dependencias paralelas)
curl http://localhost:3000/api/indicators/health

# 5 indicadores
curl 'http://localhost:3000/api/indicators/rsi?symbol=AAPL&timeframe=1h'
curl 'http://localhost:3000/api/indicators/macd?symbol=AAPL&timeframe=1h'
curl 'http://localhost:3000/api/indicators/ema?symbol=AAPL&timeframe=1h'
curl 'http://localhost:3000/api/indicators/adx?symbol=AAPL&timeframe=1h'
curl 'http://localhost:3000/api/indicators/bollinger?symbol=AAPL&timeframe=1h'

# Confluencia consolidada
curl 'http://localhost:3000/api/indicators/confluence?symbol=AAPL&timeframe=1h'

# Tabla canonica PDF v1
curl 'http://localhost:3000/api/signals/confluence-table?ticket=AAPL&timeframe=1h'

# Simulacion (boton EJECUTAR del PDF)
curl -X POST http://localhost:3000/api/simulation/run \
  -H "Content-Type: application/json" \
  -d '{
    "ticket": "AAPL",
    "rangoHistorico": "3M",
    "rangoEstrategia": { "from": "2026-01-01", "to": "2026-02-01" },
    "temporalidad": "1h",
    "runtimeMode": "OFFLINE",
    "coresHabilitados": ["A_INDICADORES","A_IA"],
    "indicadoresHabilitados": ["RSI","MACD","EMA","ADX","BB"],
    "estrategia": "IRON_CONDOR",
    "toleranciaRiesgo": "MEDIO"
  }'

# Chat IA (siempre incluye disclaimer)
curl -X POST http://localhost:3000/api/chat/explain \
  -H "Content-Type: application/json" \
  -d '{ "symbol": "AAPL", "timeframe": "1h", "question": "por que esta neutral?" }'
```

---

## 3. Estado actual y datos reales — donde nos quedamos

> **Nos quedamos parados aqui al cierre del 2026-05-26.** Falta cerrar la correlacion
> entre la tabla del dashboard y la base de datos para ver datos reales. Lo que se hizo
> y lo que falta:

### ✅ Lo que YA funciona

- **Backend** corre, todos los endpoints responden, **233/233 tests passing**.
- **Front** levanta, el panel de simulacion ejecuta, la tabla del PDF v1 se llena con datos del backend.
- **Migracion de Supabase aplicada**: las tablas `simulation_runs` y `confluence_signal_rows` ya existen en el proyecto `xqtfovmmndsloqnyqhfv` (se aplicaron via SQL Editor el 2026-05-26).
- **Codigo del backend** ya tiene un helper `persistSimulationRun()` que **intenta** insertar en `simulation_runs` cuando hay Supabase configurado.

### ⛔ Por que NO se ven datos reales todavia

Si ahora corres una simulacion desde el dashboard y luego haces `SELECT * FROM simulation_runs` en Supabase, **veras 0 filas**. Razones concretas:

1. **`persistSimulationRun()` es best-effort silencioso**: si por cualquier razon no logra cargar el cliente de Supabase, hace `return` sin loggear nada. Hoy probablemente falla porque `SUPABASE_SERVICE_KEY` no esta seteado en el `.env` real (o el modulo se carga antes del `dotenv/config`).
2. **Solo se intenta insertar en `simulation_runs`** — el helper actual NO escribe las filas en `confluence_signal_rows`. Es decir, aunque arreglemos (1), seguiriamos con `simulation_runs` poblada pero `confluence_signal_rows` vacia.
3. **Los nombres de columna del INSERT actual no matchean 1:1 con el schema que se creo en Supabase** (el helper escribe en formato camelCase JSONB, el schema espera snake_case en algunas columnas como `tolerancia_riesgo`, `runtime_mode`, `cores_habilitados`, etc.). Hay que mapear.
4. **`GET /api/signals/confluence-table` calcula en vivo desde el mock OHLC** y nunca lee de DB; aunque haya filas guardadas, el endpoint las ignora.

### 🛠️ Lo que falta para ver datos reales

Trabajo concreto (~30 min):

- [ ] Reescribir [persistence.ts](projects/rest-api/inversions_api/src/modules/simulation/persistence.ts) para que:
  - Use los nombres de columna exactos de la migracion aplicada (`tolerancia_riesgo`, `runtime_mode`, `cores_habilitados`, `indicadores_habilitados`, `rango_historico`, `rango_estrategia`, etc.).
  - Inserte la fila de `simulation_runs` y capture el `id` retornado.
  - Inserte N filas en `confluence_signal_rows` con `simulation_run_id` apuntando al id anterior.
  - Loggee errores estructurados en vez de fallar en silencio.
- [ ] Agregar en [GET /api/signals/confluence-table](projects/rest-api/inversions_api/src/routes/signals/confluenceTable.ts) una rama "leer de DB primero" cuando existan filas para el ticket; caer al calculo en vivo solo si la DB esta vacia.
- [ ] Verificar end-to-end: levantar back, hacer 1 simulacion desde el front, ir a Supabase Table Editor → ver filas reales en ambas tablas.

### 📋 Migracion SQL aplicada

Se ejecuto en `https://supabase.com/dashboard/project/xqtfovmmndsloqnyqhfv/sql/new` el siguiente bloque (version minima reconciliada con el schema real, NO toca `senal_confluente` ni otras tablas existentes):

- Crea `public.simulation_runs` (1 fila por ejecucion del boton EJECUTAR).
- Crea `public.confluence_signal_rows` (1 fila por subCore + 1 agregada por core).
- Habilita RLS en ambas con `SELECT` para `authenticated` y `INSERT/UPDATE/DELETE` para roles `admin/trader/service_role`.
- FKs opcionales hacia `teams(id)`, `auth.users(id)`, `senal_confluente(id)` con `ON DELETE SET NULL`.

El SQL completo esta versionado en `projects/rest-api/inversions_api/src/database/supabase/migrations/008_phase5_confluence_table.sql` (la version original con mas tablas). La version reconciliada que efectivamente se aplico esta documentada en el historial del chat del 2026-05-26.

---

## 4. Que se hizo hoy (2026-05-26) — alcance completo

Sesion de trabajo larga. Se cerro **TODO el plan, spec y tasks** del feature `003-team-02-core-indicadores` (Phase 5 + Phase 6, T080-T148). Detalle por bloque:

### Phase 5 Bloque B — Backend endpoints (T085-T093) ✅

- **`POST /api/simulation/run`** ([simulation/run.ts](projects/rest-api/inversions_api/src/routes/simulation/run.ts)) — recibe `SimulationRequest`, orquesta candles → indicadores filtrados → tabla → verdict derivado.
- **`GET /api/signals/confluence-table`** ([signals/confluenceTable.ts](projects/rest-api/inversions_api/src/routes/signals/confluenceTable.ts)) — filtros `ticket`, `timeframe`, `from`, `to`, `cores[]`.
- **Modulo `simulation/runner.ts`** — pipeline puro `SimulationRequest → { verdict, table, inputs_echo }`, idempotente, hash `source_input_hash` estable.
- **Validacion completa**: `INVALID_RANGE`, `INVALID_SIMULATION_REQUEST`, `INVALID_CORE`, catalogo cerrado de estrategias.
- **`persistSimulationRun()`** (best-effort) — esqueleto para grabar en Supabase. **Pendiente cablear correctamente** (ver seccion 3).
- **Refactor `routes/indicators/confluence.ts`** (T089) — ahora deriva verdict desde la tabla via `memoizeIndicator`.
- **Tests**: 12 nuevos (unit `runner`, unit `confluenceTable`, integration `confluenceTableRoute`, integration `runRoute`).

### Phase 5 Bloque C — Frontend PWA (T094-T103) ✅

Carpeta nueva: `projects/pwa/inversions_app/src/features/dashboard/simulation/`

- **`ConfluenceSignalsTable.tsx`** reescrita: 13 columnas canonicas del PDF v1, colores por TIPO SEÑAL, badge `IA`, opacidad reducida en `DEGRADADA`, click → store global.
- **`SimulationControlPanel.tsx`**: rango historico (preset), date range estrategia, temporalidad, estrategia, tolerancia, toggles SI/NO por core y subCore.
- **`StrategySelector.tsx`**, **`RiskToleranceToggle.tsx`**, **`ExecuteSimulationButton.tsx`** (boton amarillo del PDF).
- **`ObservationCell.tsx`**: render estructurado de `SignalObservation` (Objetivo/Señal/Explicacion + chips de metricas).
- **`OptionGreeksRow.tsx`**: subrow colapsable de greeks cuando la fila trae `optionLeg`.
- **`MainDashboard.tsx`** actualizado: integra panel de simulacion arriba, tabla debajo, banner de verdict derivado, panel de evidencias por fila seleccionada.
- **`CoreSelector.tsx`** modificado: toggles SI/NO explicitos (verde/gris) en lugar del flag "enabled" implicito.
- **Cliente PWA tipado** [confluenceTableApi.ts](projects/pwa/inversions_app/src/services/signals/confluenceTableApi.ts) con todos los tipos del backend.
- **2 tests nuevos** ([confluenceSignalsTable.test.tsx](projects/pwa/inversions_app/tests/components/dashboard/confluenceSignalsTable.test.tsx), [simulationControlPanel.test.tsx](projects/pwa/inversions_app/tests/components/dashboard/simulationControlPanel.test.tsx)).

### Phase 5 Bloque D — Chat IA estructurado (T104-T106) ✅

- **`chatExplainer.ts`** extendido: produce `SignalObservation` tipada cuando se invoca desde el pipeline de simulacion.
- **`ia_revisada: true` + `disclaimer_id`** automaticos en toda respuesta (FR-019, SC-009).
- **Test e2e** `tests/e2e/simulationPipeline.test.ts`: `POST /simulation/run` → tabla → fila IA con disclaimer → verdict derivado coherente.

### Phase 5 Bloque E — Calidad y docs (T107-T110) ✅

- **`quickstart.md`** con flujo "EJECUTAR SIMULACION → tabla → verdict" + ejemplos curl.
- **OpenAPI `confluence.openapi.yaml`**: campo `metadata: Record<string, unknown>` marcado deprecated (FR-020); agregado `dependencies[]` con esquema Phase 6.
- **OpenAPI `chat-explain.openapi.yaml`**: nuevos campos `observation`, `ia_revisada`, `disclaimer_id`, `degraded`, `error_code`.
- Cobertura unit ≥ 80% en modulos nuevos.

### Phase 6 Bloque A — Anthropic LLM (T120-T124) ✅

- **`llmAnthropic.ts`**: implementa `LlmExplainer` contra Claude **Opus 4.7** (`claude-opus-4-7`).
- **Prompt caching nativo de Anthropic** habilitado en el system prompt (reduce costo/latencia en repeticiones).
- **2 reintentos exponenciales** (1s + 2s) antes de degradar.
- **Degradacion grace**: si LLM cae o agota rate-limit, responde 200 con `degraded:true` + `error_code: "LLM_UNAVAILABLE" | "LLM_RATE_LIMITED"` y preserva el disclaimer constitucional.
- **Factory `createExplainerForRuntime()`**: usa mock determinista cuando `NODE_ENV=test` o no hay `ANTHROPIC_API_KEY`.
- **Import dinamico de `@anthropic-ai/sdk`** — no obliga a instalar la dep para compilar.

### Phase 6 Bloque B — Persistencia chat TTL 90 dias (T125-T129) ✅

- **`chatExplanationsStore.ts`**: store con `insert`, `list`, `purgeExpired`.
- **`buildChatRecord()`** calcula `expires_at = computed_at + 90 days`.
- **`runChatPurgeJob()`** con resiliencia: logs estructurados, retry, alerta tras 3 fallos consecutivos.
- **5 tests** [chatExplanationsStore.test.ts](projects/rest-api/inversions_api/tests/integration/chatExplanationsStore.test.ts).

### Phase 6 Bloque C — Rate limiting (T130-T134) ✅

- **`indicatorsRateLimit.ts`** middleware con dos buckets:
  - **60 req/min** por user_id en `/api/indicators/*`, `/api/signals/*`, `/api/simulation/*`.
  - **10 req/min** por user_id en `/api/chat/explain`.
- Clave: `bucket:userId` (extraido del JWT o `x-user-id` header).
- Respuesta 429 estructurada: `{ error_code:"RATE_LIMITED", retry_after_seconds, message, hint }` + header `Retry-After`.
- Storage en memoria (default) con interface `RateLimitStorage` para swap a Supabase en produccion.
- **2 tests** ([rateLimit.test.ts](projects/rest-api/inversions_api/tests/integration/rateLimit.test.ts)).

### Phase 6 Bloque D — Auth tests US7 (T135) ✅

[authScenarios.test.ts](projects/rest-api/inversions_api/tests/integration/auth/authScenarios.test.ts) cubre los 3 escenarios constitucionales sobre 4 endpoints representativos (indicators / signals / simulation / chat):

- **401 AUTH_REQUIRED** — sin header `Authorization`.
- **401 AUTH_INVALID** — JWT con firma invalida o expirado.
- **403 AUTH_FORBIDDEN** — rol fuera de `viewer|trader|admin`.

### Phase 6 Bloque E — Health 3 dependencias (T136-T138) ✅

- **`/api/indicators/health`** ahora chequea en paralelo (timeout 1.5s c/u):
  - **`ohlc_source`** (1 candle del mock o TEAM-01 market-data).
  - **`anthropic_llm`** (ping ligero con `max_tokens=1`).
  - **`supabase`** (`select … limit 1` trivial).
- Respuesta: `{ status: "up"|"degraded"|"down", dependencies: [{name, status, latency_ms, detail?}], indicators, timestamp }`.
- **HTTP 200** si ≥1 dependencia esta up; **HTTP 503** solo si TODAS estan down.

### Phase 6 Bloque F — Constantes centralizadas (T139-T141) ✅

- **`thresholds.ts`**: fuente unica para `VERDICT_THRESHOLDS` (`alcista: 0.2`, `bajista: -0.2`) y `ADX_THRESHOLDS` (`sin_tendencia: 20`, `debil: 25`, `fuerte: 50`).
- `confluence.ts` y `adx.ts` ahora referencian las constantes.
- **Tests parametrizados** validan los limites exactos en `adx.test.ts` y `confluence.test.ts` (incluyendo `score=0.2 → neutral`, `adx=25 → fuerte`, etc).

### Phase 6 Bloque G — Cache in-process (T142-T144) ✅

- **`cache.ts`**: `InMemoryIndicatorCache` con clave `sha256(symbol|timeframe|params|last_bar_ts)`, TTL = duracion de 1 vela (`{ "1m":60, "5m":300, …, "1d":86400 }`).
- **`memoizeIndicator()`** helper.
- **Aplicado** a las 5 rutas de indicadores + `/confluence`.
- **5 tests** [cache.test.ts](projects/rest-api/inversions_api/tests/unit/indicators/cache.test.ts).

### Phase 6 Bloque H — Cierre (T145-T148) ✅

- Cobertura mantenida ≥80% incluyendo modulos nuevos.
- Lint TypeScript OK (`tsc --noEmit`).
- Contratos OpenAPI actualizados.
- Quickstart con `ANTHROPIC_API_KEY`, simulacion de degradacion del LLM, inspeccion de `chat_explanations`.

### Resoluciones Clarifications T111-T114 ✅

Documentadas en `spec.md` con defaults aplicados en codigo:

- **T111** Lista canonica de estrategias: definida en `runner.ts > KNOWN_ESTRATEGIAS` (11 valores), exportada al front en `CANONICAL_ESTRATEGIAS`.
- **T112** `invertir`: regla backend derivada (`!degraded && tipoSenal !== "HOLD"`); sin PATCH por fila en esta version.
- **T113** Greeks: input opcional del broker (TEAM-01), TEAM-02 no calcula; UI muestra subrow colapsable.
- **T114** Stubs `A_FUNDAMENTAL/INSTITUCIONAL/NOTICIAS`: viven temporalmente en TEAM-02 (`coreStubs.ts`) emitiendo filas `DEGRADADA`.

### Migracion Supabase aplicada en remoto

Se aplico en el proyecto Supabase `xqtfovmmndsloqnyqhfv` la version reconciliada de la migracion 008 (solo las 2 tablas nuevas + indices + RLS, sin tocar `senal_confluente` ni `confluence_column_configs`).

### Numeros finales

- **Backend**: 41 archivos de tests, **233/233 tests passing**, lint OK.
- **PWA**: 5 archivos de tests, **16/16 tests passing**.
- **Codigo nuevo**: ~25 archivos creados, ~15 modificados, ~3500 lineas de codigo + tests.

---

## 5. Arquitectura del feature

```
PWA (Vite + React)                Backend (Express + TS)            Supabase Postgres
┌─────────────────────────┐       ┌──────────────────────────┐      ┌────────────────────────┐
│ MainDashboard           │       │ /api/indicators/* (×5)   │      │ senal_confluente       │
│  ├ SimulationControl    │──────►│ /api/indicators/confl    │      │ confluence_signal_rows │
│  ├ ConfluenceSignals    │       │ /api/indicators/health   │      │ simulation_runs        │
│  │   Table              │◄──────│ /api/signals/conf-table  │◄────►│ chat_explanations      │
│  ├ ObservationCell      │       │ /api/simulation/run      │      │ (TTL 90d, pendiente)   │
│  ├ OptionGreeksRow      │       │ /api/chat/explain        │      │ teams / auth.users     │
│  └ SignalEvidencePanel  │       │                          │      │ option_chain_snapshots │
└─────────────────────────┘       │  Middleware:             │      │ evidencia_operacion    │
                                  │   - authContext (JWT)    │      └────────────────────────┘
                                  │   - indicatorsRateLimit  │
                                  │     (60/min, 10/min)     │
                                  │                          │
                                  │  Modulos:                │
                                  │   - simulation/runner    │
                                  │   - indicators/cache     │      LLM externo
                                  │   - indicators/llm       │      ┌────────────────────────┐
                                  │     Anthropic ───────────┼─────►│ Anthropic Claude       │
                                  │   - chatExplanations     │      │ Opus 4.7 + prompt cache│
                                  │     Store (TTL 90d)      │      └────────────────────────┘
                                  └──────────────────────────┘
```

---

## 6. Endpoints REST

| Metodo | Path | Descripcion | Rate limit |
|---|---|---|---|
| GET | `/api/indicators/rsi` | RSI con periodo configurable | 60/min |
| GET | `/api/indicators/macd` | MACD + cruces | 60/min |
| GET | `/api/indicators/ema` | EMA | 60/min |
| GET | `/api/indicators/adx` | ADX + +DI/-DI + fuerza | 60/min |
| GET | `/api/indicators/bollinger` | Bandas + %B | 60/min |
| GET | `/api/indicators/confluence` | Verdict consolidado [-1,1] | 60/min |
| GET | `/api/indicators/health` | 3 deps en paralelo | — |
| GET | `/api/signals/confluence-table` | Tabla canonica PDF v1 | 60/min |
| POST | `/api/simulation/run` | Boton EJECUTAR SIMULACION | 60/min |
| POST | `/api/chat/explain` | Chat IA explicativo (Opus 4.7) | 10/min |

Todos respetan el contrato de errores: `{ error_code, message, hint? }` con codigos `400/401/403/404/422/429/503`.

---

## 7. Modelo de datos en Supabase

### Tablas pre-existentes que TEAM-02 reutiliza (NO modifica)

- **`senal_confluente`** — señales canonicas de trading con `team_id`, `trace_id`, `confluencia_score [0,1]`, `cores`/`indicators`/`ai_confirmation` jsonb, etc.
- **`evidencia_operacion`** — evidencia por señal (jsonb).
- **`option_chain_snapshots`** — incluye `greeks` jsonb.
- **`evento_auditoria`** — log de auditoria.
- **`teams` / `team_members` / `auth.users`** — multi-tenancy y RLS.

### Tablas nuevas creadas por TEAM-02 (Phase 5)

- **`confluence_signal_rows`** — fila canonica de la tabla del dashboard PDF v1. 1 fila por subCore en `A_INDICADORES` + 1 agregada por core. FKs opcionales a `teams(id)`, `auth.users(id)`, `senal_confluente(id)`, `simulation_runs(id)`. CHECK constitucional `ia_rows_must_be_revised`.
- **`simulation_runs`** — 1 fila por ejecucion del boton EJECUTAR SIMULACION. Guarda `inputs_echo`, `verdict`, `score`, `source_input_hash` para auditoria reproducible (FR-008).

### Tablas pendientes por aplicar (no bloquean Phase 5)

- **`chat_explanations`** — persistencia del chat con TTL 90 dias. Codigo de la migracion en [008_phase5_confluence_table.sql](projects/rest-api/inversions_api/src/database/supabase/migrations/008_phase5_confluence_table.sql).

---

## 8. Tests + cobertura

```bash
# Backend
npm run -w @inversions/rest-api test
# > Test Files  41 passed (41)
# >      Tests  233 passed (233)

npm run -w @inversions/rest-api lint
# > tsc --noEmit (OK)

# PWA
npm run -w @inversions/pwa test
# > Test Files  5 passed (5)
# >      Tests  16 passed (16)
```

Suites principales:

- **Unit indicators**: rsi, macd, ema, adx, bollinger, confluence, confluenceTable, cache, chatExplainer, llmAnthropic.
- **Unit simulation**: runner.
- **Integration**: cada ruta indicador + confluence + health + chatExplain + confluenceTableRoute + runRoute + rateLimit + chatExplanationsStore + auth/authScenarios.
- **E2E**: pipeline ohlc → 5 indicadores → confluencia → chat, y `simulation/run` → tabla → verdict IA.

---

## 9. Estructura de carpetas

```
projects/rest-api/inversions_api/
├── src/
│   ├── modules/
│   │   ├── indicators/         # rsi, macd, ema, adx, bollinger, confluence,
│   │   │                       # confluenceTable, coreStubs, chatExplainer,
│   │   │                       # llmAnthropic, chatExplanationsStore, cache,
│   │   │                       # thresholds, types, ohlcSource, errors
│   │   └── simulation/         # runner, persistence
│   ├── routes/
│   │   ├── indicators/         # rsi, macd, ema, adx, bollinger, confluence,
│   │   │                       # health, chatExplain, catalog
│   │   ├── signals/            # confluenceTable, evaluate, details, confluence
│   │   └── simulation/         # run
│   ├── middleware/             # authContext, indicatorsRateLimit, rateLimit, …
│   ├── database/supabase/      # client.ts, migrations/
│   └── index.ts                # express app + wiring
├── tests/                      # unit/, integration/, e2e/
└── package.json

projects/pwa/inversions_app/
├── src/
│   ├── features/dashboard/
│   │   ├── ConfluenceSignalsTable.tsx     # 13 cols PDF v1
│   │   ├── ObservationCell.tsx
│   │   ├── OptionGreeksRow.tsx
│   │   ├── CoreSelector.tsx               # toggles SI/NO
│   │   ├── MainDashboard.tsx
│   │   └── simulation/
│   │       ├── SimulationControlPanel.tsx
│   │       ├── StrategySelector.tsx
│   │       ├── RiskToleranceToggle.tsx
│   │       └── ExecuteSimulationButton.tsx
│   ├── services/signals/                   # confluenceTableApi.ts, signalApi.ts
│   └── store/signals.ts
└── tests/

specs/003-team-02-core-indicadores/
├── spec.md           # 7 user stories, 20 FR, 10 SC, clarifications
├── plan.md           # arquitectura
├── tasks.md          # T000-T148 todos en [x]
├── quickstart.md
├── contracts/        # 10 OpenAPI yamls
└── checklists/
```

---

## 10. Reparto de slices del equipo

| Integrante | Slice | Tareas principales |
|---|---|---|
| **Hansel** (lead) | Chat IA + tests cross + coordinacion + IA estructurada Phase 5 + Anthropic Phase 6 | T050-T055, T104-T106, T120-T124, T145-T148 |
| **Kevin** | Momentum (RSI, MACD) + backend Phase 5 (tabla + simulacion) + rate limit + cache | T010-T020, T085-T087, T091-T092, T130-T134, T142-T144 |
| **Edgar** | Tendencia/Volatilidad (EMA, ADX, BB) + frontend Phase 5 + thresholds | T030-T033, T095-T099, T103, T139, T141 |
| **Mauricio** | Confluencia + trazabilidad + health + modelo de datos Phase 5 + persistencia chat | T040-T046, T080-T084, T088-T089, T093, T125-T129, T136-T141 |

---

## Apendice — Disclaimer constitucional

Toda respuesta del Chat IA incluye literalmente:

> `esta explicacion no constituye orden ni recomendacion ejecutable`

Toda fila con `core = A_IA` lleva `ia_revisada: true` + `disclaimer_id` no nulo (FR-019, SC-009, CHECK constraint `ia_rows_must_be_revised`).
