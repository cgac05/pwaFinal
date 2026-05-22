---
description: "Task list template for feature implementation"
---

# Tasks: 007-team-05-frontend-cobertura

**Input**: Design documents from `/specs/007-team-05-frontend-cobertura/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T300 Install `react-router-dom` in `projects/pwa/inversions_app/package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [X] T301 Update routing in `projects/pwa/inversions_app/src/main.tsx` to use `BrowserRouter` and wrap routes
- [X] T302 [P] Create `projects/pwa/inversions_app/src/layouts/MainLayout.tsx` for shared navigation sidebar + Top Navbar
- [X] T303 [P] Implement `ChatState` & `useSyncExternalStore` store in `projects/pwa/inversions_app/src/store/chat.ts` for session persistence

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: [US1] Backend Coverage Endpoints Exposure (RF-301)

**Goal**: Exponer los motores de estrategia existentes como endpoints REST delegados listos para consumo del frontend.

**Independent Test**: Lanzar curl/Postman contra los endpoints `/api/coverage/*` retornando JSON válidos.

### Implementation for User Story 1

- [X] T304 [P] [US1] Create thin route POST `/api/coverage/analyze` in `projects/rest-api/inversions_api/src/routes/coverage/analyze.ts`
- [X] T305 [P] [US1] Create thin route POST `/api/coverage/compare` in `projects/rest-api/inversions_api/src/routes/coverage/compare.ts`
- [X] T306 [US1] Create thin route POST `/api/coverage/simulate` in `projects/rest-api/inversions_api/src/routes/coverage/simulate.ts`
  - [X] T306b Mount coverage router (`app.use("/api/coverage", coverageRouter)`) in `projects/rest-api/inversions_api/src/index.ts`

**Checkpoint**: Backend coverage features exposed via REST.

---

## Phase 4: [US2] Institutional Analysis Page (RF-302)

**Goal**: Permitir consulta estructurada mediante Ticker, Período y Horizonte visualizando tendencias/zonas S-R.

**Independent Test**: La ruta `/institutional/analysis` permite buscar un ticker con dropdowns predefinidos, y grafica estado S/R exitosamente.

### Implementation for User Story 2

- [X] T307 [P] [US2] Export API functions for `InstitutionalAnalysisPage` in `projects/pwa/inversions_app/src/services/institutional/institutionalApi.ts` using native fetch and `getAuthHeaders()`
- [X] T308 [US2] Implement `projects/pwa/inversions_app/src/pages/institutional/InstitutionalAnalysisPage.tsx` with predefined period/horizon dropdowns
- [X] T309 [US2] Link InstitutionalAnalysisPage to `projects/pwa/inversions_app/src/main.tsx` router

---

## Phase 5: [US3] Regulatory Positions Page (RF-303)

**Goal**: Tabla 13F consolidada, Flujos, Inflows/Outflows, y métricas de Cache.

**Independent Test**: La ruta `/institutional/positions` renderiza la tabla de posiciones con los flujos de dinero institucionales correctos.

### Implementation for User Story 3

- [X] T310 [P] [US3] Add Regulatory Positions fetch methods in `projects/pwa/inversions_app/src/services/institutional/institutionalApi.ts`
- [X] T311 [US3] Implement `projects/pwa/inversions_app/src/pages/institutional/RegulatoryPositionsPage.tsx` featuring 13F positions table and flow displays
- [X] T312 [US3] Link RegulatoryPositionsPage to `projects/pwa/inversions_app/src/main.tsx` router

---

## Phase 6: [US4] Coverage Strategies & Comparisons (RF-304)

**Goal**: Proveer el explorador y payload visualizador de estrategias de cobertura institucionales.

**Independent Test**: La vista `/coverage/strategies` renderiza los gráficos de payoffs de opciones sin errores en navegadores.

### Implementation for User Story 4

- [X] T313 [P] [US4] Export coverage API methods (analyze, compare, simulate) in `projects/pwa/inversions_app/src/services/coverage/coverageApi.ts`
- [X] T314 [US4] Implement `projects/pwa/inversions_app/src/components/coverage/PayoffChart.tsx` utilizing `lightweight-charts`
- [X] T315 [US4] Implement `projects/pwa/inversions_app/src/pages/coverage/CoverageStrategiesPage.tsx`, checking edge-case "Option Chains Missing" rendering fallback instead of chart
- [X] T316 [US4] Link CoverageStrategiesPage to `projects/pwa/inversions_app/src/main.tsx` router

---

## Phase 7: [US5] AI Institutional Chat (RF-305)

**Goal**: Panel de chat con AI que preserve historial persistente bajo la misma sesión de la pestaña actual.

**Independent Test**: Chat IA envía prompts, realiza polling progresivo visualmente, retiene historial al cambiar de vista y regresar, y tiene estado de degrado controlable.

### Implementation for User Story 5

