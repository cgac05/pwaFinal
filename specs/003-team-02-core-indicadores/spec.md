# Feature Specification: Core de Indicadores Tecnicos + Chat IA (TEAM-02 CocaDe6Lts)

**Feature Branch**: `003-team-02-core-indicadores`
**Created**: 2026-05-19
**Status**: Clarified (5 items resueltos en sesion 2026-05-25)
**Equipo**: TEAM-02 CocaDe6Lts (Hansel lead, Edgar, Kevin, Mauricio)
**Iniciativa**: 001-inversions
**Proyecto**: diana-inversions
**Fuente canonica**: `.drfic/diana-sdk/projects/diana-inversions/initiatives/001-inversions/teams/TEAM-02/spec.md`
**Cobertura canonica**: preserved RF-001..RF-006, RNF-001..RNF-005; expanded con user stories, acceptance scenarios y contratos operativos.

**Input**: Implementar el core de indicadores tecnicos (EMA, MACD, ADX, RSI, Bollinger Bands) sobre series OHLC, un motor de confluencia tecnica que consolida sus salidas y un Chat IA explicativo que justifica cada señal sin ejecutar operaciones. Exponer endpoints REST consumibles por el dashboard de TEAM-01 y por otros cores.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Calcular indicadores de momentum sobre un instrumento (Priority: P1)

Como analista del dashboard, quiero solicitar al backend los valores actuales y la serie historica de RSI y MACD para un instrumento y timeframe dados, de forma que pueda evaluar momentum y divergencias sin tener que calcularlos en el cliente.

**Why this priority**: Momentum (RSI/MACD) es la base operativa minima para que el dashboard muestre señales explicables. Sin este slice, el motor de confluencia no tiene insumo y el Chat IA no tiene que explicar. Es el slice de Kevin y desbloquea a Mauricio.

**Independent Test**: Llamar `GET /api/indicators/rsi?symbol=AAPL&timeframe=1h&period=14` y `GET /api/indicators/macd?symbol=AAPL&timeframe=1h` y verificar valores coherentes contra una serie OHLC de referencia. Sin frontend, validable por contract test.

**Acceptance Scenarios**:

1. **Given** una serie OHLC valida de al menos 30 velas para AAPL en 1h, **When** se solicita RSI con periodo 14, **Then** la respuesta incluye el valor actual entre 0 y 100, la serie historica alineada por timestamp y la zona (oversold/neutral/overbought).
2. **Given** una serie OHLC valida, **When** se solicita MACD con parametros default (12,26,9), **Then** la respuesta incluye linea MACD, linea señal, histograma y deteccion de cruce alcista/bajista en la ultima vela.
3. **Given** un symbol no soportado o sin datos, **When** se solicita cualquier indicador, **Then** la respuesta es 404 con cuerpo `{ error_code, message, hint }` y no se devuelve serie vacia silenciosa.
4. **Given** parametros invalidos (period <= 0, timeframe no soportado), **When** se solicita el indicador, **Then** la respuesta es 400 con detalle de campo invalido.

---

### User Story 2 - Calcular indicadores de tendencia y volatilidad (Priority: P1)

Como analista del dashboard, quiero solicitar EMA, ADX y Bollinger Bands para un instrumento y timeframe dados, de forma que pueda evaluar direccion, fuerza de tendencia y rangos de volatilidad.

**Why this priority**: Tendencia y volatilidad son las otras dos dimensiones que junto con momentum forman la confluencia minima. Slice de Edgar. Independiente del slice de Kevin: cada indicador es un endpoint propio.

**Independent Test**: Llamar `GET /api/indicators/ema?symbol=AAPL&timeframe=1h&period=20`, `/adx`, `/bollinger` y validar contra serie de referencia.

**Acceptance Scenarios**:

1. **Given** una serie OHLC con N >= period velas, **When** se solicita EMA con period=20, **Then** la respuesta incluye serie alineada y el valor actual numerico finito.
2. **Given** una serie con N >= 28 velas, **When** se solicita ADX con period=14, **Then** la respuesta incluye ADX, +DI, -DI y clasifica la tendencia segun los umbrales canonicos: `sin_tendencia` (ADX < 20), `debil` (20 <= ADX < 25), `fuerte` (25 <= ADX < 50), `muy_fuerte` (ADX >= 50).
3. **Given** una serie OHLC, **When** se solicita Bollinger con period=20 y stdDev=2, **Then** la respuesta incluye banda superior, media, banda inferior y ancho de banda relativo.

