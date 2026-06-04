# Gap Analysis: Documento de Noticias vs. Repositorio Existente

**Fecha**: 2026-05-29
**Fuente**: `NEWS_SYSTEM_PROMPT_FOR_CLAUDE.md`
**Repo**: `@inversions/rest-api` (backend) + `@inversions/pwa` (frontend)

## 1. Resumen ejecutivo

El documento describe un sistema completo de análisis de noticias (4 módulos backend, rutas, CRUD, frontend, PDF, recomendación, esquema Supabase). El repositorio **ya contiene bloques reutilizables clave**, por lo que NO es un desarrollo desde cero. El núcleo backend (análisis de sentimiento por símbolo y por URL) se implementó en esta iteración reutilizando esos patrones; el resto (persistencia, PDF, recomendación, frontend) queda planificado en `tasks.md`.

## 2. Lo que ya existía (reutilizado)

| Necesidad del documento | Activo existente en el repo | Cómo se reutilizó |
|---|---|---|
| Adaptador Alpaca | `src/modules/brokers/alpacaAdapter.ts` + patrón demo de `src/routes/market/quotes.ts` | `newsAdapter.ts` replica el patrón "API real → degradación demo determinista" |
| Cliente Claude/Anthropic | `src/modules/indicators/llmAnthropic.ts` (`AnthropicExplainer`, import perezoso, reintentos, fallback) | `sentimentService.ts` replica el patrón y reutiliza `ANTHROPIC_MODEL_ID` |
| Disclaimer constitucional + refusal | `src/modules/indicators/chatExplainer.ts` (`CHAT_DISCLAIMER`, `ia_revisada`) | `NEWS_DISCLAIMER` + `ia_revisada` en cada veredicto |
| Cliente Supabase | `src/database/supabase/client.ts` | Disponible para la fase de persistencia diferida |
| Convención de rutas/errores | `routes/indicators/chatExplain.ts`, `modules/indicators/errors.ts` | `createNewsSentimentRouter()` + `respondError()` |
| Tests (vitest + supertest) | `tests/unit/**`, `tests/integration/**` | Mismos patrones para los tests de news |

## 3. Diferencias y decisiones de adaptación

| Aspecto | Documento | Repo / decisión tomada | Razón |
|---|---|---|---|
| Modelo Claude | `claude-opus-4-5` | `claude-opus-4-7` (`ANTHROPIC_MODEL_ID`) | Consistencia con el repo; el doc está desactualizado |
| Prefijo de rutas | `/news/sentiment/:symbol` | `/api/news/sentiment/:symbol` | Convención del repo (`/api/...` por módulo) |
| Veredicto `BUY/SELL/HOLD` | Veredicto accionable | **Señal informativa** + disclaimer + `ia_revisada` | Constitución: IA confirmador, no decisor; sin auto-trading |
| Persistencia | Supabase (8 tablas) | Diferida (Fase 3) | Acotar el MVP backend; cliente Supabase ya disponible |
| Variables de entorno | `ALPACA_API_SECRET`, `ANTHROPIC_API_KEY` | Acepta también `ALPACA_API_KEY_PAPER`/`ALPACA_SECRET_KEY_PAPER` (ya usadas en `market/quotes.ts`) | Compatibilidad con el modo demo existente |

## 4. Lo que es genuinamente nuevo (implementado)

- `src/modules/news/{types,newsAdapter,sentimentService,investmentAdvisor,urlAnalysisService}.ts`
- `src/routes/news/sentiment.ts` (`GET /sentiment/:symbol`, `POST /analyze-url`)
- Registro en `src/index.ts`
- 4 archivos de test (22 casos)

## 5. Lo que falta (diferido, documentado en tasks.md)

- **Fase 3** — Persistencia/auditoría en Supabase + CRUD de fuentes + seed de 11 fuentes oficiales.
- **Fase 4** — Motor de recomendación compuesto (sentiment/fundamental/technical) + tendencias + generación de PDF.
- **Fase 5** — Frontend PWA (`NewsSourcesAnalyzer`, `NewsDashboard`) e integración como categoría "Noticias" del App Shell (Feature 005), que hoy muestra "Sección en construcción".

## 6. Riesgos / notas

- La SDK `@anthropic-ai/sdk` NO está en `package.json`; se importa de forma perezosa y, si no está, se degrada al evaluador determinista (igual que `llmAnthropic.ts`). Para usar IA real hay que instalarla y definir `ANTHROPIC_API_KEY`.
- El scraping de URLs arbitrarias (Fase URL) puede ser bloqueado por algunos sitios; el servicio usa User-Agent de navegador y timeout, pero no implementa los "fallbacks de rutas por dominio" del documento (mejora futura).
- Verificación: `npm run lint` (tsc) limpio; tests de news 22/22 verdes. (Existe un test preexistente y ajeno, `tests/unit/simulation/runner.test.ts`, que falla sólo bajo ejecución en paralelo de toda la suite y pasa en aislamiento.)
