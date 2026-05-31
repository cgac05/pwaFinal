# Tasks: Análisis de Sentimiento de Noticias Financieras

**Input**: Design documents de `specs/006-news-sentiment-analysis/`
**Prerequisites**: plan.md ✅, spec.md ✅

**Tests**: Incluidos — la Constitución requiere testing y evidencia obligatoria.

**Organization**: Tareas agrupadas por fase y user story.

## Format: `[ID] [P?] [Story] Descripción con ruta de archivo`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos)
- **[X]**: Completada en esta iteración
- Rutas reales del workspace `@inversions/rest-api`

---

## Phase 1: Núcleo backend (Foundational) 🎯 MVP

- [X] T001 Crear `src/modules/news/types.ts` — tipos `NewsArticle`, `SentimentResult`, `InvestmentVerdict`, `SourceAnalysisResult` y `NEWS_DISCLAIMER`; FIC bilingüe.
- [X] T002 [P] Crear `src/modules/news/newsAdapter.ts` — `NewsAdapter.getRecentNews()` (Alpaca News) con timeout, fetch inyectable y `demoNewsForSymbol()` determinista de respaldo.
- [X] T003 [P] Crear `src/modules/news/sentimentService.ts` — interfaz `NewsSentimentAnalyzer`, `DeterministicNewsSentimentAnalyzer`, `AnthropicNewsSentimentAnalyzer` (import perezoso de la SDK + reintentos + fallback), `parseSentimentJson`, `labelForScore`, factory por runtime.
- [X] T004 Crear `src/modules/news/investmentAdvisor.ts` — orquestador `evaluate(symbol)` y `resolveVerdict()` (mapeo del doc), con disclaimer e `ia_revisada`.
- [X] T005 [P] Crear `src/modules/news/urlAnalysisService.ts` — `fetchURLContent()`, `extractRelevantContent()`, `extractTitle()`, `analyzeSourceImpact()`.
- [X] T006 [US1][US2] Crear `src/routes/news/sentiment.ts` — `createNewsSentimentRouter()` con `GET /sentiment/:symbol` y `POST /analyze-url`, validación y `respondError`.
- [X] T007 [US1] Registrar router en `src/index.ts` — `app.use("/api/news", indicatorsRateLimit, newsSentimentRouter)`.

**Checkpoint**: Endpoints operativos en `/api/news`.

---

## Phase 2: Tests (evidencia obligatoria)

- [X] T008 [P][US1] `tests/unit/news/sentimentService.test.ts` — labels, scoring determinista bullish/bearish/neutral, determinismo, parseo JSON con clamps.
- [X] T009 [P][US1] `tests/unit/news/investmentAdvisor.test.ts` — `resolveVerdict` (4 ramas) y `evaluate()` con disclaimer/ia_revisada.
- [X] T010 [P][US2] `tests/unit/news/urlAnalysisService.test.ts` — extracción de título/contenido, análisis con fetch inyectado, error HTTP.
- [X] T011 [US1][US2] `tests/integration/news/sentimentRoute.test.ts` — 400 símbolo inválido, 200 veredicto, validaciones de URL, análisis de URL exitoso.
- [X] T012 Ejecutar `npm run lint` (tsc) y `npx vitest run tests/*/news` — **22/22 verdes, tsc limpio**.

---

## Phase 3: Persistencia Supabase (diferida)

- [ ] T013 Migraciones SQL: `news_sources`, `news_articles`, `sentiment_analysis`, `investment_recommendations`, `analysis_records`, `sentiment_trends`.
- [ ] T014 `src/modules/news/newsSourceService.ts` — CRUD de fuentes (list/get/create/update/delete/test).
- [ ] T015 `src/routes/news/sources.ts` — CRUD REST `/api/news/sources`.
- [ ] T016 Seed `src/scripts/initializePredefinedSources.ts` — 11 fuentes oficiales del documento.
- [ ] T017 Persistir cada análisis en `sentiment_analysis`/`analysis_records` para auditoría.

---

## Phase 4: Recomendación + PDF (diferida)

- [ ] T018 `src/modules/news/investmentRecommendationService.ts` — score compuesto (sentiment 50% / fundamental 30% / technical 20%) y `STRONG_BUY..STRONG_SELL` (como señal informativa).
- [ ] T019 `GET /api/news/recommendations/:symbol`.
- [ ] T020 `src/modules/news/pdfGeneratorService.ts` + `POST /api/news/reports/generate`.

---

## Phase 5: Frontend PWA (diferida)

- [ ] T021 `features/news/NewsSourcesAnalyzer.tsx` — alta de fuentes + análisis consolidado.
- [ ] T022 `features/news/NewsDashboard.tsx` — historial, favoritas, recomendaciones, tendencias.
- [ ] T023 Integrar como categoría "Noticias" del App Shell (Feature 005) reemplazando el estado "Sección en construcción".

---

## Dependencias

- Phase 1 → Phase 2 (tests sobre el núcleo).
- Phase 3 habilita persistencia/auditoría usada por Phase 4.
- Phase 5 consume los endpoints de Phase 1 (y opcionalmente 3/4).