---

### User Story 3 - Confluencia tecnica consolidada (Priority: P2)

Como dashboard, quiero un endpoint unico que consolide los 5 indicadores en una señal tecnica explicable (alcista / neutral / bajista) con score y desglose por indicador, para no tener que orquestar las 5 llamadas y aplicar reglas en el cliente.

**Why this priority**: Es el "producto" del equipo. Depende de US1 y US2. Slice de Mauricio.

**Independent Test**: `GET /api/indicators/confluence?symbol=AAPL&timeframe=1h` retorna `{ verdict, score, components: [...], inputs_used, computed_at }` y se valida contra casos sinteticos con resultados conocidos.

**Acceptance Scenarios**:

1. **Given** los 5 indicadores responden correctamente, **When** se solicita confluencia, **Then** la respuesta incluye verdict consolidado, score numerico [-1, 1] y desglose por indicador con peso aplicado.
2. **Given** uno de los 5 indicadores no esta disponible, **When** se solicita confluencia, **Then** la respuesta degrada explicitamente (campo `degraded: true` y lista de indicadores faltantes) sin fallar.
3. **Given** la misma serie OHLC en dos llamadas consecutivas, **When** se calcula confluencia, **Then** el resultado es identico (idempotencia/reproducibilidad).

---

### User Story 4 - Chat IA explicativo de la señal (Priority: P2)

Como usuario operativo, quiero preguntar al Chat IA por que la señal tecnica actual de AAPL es alcista, y recibir una explicacion en lenguaje natural basada en los valores reales de los 5 indicadores y sus contribuciones, sin que la IA sugiera ejecutar operaciones.

**Why this priority**: Es el diferenciador de explicabilidad. Depende de US3. Slice de Hansel.

**Independent Test**: `POST /api/chat/explain { symbol, timeframe, question }` retorna texto explicativo con citaciones a los valores numericos usados y disclaimer no operativo.

**Acceptance Scenarios**:

1. **Given** confluencia disponible para AAPL 1h, **When** el usuario pregunta "por que esta alcista?", **Then** la respuesta menciona al menos 3 de los 5 indicadores con sus valores numericos y la regla por la que contribuyen.
2. **Given** cualquier pregunta de usuario, **When** la respuesta se genera, **Then** incluye el disclaimer constitucional "esta explicacion no constituye orden ni recomendacion ejecutable".
3. **Given** una pregunta fuera de scope (p.ej. "ejecuta una orden"), **When** se procesa, **Then** la IA rechaza explicitamente y redirige a explicacion.

---

### User Story 5 - Tabla canonica de confluencia de señales por core (Priority: P1)

Como usuario operativo del dashboard, quiero una tabla unica que liste cada señal emitida por cada core (Indicadores, Fundamental, Tecnico SoP/Res, Institucional, Noticias, IA) para un ticket, con columnas `TICKET | CORE | SUBCORE | PRECIO | TIPO SEÑAL | FECHA | TIMEFRAME | TENDENCIA | SCORE | PESO | INVERTIR S/N | ESTADO | OBSERVACION`, para evaluar en una sola vista la confluencia real entre cores sin tener que abrir 6 paneles.

**Why this priority**: Es el artefacto principal del PDF v1 y el insumo que el operador mira para decidir. La tabla actual (`ConfluenceSignalsTable.tsx`) sólo muestra `symbol/direction/confidence/timestamp`, lo que rompe el contrato del PDF y oculta info que el backend ya calcula (`score`, `components[]`, `degraded`). Bloquea US6.

**Independent Test**: `GET /api/signals/confluence-table?ticket=AAPL&from=...&to=...` retorna `{ rows: ConfluenceSignalRow[], generated_at, algorithm_version }` y la tabla del PWA renderiza 1:1 las columnas del PDF v1.

