# Feature Specification: Análisis de Sentimiento de Noticias Financieras

**Feature Branch**: `006-news-sentiment-analysis`
**Created**: 2026-05-29
**Status**: Draft (backend núcleo implementado)
**Input**: Documento `NEWS_SYSTEM_PROMPT_FOR_CLAUDE.md` — "De varias fuentes de noticias, extraer las noticias del instrumento analizado, evaluar si son buenas o malas para el precio, y producir un análisis textual que el otro equipo coloca en la tabla."

## Resumen

Sistema backend que, dado un instrumento (símbolo o URL de fuente), recopila noticias recientes, evalúa su sentimiento mediante IA (Claude/Anthropic con respaldo determinista) y devuelve un veredicto **explicativo** (`BUY`/`SELL`/`HOLD`) acompañado de score, confianza, razonamiento, factores clave y el disclaimer constitucional. El veredicto es informativo para que un humano decida: la IA es confirmador, no decisor (Constitución).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Sentimiento consolidado por símbolo (Priority: P1)

El usuario (u otro equipo) solicita el análisis de un símbolo (p. ej. `AAPL`) y recibe un veredicto explicativo con el sentimiento agregado de las noticias recientes.

**Why this priority**: Es el caso central del documento — alimenta la tabla del otro equipo.

**Independent Test**: `GET /api/news/sentiment/AAPL` devuelve 200 con `verdict`, `sentiment`, `newsCount` y `disclaimer`.

**Acceptance Scenarios**:

1. **Given** un símbolo válido, **When** se llama `GET /api/news/sentiment/:symbol`, **Then** se devuelve 200 con `{ symbol, verdict, sentiment:{score,label,confidence,reasoning,keyFactors}, newsCount, disclaimer, ia_revisada, generatedAt }`.
2. **Given** un símbolo inválido (vacío o >10 caracteres), **When** se llama el endpoint, **Then** se devuelve 400 con `error_code: "invalid_symbol"`.
3. **Given** que no hay credenciales de Alpaca, **When** se solicita el análisis, **Then** el sistema degrada a noticias demo deterministas sin error (modo demo/CI).
4. **Given** cualquier veredicto, **When** se devuelve, **Then** SIEMPRE incluye el disclaimer constitucional y `ia_revisada: true`.

### User Story 2 — Análisis de URL de fuente personalizada (Priority: P2)

El usuario aporta la URL de una noticia y la empresa de interés; el sistema obtiene el contenido, lo analiza y devuelve el impacto.

**Independent Test**: `POST /api/news/analyze-url` con `{ url, company }` devuelve 200 con `SourceAnalysisResult`.

**Acceptance Scenarios**:

1. **Given** una URL http(s) y una empresa, **When** se llama `POST /api/news/analyze-url`, **Then** se devuelve 200 con `{ url, company, verdict, score, confidence, reasoning, keyPoints, disclaimer, timestamp }`.
2. **Given** una URL no http(s), **When** se llama el endpoint, **Then** 400 con `error_code: "invalid_url"`.
3. **Given** falta `company`, **When** se llama el endpoint, **Then** 400 con `error_code: "missing_company"`.
4. **Given** la URL falla (HTTP no-2xx/timeout), **When** se intenta, **Then** 502 con `error_code: "url_fetch_error"`.

### User Story 3 — Degradación elegante de IA (Priority: P3)

Cuando la SDK de Anthropic o su API no están disponibles, el análisis se mantiene operativo con el evaluador determinista de respaldo, marcando `degraded: true`.

**Acceptance Scenarios**:

1. **Given** sin `ANTHROPIC_API_KEY` o `NODE_ENV=test`, **When** se analiza, **Then** se usa `DeterministicNewsSentimentAnalyzer` y `sentiment.degraded === true`.

## Requisitos Funcionales

- **FR-001**: El sistema DEBE obtener hasta 10 noticias recientes por símbolo desde Alpaca News API, degradando a datos demo deterministas si faltan credenciales o la API falla.
- **FR-002**: El sistema DEBE evaluar el sentimiento con Claude/Anthropic y devolver `{score(-1..1), label, confidence(0..1), reasoning, keyFactors}`.
- **FR-003**: El veredicto DEBE derivarse del score/confianza: `confidence<0.4 → HOLD`; `score>0.3 → BUY`; `score<-0.3 → SELL`; resto `HOLD`.
- **FR-004**: Toda respuesta DEBE incluir el disclaimer constitucional y `ia_revisada: true` (IA confirmador, no decisor).
- **FR-005**: El sistema NO DEBE ejecutar ni colocar órdenes; sólo produce análisis informativo.
- **FR-006**: El sistema DEBE validar símbolos (`^[A-Z0-9.\-]{1,10}$`) y URLs (http/https).
- **FR-007**: El sistema DEBE degradar a un evaluador determinista cuando la IA no esté disponible, marcando `degraded`.
- **FR-008**: El análisis de URL DEBE limpiar HTML (scripts/estilos/etiquetas) y acotar el contenido a 5000 caracteres, con timeout de 15s y User-Agent de navegador.

## Out of Scope (esta iteración del backend núcleo)

- Frontend `NewsSourcesAnalyzer` / `NewsDashboard` (PWA).
- Generación de PDF.
- Persistencia y CRUD de `news_sources` en Supabase + seed de fuentes predefinidas.
- Motor de recomendación compuesto (sentiment/fundamental/technical) y tendencias.

Estos elementos quedan documentados en `tasks.md` como fases posteriores.