- [X] T317 [P] [US5] Implement AI Chat endpoints interactions locally in `projects/pwa/inversions_app/src/services/ai/aiChatApi.ts`
- [X] T318 [P] [US5] Create `projects/pwa/inversions_app/src/components/ai/ChatHistory.tsx` wrapping the `src/store/chat.ts` `useSyncExternalStore` context
- [X] T319 [P] [US5] Create `projects/pwa/inversions_app/src/components/ai/ScenarioAnalysisCards.tsx`
- [X] T320 [US5] Implement `projects/pwa/inversions_app/src/pages/ai/AIChatPage.tsx` unifying ChatHistory, polling attempts up to 15 max with `ai_unavailable` manual-retry degradation logic
- [X] T321 [US5] Link AIChatPage to `projects/pwa/inversions_app/src/main.tsx` router

---

## Phase 8: Tests & Polish (Cross-Cutting Constraints)

**Purpose**: Test completeness up to the requested 80% coverage minimal bound for vital pipelines.

### Implementation for Cross-Cutting phase

#### Tests (C1 — coverage crítica)
- [ ] T322 [P] Write Unit Tests covering `projects/pwa/inversions_app/tests/services/coverageApi.test.ts` mocking `fetch()` 
- [ ] T323 [P] Write Unit Tests covering `projects/pwa/inversions_app/tests/services/aiChatApi.test.ts` ensuring Polling simulation works over Vitest
- [ ] T326 [P] Write Unit Tests covering `projects/pwa/inversions_app/tests/services/institutionalApi.test.ts` mocking `fetch()` for analysis and positions
- [ ] T327 Write Unit Tests covering `projects/pwa/inversions_app/tests/pages/InstitutionalAnalysisPage.test.tsx` rendering states (loading, data, error) with React Testing Library
- [ ] T328 Write Unit Tests covering `projects/pwa/inversions_app/tests/pages/RegulatoryPositionsPage.test.tsx` with mocked API responses
- [ ] T329 Write Unit Tests covering `projects/pwa/inversions_app/tests/pages/CoverageStrategiesPage.test.tsx` including unavailable option chains fallback
- [ ] T330 Write Unit Tests covering `projects/pwa/inversions_app/tests/pages/AIChatPage.test.tsx` with polling simulation and degradation state

#### Polish (C2, C3 — performance y responsive)
- [ ] T331 Run Lighthouse/browser audit on all 4 new pages to verify initial load < 2s in development environment
- [ ] T332 Validate responsive layout for 1280px+ breakpoint on all 4 new pages (desktop target per RNF-304)
- [ ] T324 Verify CSS Variables alignments with `index.css`
- [ ] T325 Validate TypeScript Strict compliance checking with `npm run lint`

---

## Phase 9: Real Data Sources & Documentation (Cross-Cutting)

**Purpose**: Integrar fuentes de datos reales (SEC EDGAR, FINRA) y documentar semántica de indicadores.

### Real Source Parsers

- [ ] T333 [P] Implement FINRA full-dataset lazy cache in `realSourceParsers.ts` with `ensureFinraCache()` — loads up to 6 pages (×5000 records), shared promise dedup, `Map<string, FinraRecord[]>` at module level
  - T333a Implement `fetchFinraPage()` with POST to `https://api.finra.org/data/group/otcmarket/name/consolidatedShortInterest`, CSV parsing
  - T333b Implement module-level `finraCache` + `finraCachePromise` with date boundary detection
  - T333c Add eager preload kickoff in `bootstrap.ts` — non-blocking `ensureFinraCache().catch(() => {})`
- [ ] T334 [P] Implement SEC EDGAR real parser in `realSourceParsers.ts` — EFTS search for 13F-HR filings, XML directory enumeration, `informationTable` extraction via regex
  - T334a Implement `searchEfts(ticker, formType)` using `https://efts.sec.gov/LATEST/search-index`
  - T334b Implement `extractInfoTableEntries()` regex parser for XML `<infoTable>` blocks
  - T334c Implement `findXmlWithHoldings()` — iterate XML files in filing directory
  - T334d Implement `cusipForTicker()` mapping for common tickers
- [ ] T335 [P] Implement graceful fallback in `parseFinraShortInterestReal` — when ticker not found in cached dataset, return synthetic low-confidence (0.3) observation instead of `null`
- [ ] T336 Optimize SEC parser performance — reduce `MAX_FILINGS` from 8 to 5, remove artificial `delay(150)` calls, parallelize filing lookups with `Promise.all`

### Documentation & Semantics

- [ ] T337 [P] Document cost/risk indicator semantics across spec docs:
  - T337a Add "Indicadores Cost/Risk — Semántica" section to `spec.md`
  - T337b Add "Real Data Sources" section to `plan.md`
  - T337c Add `RiskMetrics` conceptual table to `data-model.md`
  - T337d Add semantic `description` fields to `coverage-compare.schema.json`
  - T337e Add CHK023 checklist item for cost/risk indicator validation
  - T337f Create `docs/TEAM-05-cobertura-cost-risk-guide.md` — full explanatory guide

---

---

## Dependencies & Execution Order

- **US1** can be executed natively in Backend independent of all Frontend.
- **US2, US3, US4, US5** must wait sequentially for the foundation to be correctly structured in `projects/pwa/inversions_app/src/main.tsx`.

## Parallel Example: Backend / Frontend Split
```bash
# Can run simultaneously by different assignees
[US1] T304 (Analyze backend endpoint)
[US5] T317 (AI API services frontend)
```