**Acceptance Scenarios**:

1. **Given** los 5 indicadores responden y los cores Fundamental/Institucional/Noticias/IA estan en stub `degraded:true`, **When** se solicita la tabla para AAPL 1h, **Then** la respuesta incluye al menos 1 fila por core habilitado, cada una con `core`, `subCore` (cuando aplique), `precio`, `tipoSenal` (`CALL|PUT|HOLD`), `tendencia`, `score [-1,1]`, `peso`, `estado` (`ACTIVA|EXPIRADA|INVALIDADA`) e `invertir` booleano derivado.
2. **Given** una fila proviene del core IA, **When** se serializa, **Then** incluye `ia_revisada: true` y `disclaimer_id` referenciando el disclaimer no operativo (constitucional `RNF-001`).
3. **Given** un core no esta disponible, **When** se genera la tabla, **Then** se emite fila con `estado: "DEGRADADA"` y `observacion.explicacion` explicita, sin omitir silenciosamente al core.
4. **Given** una corrida previa para el mismo ticket, **When** se solicita la tabla, **Then** cada fila incluye `delta_vs_anterior` (`NUEVA|CONFIRMADA|INVERTIDA|DEGRADADA`).

---

### User Story 6 - Ejecutar simulacion desde el panel de control (Priority: P2)

Como usuario operativo, quiero configurar `RANGO HISTORICO`, `RANGO ESTRATEGIA`, `TEMPORALIDAD`, `ESTRATEGIA` (IRON CONDOR, etc.), `TOLERANCIA DE RIESGO` (BAJO/MEDIO/ALTO) y los toggles SI/NO por cada analisis, y presionar `EJECUTAR SIMULACION` para obtener la tabla de confluencia resultante y el verdict consolidado en una sola accion.

**Why this priority**: Es el call-to-action central del PDF v1 (boton amarillo). Sin esta US, la tabla US5 existe pero no hay forma operativa de pedirla con parametros realistas. Depende de US5.

**Independent Test**: `POST /api/simulation/run` con cuerpo `SimulationRequest` retorna `{ verdict, table: ConfluenceSignalRow[], inputs_echo, computed_at }` reproducible.

**Acceptance Scenarios**:

1. **Given** `SimulationRequest` con `coresHabilitados=[A_INDICADORES, A_IA]` y resto en `false`, **When** se ejecuta, **Then** la tabla devuelta solo contiene filas de esos 2 cores y `verdict.degraded` lista los faltantes.
2. **Given** `estrategia="IRON_CONDOR"` y `toleranciaRiesgo="MEDIO"`, **When** se ejecuta, **Then** la respuesta incluye `inputs_echo` con esos campos textuales para auditoria; el feature no calcula greeks reales si no esta el core de opciones.
3. **Given** dos ejecuciones consecutivas con mismos parametros y misma ventana de candles, **When** se comparan, **Then** los `ConfluenceSignalRow` son identicos (idempotencia, ya cubierta por SC-003 a nivel indicador).
4. **Given** `SimulationRequest.rangoEstrategia` con `from > to`, o `coresHabilitados=[]`, o `estrategia` desconocido, **When** se procesa, **Then** la respuesta es 400 con `{ error_code: "INVALID_SIMULATION_REQUEST", message, hint }` y nombra el campo invalido.
5. **Given** `GET /api/signals/confluence-table?ticket=AAPL&from=2025-01-01&to=2024-01-01`, **When** se procesa, **Then** la respuesta es 400 con `error_code: "INVALID_RANGE"`; mismo trato cuando `core` query param no esta en el enum `CoreId`.

---

### User Story 7 - Autenticacion y autorizacion (transversal)

Como sistema, todo endpoint de este feature MUST exigir JWT valido emitido por Supabase con rol `viewer|trader|admin`, para que ningun consumidor anonimo pueda ejercer el core ni el Chat IA.

**Acceptance Scenarios**:

