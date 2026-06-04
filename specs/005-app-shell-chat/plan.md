# Implementation Plan: App Shell VS Code + AI Chat Panel

**Branch**: `005-app-shell-chat` | **Date**: 2026-05-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/005-app-shell-chat/spec.md`

---

## Summary

Rediseño del layout principal de la PWA para adoptar una arquitectura de 4 zonas estilo VS Code: barra de actividad (48px), panel izquierdo colapsable (280px) con vistas Watchlist/Análisis/Estrategias, dashboard central sin cambios funcionales, y panel de chat IA derecho colapsable (360px). El chat consume el endpoint existente `POST /api/chat/explain` con contexto del instrumento activo. El estado del layout persiste en localStorage. No hay cambios en el backend.

---

## Technical Context

**Language/Version**: TypeScript 5.6 / React 18.3
**Primary Dependencies**: React 18 (useSyncExternalStore), Vite 5.4, lucide-react (íconos), lightweight-charts (chart existente)
**Storage**: localStorage (layout state, watchlist via API), sessionStorage (historial chat)
**Testing**: Vitest 4.x + React Testing Library 16 + happy-dom
**Target Platform**: PWA web — desktop y tablet (breakpoint 1024px)
**Project Type**: Web application (PWA — monorepo workspace `@inversions/pwa`)
**Performance Goals**: Cambio de sección <1s, colapso de panel <300ms, restauración layout <300ms, respuesta chat <10s (SC-001–SC-008)
**Constraints**: Sin Tailwind (CSS custom properties), sin Zustand, sin Context API, patrón useSyncExternalStore, sin cambios al backend
**Scale/Scope**: 1 usuario simultáneo (PWA), ~15 archivos nuevos/modificados

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio Constitucional | Estado | Justificación |
|--------------------------|--------|---------------|
| Stack: React + TypeScript + Vite | ✅ Cumple | Todos los archivos nuevos usan React + TS |
| Separación PWA / REST API | ✅ Cumple | Feature 100% frontend; usa endpoint existente sin modificar backend |
| Spec-Driven Development | ✅ Cumple | spec → clarify → plan → tasks → implement |
| FIC: comentarios bilingues EN/ES | ✅ Requerido | Obligatorio en todo módulo, servicio, hook público nuevo |
| Testing y evidencia obligatoria | ✅ Requerido | Vitest tests por cada componente y servicio nuevo |
| No auto-trading sin aprobación | ✅ Cumple | Chat solo explica; no ejecuta operaciones |
| IA como confirmador, no decisor | ✅ Cumple | ChatPanel conecta explainer existente; no genera señales |
| Arquitectura modular por features | ✅ Cumple | features/sidebar/, features/chat/, store/, layouts/ |
| Idioma oficial: español | ✅ Cumple | Todos los artefactos en español |

**Resultado Gate 1**: ✅ SIN VIOLACIONES — proceder a implementación.

---

## UX Architecture & Control Strategy

- **Target Experience**: VS Code — barra de actividad + panel izquierdo colapsable + área principal + panel derecho colapsable
- **Critical Controls**:
  - Navegación: barra de actividad vertical (48px), 3 botones (Watchlist/Análisis/Estrategias), clic en activo = toggle colapso
  - Watchlist: campo búsqueda/agregar + árbol (símbolo | precio | cambio%) + botón quitar por fila
  - Análisis: 5 chips selección única (Técnico/Institucional/Fundamental/Noticias/IA) → filtran secciones del dashboard
  - Estrategias: 3 cards estáticas con acordeón desplegable
  - Chat: historial scrollable + input texto + botón enviar + badge contexto (símbolo/timeframe)
- **State Strategy**:
  - `useAppShellStore()` (localStorage) → activeSection, leftPanelCollapsed, chatPanelCollapsed, analysisCategory
  - `useSignalStore()` (localStorage, existente) → instrumento activo, timeframe, runtimeMode
  - Chat history → sessionStorage["inversions.chat.history"]
  - Watchlist items → API REST + useState local en WatchlistView
- **Performance Boundaries**:
  - Colapso de panel: CSS transition `max-width + overflow: hidden` (no unmount) → <300ms
  - Dashboard filter: `display: none` por bloque de sección (SuperChart no se desmonta, preserva chart)
  - Chat scroll: useEffect + scrollIntoView al añadir mensaje
  - Precios watchlist: polling 30s existente via useWatchlistPrices (sin cambios)

---

## Data Source Routing & Runtime Modes

- **Source Domains**: watchlist CRUD (API REST), market quotes (API REST), chat (API REST), layout state (localStorage), chat history (sessionStorage)
- **Routing Rules**:
  - Watchlist → GET/POST/DELETE /api/watchlist (existente)
  - Quotes → GET /api/market/quotes?symbols=... (existente)
  - Chat → POST /api/chat/explain (existente, sin cambios)
  - Layout state → localStorage (cliente)
  - Chat history → sessionStorage (cliente)
- **Runtime Modes**: Hereda online/offline/demo/real del signalStore existente; sin nuevos modos
- **Chat sin instrumento activo**: Si selectedInstrument es undefined, ChatContextBadge muestra "Sin contexto" y el botón de envío queda habilitado pero el panel advierte al usuario antes de enviar

---

## Project Structure

### Documentación (esta feature)

```
specs/005-app-shell-chat/
├── plan.md              ← este archivo
├── research.md          ← decisiones técnicas (Phase 0)
├── data-model.md        ← entidades y estado (Phase 1)
├── quickstart.md        ← arranque y verificación (Phase 1)
├── contracts/
│   ├── appshell-store-contract.md
│   └── chat-api-contract.md
└── tasks.md             ← generado por /speckit-tasks
```

### Código fuente (archivos nuevos y modificados)

```
projects/pwa/inversions_app/src/

