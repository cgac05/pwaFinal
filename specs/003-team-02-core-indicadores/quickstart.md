# Quickstart — Core de Indicadores TEAM-02

> Phase 5 + Phase 6 quickstart: como ejecutar simulacion, inspeccionar la tabla de confluencia y configurar el chat IA con Claude Opus 4.7.

## 1. Levantar el backend

```bash
cd projects/rest-api/inversions_api
npm install
npm run dev
# escucha en http://localhost:3000
```

Variables relevantes en `.env`:
- `JWT_SECRET` — obligatorio.
- `ANTHROPIC_API_KEY` — opcional; sin ella el chat IA degrada al mock determinista.
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — opcionales en dev.
- `AUTH_BYPASS=true` (default en dev) — bypass de JWT.

## 2. Ejecutar una simulacion

```bash
curl -s http://localhost:3000/api/simulation/run \
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
```

Respuesta: `{ verdict, table, inputs_echo, computed_at, algorithm_version }`. La tabla incluye 1 fila agregada de `A_INDICADORES` + N filas por subCore + 1 fila por cada core habilitado restante (degradada si stub).

## 3. Inspeccionar la tabla canonica

```bash
curl 'http://localhost:3000/api/signals/confluence-table?ticket=AAPL&timeframe=1h'
```

Filtros: `cores=A_INDICADORES,A_IA`, `from=YYYY-MM-DD`, `to=YYYY-MM-DD`.

## 4. Chat IA

```bash
curl -s http://localhost:3000/api/chat/explain \
  -H "Content-Type: application/json" \
  -d '{ "symbol": "AAPL", "timeframe": "1h", "question": "por que esta neutral?" }'
```

Con `ANTHROPIC_API_KEY` configurada, usa Claude Opus 4.7 (`claude-opus-4-7`) con prompt caching. Si el LLM falla, la respuesta degrada con `degraded:true` + `error_code: "LLM_UNAVAILABLE"|"LLM_RATE_LIMITED"` pero conserva el disclaimer constitucional.

## 5. Health (3 dependencias)

```bash
curl http://localhost:3000/api/indicators/health
```

Responde 200 incluso degradado; 503 solo si todas las dependencias estan `down`. Cada dependencia trae `name`, `status`, `latency_ms`.

## 6. Rate limits

- 60 req/min por user_id JWT en `/api/indicators/*`, `/api/signals/*`, `/api/simulation/*`.
- 10 req/min por user_id JWT en `/api/chat/explain`.

Respuesta 429 estructurada: `{ error_code:"RATE_LIMITED", retry_after_seconds, message, hint }` + header `Retry-After`.

## 7. Persistencia del chat (TTL 90 dias)

Inserts via `chatExplanationsStore`. Job de purga: `runChatPurgeJob()` agendable en pg_cron / Supabase Edge Function. Tras 3 fallos consecutivos emite alerta estructurada.

## 8. Frontend (PWA)

```bash
cd projects/pwa/inversions_app
npm install
npm run dev
```

- `SimulationControlPanel` (panel de control PDF v1) + `ConfluenceSignalsTable` (13 columnas del PDF).
- Toggles SI/NO por core y por indicador.
- Boton `EJECUTAR SIMULACION` → renderiza tabla derivada + verdict.

## 9. Inspeccionar `chat_explanations`

```sql
select id, user_id, symbol, model_version, computed_at, expires_at
from chat_explanations
order by computed_at desc
limit 20;
```

## 10. Simular degradacion del LLM

Eliminar `ANTHROPIC_API_KEY` o setear `NODE_ENV=test` para que se use el `DeterministicMockExplainer`. La respuesta incluye `degraded:true` cuando aplica.