1. **Given** una llamada sin header `Authorization`, **When** se accede a cualquier endpoint (`/api/indicators/*`, `/api/signals/*`, `/api/simulation/*`, `/api/chat/explain`), **Then** la respuesta es 401 con `{ error_code: "AUTH_REQUIRED", message, hint }`.
2. **Given** un JWT con firma invalida o expirado, **When** se valida, **Then** la respuesta es 401 con `error_code: "AUTH_INVALID"` y `hint` que indica re-login.
3. **Given** un JWT valido pero con rol no autorizado (p.ej. `guest`), **When** se procesa, **Then** la respuesta es 403 con `error_code: "AUTH_FORBIDDEN"`.

---

### Edge Cases

- Serie OHLC con gaps (festivos, fines de semana): el calculo respeta el orden temporal real, no rellena con ceros.
- Serie con N < period requerido: respuesta 422 con mensaje `insufficient_data` y el N minimo requerido.
- Timeframe no soportado por la fuente de datos: 400 con lista de timeframes validos.
- Symbol existe pero sin datos para el rango: 404 (no 200 con serie vacia).
- Cambio de zona horaria del servidor: timestamps siempre en UTC con sufijo Z.
- Llamadas concurrentes al mismo simbolo: cache de calculo por (symbol, timeframe, params, last_bar_ts) para evitar recomputo.
- Chat IA recibe pregunta en idioma distinto al español: responde en español por constitucion.
- **LLM externo (Anthropic) caido o rate-limited (429/5xx)**: `POST /api/chat/explain` responde 200 con `degraded: true`, `explanation_text: ""`, `disclaimer` presente y `error_code: "LLM_UNAVAILABLE"|"LLM_RATE_LIMITED"` en el cuerpo; NUNCA propaga el 5xx del proveedor al cliente. Se reintenta hasta 2 veces con backoff exponencial antes de degradar.
- **Job de purga TTL de `chat_explanations` falla**: el job MUST registrar el error en logs estructurados, reintentar al ciclo siguiente, y emitir alerta si falla 3 veces consecutivas. No bloquea inserts nuevos; tolera acumulacion temporal de filas expiradas.
- **Rate limit local agotado**: respuesta 429 con `{ error_code: "RATE_LIMITED", retry_after_seconds, message, hint }` (ver Clarifications Q4).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST calcular RSI (period configurable, default 14) sobre series OHLC y exponerlo via REST.
- **FR-002**: El sistema MUST calcular MACD (fast/slow/signal configurables, defaults 12/26/9), incluyendo deteccion de cruces, y exponerlo via REST.
- **FR-003**: El sistema MUST calcular EMA (period configurable, default 20) sobre la columna close y exponerla via REST.
- **FR-004**: El sistema MUST calcular ADX con +DI y -DI (period default 14) y clasificacion de fuerza de tendencia, y exponerlo via REST.
- **FR-005**: El sistema MUST calcular Bollinger Bands (period default 20, stdDev default 2) y exponerlas via REST.
- **FR-006**: El sistema MUST consolidar los 5 indicadores en un endpoint de confluencia con verdict, score y desglose. El `score` es numerico en `[-1, 1]` donde **positivo = alcista, negativo = bajista, cero = neutral**; el verdict literal se deriva con umbrales `alcista` (score > 0.2), `neutral` (-0.2 <= score <= 0.2), `bajista` (score < -0.2).
- **FR-007**: El sistema MUST exponer un endpoint de Chat IA que reciba una pregunta y devuelva explicacion basada en los valores reales de los indicadores, con disclaimer no operativo.
- **FR-008**: El sistema MUST mantener trazabilidad completa: input OHLC usado, parametros, version del algoritmo, timestamp de calculo, en cada respuesta.
- **FR-009**: El sistema MUST validar parametros de entrada y devolver errores 400/404/422 con cuerpo estructurado (`error_code`, `message`, `hint`).
- **FR-010**: Los endpoints MUST autenticar via JWT/Supabase (reutilizando el middleware existente en `projects/rest-api/inversions_api`).
- **FR-011**: El Chat IA MUST rechazar cualquier solicitud que implique ejecucion de ordenes y MUST redirigir a explicacion.
- **FR-012**: El sistema MUST publicar contratos OpenAPI/JSON Schema de cada endpoint en `specs/003-team-02-core-indicadores/contracts/`.
- **FR-013**: El sistema MUST exponer un health endpoint del core (`GET /api/indicators/health`) que reporte disponibilidad de cada dependencia critica con campo `status: "up"|"degraded"|"down"` por dependencia. Dependencias chequeadas: (a) fuente OHLC (`market-data` de TEAM-01 o mock determinista segun `runtime_mode`), (b) LLM Anthropic (`claude-opus-4-7` — ping ligero con `tokens<=1`), (c) Supabase (`chat_explanations` accesible para insert/select). El endpoint MUST responder 200 incluso si una dependencia esta `degraded`; solo retorna 503 si TODAS estan `down`.
- **FR-014**: El sistema MUST exponer `GET /api/signals/confluence-table?ticket=&from=&to=&timeframe=` que devuelva una lista de `ConfluenceSignalRow` con el contrato canonico de columnas del PDF v1 + columnas tecnicas (score, peso, estado, timeframe, subCore, vigencia, fuente, evidencia_refs, ia_revisada, disclaimer_id, delta_vs_anterior).
- **FR-015**: El sistema MUST exponer `POST /api/simulation/run` que reciba `SimulationRequest` (ticket, rangoHistorico, rangoEstrategia, temporalidad, runtimeMode, coresHabilitados[], indicadoresHabilitados[], estrategia, toleranciaRiesgo) y devuelva `{ verdict, table, inputs_echo, computed_at, algorithm_version }`.
- **FR-016**: La tabla MUST soportar los 6 cores (`A_INDICADORES`, `A_FUNDAMENTAL`, `A_TECNICO`, `A_INSTITUCIONAL`, `A_NOTICIAS`, `A_IA`) en su enum `CoreId`. Los cores no implementados (Fundamental/Institucional/Noticias) MUST devolver fila con `estado: "DEGRADADA"` en lugar de omitirse.
- **FR-017**: Cuando `core = A_INDICADORES`, la fila MUST incluir `subCore` con el indicador especifico (`RSI|MACD|EMA|ADX|BB`); en otros cores, `subCore` es opcional.
- **FR-018**: `tipoSenal` MUST ser uno de `CALL|PUT|HOLD`. Cualquier mapeo desde `direction` (buy/sell) interno MUST ser explicito.
- **FR-019**: Toda fila emitida por el core IA MUST incluir `ia_revisada: true`, `disclaimer_id` y MUST cumplir la regla `FR-011` (no propone ejecucion).
- **FR-020**: El campo `metadata: Record<string, unknown>` actual del endpoint `/api/signals/confluence` queda **deprecado**. La fuente de verdad pasa a ser `ConfluenceSignalRow` con `observacion: SignalObservation` tipada y `metricas: Record<MetricKey, number|string>`.