# NUEVOS
store/appShell.ts
layouts/AppShell.tsx
components/ui/ActivityBar.tsx
features/sidebar/LeftPanel.tsx
features/sidebar/views/WatchlistView.tsx
features/sidebar/views/AnalysisCategoriesView.tsx
features/sidebar/views/StrategiesView.tsx
features/chat/types.ts
features/chat/ChatPanel.tsx
features/chat/ChatMessageList.tsx
features/chat/ChatInputBar.tsx
features/chat/ChatContextBadge.tsx
services/chat/chatApi.ts

# MODIFICADOS
styles/tokens.css                        ← +3 CSS vars
features/dashboard/MainDashboard.tsx     ← AppShell + filtro analysisCategory
```

**Structure Decision**: Monorepo workspace `@inversions/pwa` — arquitectura modular por features (existente). DashboardLayout.tsx se preserva (no se elimina).

---

## Fases de implementación

### Fase 1 — Fundamentos del layout
- `store/appShell.ts` — 4 campos, persist localStorage, patrón useSyncExternalStore
- `tokens.css` — 3 variables CSS: --activity-bar-width (48px), --left-panel-width (280px), --chat-panel-width (360px)
- `layouts/AppShell.tsx` — CSS grid 4 columnas, colapso via max-width, Drawer para tablet
- `components/ui/ActivityBar.tsx` — 3 botones <button>, aria-label, teclado (Tab/Enter/Space)

### Fase 2 — Panel izquierdo
- `features/sidebar/LeftPanel.tsx` — switch por activeSection, header colapsable
- `features/sidebar/views/WatchlistView.tsx` — wrapper/adaptación de WatchlistTree existente para 280px
- `features/sidebar/views/AnalysisCategoriesView.tsx` — 5 chips, uno activo a la vez, dispatch store
- `features/sidebar/views/StrategiesView.tsx` — 3 cards estáticas con acordeón

### Fase 3 — Chat IA
- `features/chat/types.ts` — ChatMessage, ChatContext, ChatStatus
- `services/chat/chatApi.ts` — sendChatMessage() con auth headers
- `features/chat/ChatContextBadge.tsx` — lee useSignalStore + useAppShellStore
- `features/chat/ChatInputBar.tsx` — input controlado, disabled durante pending
- `features/chat/ChatMessageList.tsx` — lista + scroll auto + estado de error + reintentar
- `features/chat/ChatPanel.tsx` — contenedor, sessionStorage history, lógica de envío

### Fase 4 — Integración con MainDashboard
- `MainDashboard.tsx` — reemplazar DashboardLayout con AppShell
- `MainDashboard.tsx` — envolver cada bloque de secciones con render condicional por analysisCategory
- Mapeo secciones → categorías (ver data-model.md Entidad 5)
- Estado vacío "Sección en construcción" para Institucional/Fundamental/Noticias

### Fase 5 — Tests
- store/appShell.test.ts — persistencia localStorage, defaults, transiciones
- chatApi.test.ts — sendChatMessage: ok path, error 400, error 429, error 5xx
- ChatInputBar.test.tsx — disabled durante pending, enable al recibir respuesta
- ChatContextBadge.test.tsx — muestra símbolo/timeframe, "Sin contexto" cuando undefined
- ChatPanel.test.tsx — historial sessionStorage, truncado a 100 msgs, scroll auto
- AnalysisCategoriesView.test.tsx — chip activo, dispatch store, chip default "technical"
- ActivityBar.test.tsx — keyboard navigation, aria-labels, toggle collapse
- AppShell.test.tsx — layout renders, tablet Drawer, 0 regresiones MainDashboard

---

## Complexity Tracking

> No hay violaciones constitucionales. No se añaden dependencias externas nuevas.
