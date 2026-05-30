# Implementation Plan: Análisis de Sentimiento de Noticias Financieras

**Branch**: `006-news-sentiment-analysis` | **Date**: 2026-05-29 | **Spec**: [spec.md](./spec.md)
**Input**: `NEWS_SYSTEM_PROMPT_FOR_CLAUDE.md` + módulos existentes del REST API

---

## Summary

Backend de análisis de sentimiento de noticias para el REST API `@inversions/rest-api`. Reutiliza los patrones existentes: adaptador Alpaca (degradación a demo determinista como `market/quotes.ts`), explainer Anthropic con import perezoso y respaldo determinista (como `indicators/llmAnthropic.ts`), y el helper de errores y convención de routers `createXRouter()`. Expone `GET /api/news/sentiment/:symbol` y `POST /api/news/analyze-url`. La IA es confirmador, no decisor: todo veredicto es explicativo y porta el disclaimer constitucional. Sin auto-trading.

---

## Technical Context

**Language/Version**: TypeScript 5.6 / Node 22 (Express 4.21)
**Primary Dependencies**: express, `@anthropic-ai/sdk` (import perezoso, opcional), supertest+vitest (test). Sin dependencias nuevas.
**Storage**: Ninguno en esta iteración (persistencia Supabase diferida a fase posterior).
**Testing**: Vitest 4.x + supertest (unit + integration), patrón del repo.
**Target Platform**: Servicio REST backend.
**Constraints**: Sin auto-trading; IA confirmador; comentarios FIC bilingües EN/ES; español oficial; degradación elegante; sin red en CI.
**Scale/Scope**: ~6 archivos de código + 4 de test.

---

## Constitution Check

| Principio Constitucional | Estado | Justificación |
|--------------------------|--------|---------------|
| Stack: TypeScript + Express | ✅ Cumple | Módulos y rutas en TS sobre el REST API existente |
| Spec-Driven Development | ✅ Cumple | spec → plan → tasks → implement |
| FIC: comentarios bilingües EN/ES | ✅ Cumple | Todos los módulos/servicios nuevos los incluyen |
| Testing y evidencia obligatoria | ✅ Cumple | 22 tests (unit + integration) verdes |
| No auto-trading sin aprobación | ✅ Cumple | El sistema sólo analiza; nunca coloca órdenes |
| IA como confirmador, no decisor | ✅ Cumple | Veredicto explicativo + disclaimer + `ia_revisada` |
| Arquitectura modular por features | ✅ Cumple | `modules/news/`, `routes/news/` |
| Idioma oficial: español | ✅ Cumple | Artefactos y mensajes de API en español |

**Resultado Gate 1**: ✅ SIN VIOLACIONES.

> **Adaptación frente al documento fuente**: el doc usa el modelo `claude-opus-4-5` y rutas `/news/...`. El plan usa el modelo del repo (`ANTHROPIC_MODEL_ID = claude-opus-4-7` de `llmAnthropic.ts`) y el prefijo `/api/news` para respetar la convención existente. El veredicto `BUY/SELL/HOLD` se conserva como **señal informativa** (no ejecutable) para respetar la Constitución.

---

## Data Source Routing & Runtime Modes

- **Fuentes**: Alpaca News API (real) → demo determinista (fallback). Anthropic (real) → determinista (fallback).
- **Modos**: hereda el patrón demo/real por variables de entorno (`ALPACA_API_KEY*`, `ANTHROPIC_API_KEY`). `NODE_ENV=test` fuerza determinismo.

---

## Project Structure

```
projects/rest-api/inversions_api/src/
  modules/news/
    types.ts                 ← tipos compartidos + NEWS_DISCLAIMER
    newsAdapter.ts           ← Alpaca News + demo determinista
    sentimentService.ts      ← analizador Anthropic + determinista + factory
    investmentAdvisor.ts     ← orquestador → veredicto explicativo
    urlAnalysisService.ts    ← fetch URL + extracción HTML + análisis
  routes/news/
    sentiment.ts             ← GET /sentiment/:symbol, POST /analyze-url
  index.ts                   ← registro: app.use("/api/news", ...)

tests/
  unit/news/{sentimentService,investmentAdvisor,urlAnalysisService}.test.ts
  integration/news/sentimentRoute.test.ts
```

**Structure Decision**: Reutiliza el workspace `@inversions/rest-api`; arquitectura modular por features (existente).

---

## Fases de implementación

### Fase 1 — Núcleo backend ✅ (implementado)
- types, newsAdapter, sentimentService, investmentAdvisor, urlAnalysisService, ruta y registro.

### Fase 2 — Tests ✅ (implementado)
- unit + integration; 22/22 verdes; `tsc --noEmit` limpio.

### Fase 3 — Persistencia (diferida)
- Tablas Supabase (`news_articles`, `sentiment_analysis`, `news_sources`, …), CRUD de fuentes, seed de fuentes predefinidas.

### Fase 4 — Recomendación + PDF (diferida)
- Motor compuesto (sentiment/fundamental/technical), tendencias, generación de PDF.

### Fase 5 — Frontend PWA (diferida)
- `NewsSourcesAnalyzer`, `NewsDashboard`, integración como categoría "Noticias" del App Shell (Feature 005).

---

## Complexity Tracking

> Sin violaciones constitucionales. Sin dependencias externas nuevas (la SDK de Anthropic se importa de forma perezosa y es opcional).