### Key Entities

- **OhlcBar**: representa una vela. Atributos: timestamp (UTC), open, high, low, close, volume, symbol, timeframe.
- **IndicatorResult**: resultado de un indicador. Atributos: symbol, timeframe, indicator_name, params, current_value, series, computed_at, version_algoritmo, source_input_hash.
- **ConfluenceVerdict**: salida consolidada **derivada** de la tabla. Atributos: symbol, timeframe, verdict (alcista|neutral|bajista), score [-1,1], components[], degraded, computed_at.
- **ChatExplanationRequest**: question, symbol, timeframe, optional context.
- **ChatExplanationResponse**: explanation_text, indicators_cited[], disclaimer, model_version, computed_at.
- **ConfluenceSignalRow** *(nuevo, raiz de la tabla canonica)*: ticket, core (`CoreId`), subCore?, precio, tipoSenal (`CALL|PUT|HOLD`), fecha, timeframe, tendencia (`ALCISTA|BAJISTA|LATERAL`), score [-1,1], peso, invertir (boolean), estado (`ACTIVA|EXPIRADA|INVALIDADA|DEGRADADA`), vigencia (expires_at), fuente, evidencia_refs[], ia_revisada, disclaimer_id?, delta_vs_anterior (`NUEVA|CONFIRMADA|INVERTIDA|DEGRADADA`), observacion (`SignalObservation`), optionLeg? (`OptionGreeks`), algorithm_version, computed_at, source_input_hash.
- **SignalObservation** *(nuevo)*: objetivo, senal, explicacion, metricas (`Record<MetricKey, number|string>` con claves canonicas: `MARKET_CAP`, `CASH`, `DIVIDENDO`, `EMPLEADOS`, `VOLATILIDAD`, `VOLUMEN`, `SENTIMIENTO`, `MONTO_USD`, `FONDO`, `FILING_DATE`, `PERIODO`, `MODEL_VERSION`).
- **OptionGreeks** *(nuevo, opcional por fila)*: ala (`ALA1|ALA2`), vencimiento, strike, gamma, theta, delta, posicion (`SHORT|LONG`), tolerancia.
- **SimulationRequest** *(nuevo)*: ticket, rangoHistorico (`2A|1A|6M|3M|1M` o `{from,to}`), rangoEstrategia (`{from,to}`), temporalidad, runtimeMode (`ONLINE|OFFLINE`), coresHabilitados[], indicadoresHabilitados[], estrategia (`IRON_CONDOR|...`), toleranciaRiesgo (`BAJO|MEDIO|ALTO`).
- **ConfluenceColumnConfig** *(nuevo, metadata-driven render)*: field_key, label, data_type, visible (default), order_index, applies_to_cores[]. Persiste en tabla `confluence_columns` para que el dashboard active/oculte columnas sin redeploy.

## Experience & Component Contract *(API-first + tabla canonica consumida 1:1 por el PWA)*

El consumidor primario sigue siendo el dashboard de TEAM-01 (feature `002-team-01-dashboard-brokers`). Sin embargo, a partir de la Phase 5, este feature **expone una tabla canonica** (`ConfluenceSignalRow`) que el PWA renderiza 1:1 con las columnas del PDF "DASBOARD Y TABLA (version 1)". El layout, columnas, agrupacion por core y panel de simulacion del PDF son contrato visible. La columna de configuracion runtime (`ConfluenceColumnConfig`) permite al dashboard activar/ocultar columnas sin redeploy.

### Runtime Modes & Source Selection

- **Mode Online**: OHLC desde fuente broker priorizada (delegada a TEAM-01 via servicio `market-data`).
- **Mode Offline/Demo**: OHLC desde cache local Supabase (tabla `ohlc_bars`).
- Seleccion via header `X-Runtime-Mode` o env `RUNTIME_MODE`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los 5 indicadores individuales devuelven resultado en < 200 ms p95 para series de hasta 500 velas, en Mode Offline.
- **SC-002**: El endpoint de confluencia devuelve resultado en < 500 ms p95 (compuesto de los 5).
- **SC-003**: Los valores calculados coinciden con una libreria de referencia (p.ej. `technicalindicators` npm) con tolerancia <= 1e-6 en al menos 95% de casos de prueba sinteticos.
- **SC-004**: El Chat IA cita correctamente al menos 3 de los 5 indicadores en >= 90% de respuestas evaluadas.
- **SC-005**: 100% de respuestas del Chat IA incluyen el disclaimer constitucional no operativo.
- **SC-006**: Cobertura de tests unitarios >= 80% en los modulos de calculo.
- **SC-010**: `POST /api/chat/explain` responde en < 4 s p95 con Claude Opus 4.7 + prompt caching habilitado (latencia mayor que indicadores por naturaleza del LLM; aceptable porque no esta en el path critico del dashboard live).
- **SC-007**: La tabla `/api/signals/confluence-table` renderiza 1:1 las columnas del PDF v1 mas las columnas tecnicas (`score`, `peso`, `estado`, `timeframe`, `subCore`, `ia_revisada`) en >= 100% de los casos para los cores implementados.
- **SC-008**: `POST /api/simulation/run` end-to-end (resolver candles -> 5 indicadores -> tabla + verdict) responde en < 2 s p95 para 1 ticket, 1 timeframe, 500 velas.
- **SC-009**: 100% de filas con `core = A_IA` incluyen `ia_revisada: true` y `disclaimer_id` no nulo (constitucional `RNF-001`).

## Assumptions

- La fuente de OHLC (broker o cache Supabase) ya esta resuelta por TEAM-01 y se consume como servicio interno.
- El middleware de auth JWT/Supabase existente (`projects/rest-api/inversions_api/src/middleware`) se reutiliza sin cambios.
- El LLM para Chat IA es **Anthropic Claude Opus 4.7** (`claude-opus-4-7`) via `@anthropic-ai/sdk` con prompt caching habilitado; el equipo no implementa el modelo, solo el orquestador de prompt.
- El idioma de las explicaciones del Chat IA es español por constitucion.
- Los timeframes inicialmente soportados: 1m, 5m, 15m, 1h, 4h, 1d.
- El feature reside dentro del workspace existente `projects/rest-api/inversions_api`; no se crea nuevo servicio.

## Dependencias y Coordinacion Inter-Equipo

- **TEAM-01 (DIANArchiTEC)**: provee servicio de market-data (OHLC) y schema base en Supabase. Bloqueante para Mode Online.
- **Dashboard (TEAM-01 feature 002)**: consumidor primario de los contratos publicados aqui.
- **Cores de estrategia (TEAM-03..09)**: consumidores secundarios del endpoint de confluencia.

## Reparto Operativo del Equipo TEAM-02

| Integrante | Slice | User Stories | FRs principales |
|---|---|---|---|
| **Kevin** | Momentum: RSI + MACD + endpoints + endpoints Phase 5 (tabla + simulacion) | US1, US6 (backend) | FR-001, FR-002, FR-009, FR-010, FR-012 (RSI/MACD), FR-015 |
| **Edgar** | Tendencia/Volatilidad: EMA + ADX + BB + endpoints + frontend Phase 5 (PWA) | US2, US5 (frontend), US6 (panel) | FR-003, FR-004, FR-005, FR-012 (EMA/ADX/BB), FR-017, FR-018 |
| **Mauricio** | Motor de confluencia + trazabilidad + health + modelo de datos Phase 5 | US3, US5 (backend), US7 | FR-006, FR-008, FR-013, FR-014, FR-016, FR-020 |
| **Hansel (lead)** | Chat IA explicativo + tests integracion + coordinacion + IA estructurada Phase 5 | US4, parte de US5 (IA) | FR-007, FR-011, FR-019, SC-004, SC-005, SC-009 |

## Cobertura Canonica (input: teams/TEAM-02/spec.md)

| Item canonico | Estado | Mapeo |
|---|---|---|
| RF-001 core indicadores | preserved | FR-001..FR-005 |
| RF-002 EMA/MACD/ADX/RSI/BB | preserved | FR-001..FR-005 |
| RF-003 motor de confluencia | preserved | FR-006 |
| RF-004 endpoints para dashboard | expanded | FR-001..FR-007, contracts/ |
| RF-005 Chat IA explicativo | preserved | FR-007, FR-011 |
| RF-006 trazabilidad | preserved | FR-008 |
| RNF-001 IA no ejecuta | preserved | FR-011 |
| RNF-002 reproducibilidad | preserved | US3 scenario 3, SC-003 |
| RNF-003 desacoplado del frontend | preserved | API-first |
| RNF-004 auditabilidad | preserved | FR-008 |
| RNF-005 latencia interactiva | preserved | SC-001, SC-002 |
| dropped | (ninguno) | -- |

## Clarifications

### Sesion 2026-05-25 (/speckit.clarify)

- **Q1 — Proveedor LLM y modelo**: Anthropic Claude **Opus 4.7** (`claude-opus-4-7`) via Anthropic SDK oficial.
  - **Impacto**: `chatExplainer.ts` usa `@anthropic-ai/sdk`; var `ANTHROPIC_API_KEY` requerida; el `LlmExplainer` interface neutral se mantiene para tests (mock determinista en CI).
  - **Riesgo**: Opus 4.7 tiene latencia mayor que Haiku (estimado p95 ~1.5-3 s vs 300-600 ms). Puede tensionar SC-001/SC-002 si el Chat IA queda en el path critico. **Mitigacion**: Chat IA es endpoint separado (`POST /api/chat/explain`); SC-001/SC-002 aplican solo a indicadores/confluencia, NO a chat. Se anade SC-010 (latencia chat).
  - **Caching**: habilitar prompt caching nativo de Anthropic en el system prompt + cita de indicadores (reduce costo y latencia repeticion).
- **Q2 — Fuente OHLC en Mode Online**: **IBKR via TEAM-01** (servicio `market-data`).
  - **Impacto**: `ohlcSource.ts` consume `market-data.getCandles(symbol, timeframe, count)` cuando `X-Runtime-Mode: ONLINE`; mantiene mock determinista para Mode Offline y para tests. No hay llamadas Alpaca directas desde TEAM-02.
  - **Bloqueante**: depende del feature 002-team-01 publicando `market-data` consumible. Hasta entonces, Mode Online usa el mismo mock que Offline (compatible con T071).
- **Q3 — Persistencia Chat IA**: **Si, tabla `chat_explanations` con TTL 90 dias**.
  - **Impacto**: nueva migracion Supabase con campos `id`, `user_id`, `symbol`, `timeframe`, `question`, `explanation_text`, `indicators_cited` (JSONB), `disclaimer`, `model_version`, `tokens_in`, `tokens_out`, `computed_at`, `expires_at`. Job de limpieza diario que purga `expires_at < now()`.
  - **Cumple**: RNF-004 (auditabilidad). Tokens persistidos permiten auditoria de costo.
- **Q4 — Rate limiting**: **60 req/min por usuario en endpoints de indicadores/confluencia + 10 req/min en `/api/chat/explain`**.
  - **Impacto**: middleware `rateLimit` con `express-rate-limit`; storage en memoria para dev/CI, Redis o Supabase tabla `rate_limit_buckets` para production. Aplicar por `user_id` extraido del JWT (no por IP).
  - **Respuesta 429**: cuerpo `{ error_code: "RATE_LIMITED", retry_after_seconds, message, hint }` consistente con FR-009.

### Sesion Phase 5 (defaults aplicados en implementacion 2026-05-26)

- **Q-T111 — Lista canonica de `estrategia`**: definida en este feature en `runner.ts > KNOWN_ESTRATEGIAS` con 11 valores (`IRON_CONDOR, BULL_CALL_SPREAD, BEAR_PUT_SPREAD, BUY_CALL, BUY_PUT, SELL_CALL, SELL_PUT, STRADDLE, STRANGLE, BUTTERFLY, COVERED_CALL`). Cuando exista el feature del cadenero de opciones, esta lista se delegara a ese feature. La PWA consume la constante exportada desde `confluenceTableApi.ts > CANONICAL_ESTRATEGIAS`.
- **Q-T112 — `invertir` (S/N)**: regla backend derivada — `invertir = !degraded && tipoSenal !== "HOLD"`. No hay `PATCH` por fila en esta version; si el operador necesita invertir manualmente, se vuelve a correr `POST /simulation/run`. Decision: minimizar superficie de mutacion en Phase 5.
- **Q-T113 — Greeks**: entran como input opcional al payload (`ConfluenceSignalRow.optionLeg`); el broker (TEAM-01) los provee. TEAM-02 NO los calcula. La UI muestra subrow colapsable cuando llegan (`OptionGreeksRow.tsx`).
- **Q-T114 — Stubs `A_FUNDAMENTAL/INSTITUCIONAL/NOTICIAS`**: viven temporalmente en TEAM-02 (`coreStubs.ts`) emitiendo filas `DEGRADADA` para preservar el contrato visual del PDF v1. Cuando exista el feature dedicado para cada core, se elimina su stub aqui.

### Defaults aplicados (no preguntados, decision tecnica)

- **Q5 — Politica de cache**: cache in-process por clave `sha256(symbol|timeframe|params|last_bar_ts)` con TTL = duracion de 1 vela del timeframe (p.ej. 60 s para `1m`, 3600 s para `1h`). Invalidacion natural cuando llega nueva vela. Sin Redis en Phase 2/3; revisar si SC-001 no se cumple bajo carga.
  - **Justificacion**: cubre el caso comun (multiples lecturas del mismo simbolo dentro de la misma vela) sin infra externa. Si se necesita compartir cache entre instancias, migrar a Redis es trivial (interface ya abstraido).
