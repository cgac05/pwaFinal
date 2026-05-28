# Tasks: Rediseño del Dashboard Principal (Revolut Design System)

**Input**: Documentos de diseño desde `specs/004-revolut-dashboard-redesign/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

**Constitution Check**: plan.md §Constitution Check pasa todos los 10 gates — ver plan.md para evidencia completa. Todos los archivos nuevos y modificados requieren comentarios `// FIC:` EN/ES (ver T031). Ausencia de FIC comments bloquea cierre de tickets (constitución §10).

**Tests**: No se incluyen tareas de test TDD explícitas (no solicitadas en spec). La validación es la suite existente de Vitest sin regresiones + verificación visual manual por componente.

**Organización**: Tareas agrupadas por user story para habilitar implementación y prueba independiente de cada historia.

## Formato: `[ID] [P?] [Story?] Descripción con ruta de archivo`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias incompletas)
- **[Story]**: A qué user story pertenece la tarea (US1…US5)
- Rutas relativas a `projects/pwa/inversions_app/` salvo que se indique

---

## Phase 1: Setup (Infraestructura compartida)

**Propósito**: Obtener recursos externos y preparar entorno antes de tocar código.

- [X] T001 Agregar enlace a Google Fonts (Inter 400/600/700) en `index.html`: `<link rel="preconnect" href="https://fonts.googleapis.com">` + stylesheet
- [ ] T002 [P] Ejecutar `npx getdesign@latest add revolut --out specs/004-revolut-dashboard-redesign/DESIGN.md` desde raíz del repo para obtener referencia de tokens Revolut

---

## Phase 2: Foundational (Prerrequisitos bloqueantes)

**Propósito**: Infraestructura de diseño que DEBE estar completa antes de cualquier user story.

**⚠️ CRÍTICO**: Ninguna tarea de user story puede iniciar hasta que esta fase esté completa. Los CSS custom properties son la base de todo el restyling.

- [X] T003 Crear `src/styles/tokens.css` — CSS custom properties Revolut: dark default en `:root`, light override en `@media (prefers-color-scheme: light)`, durations en 0ms en `@media (prefers-reduced-motion: reduce)`. Ver `contracts/css-token-contract.md` para el inventario completo
- [X] T004 [P] Crear `src/styles/animations.css` — `@keyframes` para: `drawer-slide-in`, `drawer-slide-out`, `skeleton-pulse`, `fade-in`. Envolver todo en `@media (prefers-reduced-motion: no-preference)`
- [X] T005 [P] Crear `src/hooks/useAnimatedValue.ts` — hook `useAnimatedValue(target, options?)` con `requestAnimationFrame` y easing `easeOutCubic`; retorna `target` inmediatamente si `prefers-reduced-motion: reduce`. Ver `contracts/ui-component-interfaces.md`
- [X] T006 Actualizar `src/index.css` — añadir `@import './styles/tokens.css'` y `@import './styles/animations.css'` al inicio; eliminar el bloque `:root { }` existente (ya migrado a tokens.css); mantener el resto del archivo (tipografía base, botones, cards)
- [X] T007 [P] Crear `src/components/ui/SkeletonCard.tsx` — placeholder de carga con animación `skeleton-pulse`; props: `height`, `lines`. Ver `contracts/ui-component-interfaces.md`
- [X] T008 [P] Crear `src/components/ui/PillGroup.tsx` — selector segmentado tipo Revolut; opción activa: `--color-accent`; `border-radius: var(--radius-pill)`. Ver `contracts/ui-component-interfaces.md`
- [X] T009 [P] Crear `src/components/ui/Badge.tsx` — badge de modo runtime; props: `label`, `color`, `icon`, `pulse`. Ver `contracts/ui-component-interfaces.md`
- [X] T010 Crear `src/components/ui/Modal.tsx` — modal de confirmación centrado; `variant: 'warning'` usa `--color-warning`; cierra solo con botón explícito (no backdrop); ESC llama `onCancel`. Ver `contracts/ui-component-interfaces.md`
- [X] T011 Crear `src/components/ui/Drawer.tsx` — drawer overlay genérico con slide-in/out desde `position` (left/right); focus trap; cierre por backdrop, ESC u `onClose`; bloquea scroll del body. Ver `contracts/ui-component-interfaces.md`
- [X] T012 Crear `src/layouts/DashboardLayout.tsx` — layout responsivo: desktop ≥1024px → grid 2 columnas (`--sidebar-width` + `1fr`); tablet 768–1023px → columna única, sidebar oculto, `drawerOpen` lo muestra vía `Drawer`. Ver `contracts/ui-component-interfaces.md`

**Checkpoint**: CSS variables activas, primitivos UI disponibles, layout responsivo listo. Verificar en DevTools: `--color-bg` muestra `#000000` en dark y `#ffffff` en light.

---

## Phase 3: User Story 1 — Primera impresión y orientación rápida (P1) 🎯 MVP

**Goal**: Usuario abre el dashboard e identifica en <10s: instrumento activo, timeframe seleccionado y nivel de confluencia de señales, sin scrollear.

**Independent Test**: Abrir el dashboard en un navegador con los datos cargados; en 10 segundos y sin interactuar, el evaluador identifica correctamente los 3 elementos. Verificar que la NavBar, el estado del instrumento activo y las tarjetas de señal son inmediatamente visibles above the fold.

- [X] T013 [US1] Rediseñar `src/features/dashboard/MainDashboard.tsx` — envolver en `DashboardLayout`; nueva NavBar inline con: logo FIC (badge `--color-accent`), nombre app, `Badge` de modo runtime, timestamp última actualización; 3 zonas visuales claras (nav / sidebar / main); mantener skeleton loader del payload principal con `SkeletonCard` (4 cards, `height=110`) mientras `loading && !payload` (FR-005)
- [X] T014 [P] [US1] Rediseñar `src/features/dashboard/SignalOverlay.tsx` — tarjetas de señal con `border-radius: var(--radius-lg)`, fondo `--color-surface-raised`, score mostrado en `--color-buy/sell/hold` según verdict; score usa `useAnimatedValue`
- [X] T015 [P] [US1] Actualizar clases CSS globales en `src/index.css` — reescribir `.card`, `.btn-primary`, `.btn-ghost`, `.skeleton` usando tokens Revolut: `border-radius: var(--radius-lg)` para cards, `border-radius: var(--radius-pill)` para botones, `transition: background var(--duration-fast) var(--easing-standard)`
- [X] T016 [US1] Rediseñar `src/features/dashboard/ConfluenceSignalsTable.tsx` — cabecera con tipografía Revolut (`font-weight: var(--font-weight-emphasis)`); celdas de estado: `--color-buy/sell/hold`; estado vacío y loading con `SkeletonCard`

**Checkpoint**: El dashboard abre y muestra en primer plano las 3 zonas visuales. Un evaluador identifica instrumento, timeframe y señales en <10s. Ejecutar `npm run test` — 0 regresiones.

---

## Phase 4: User Story 2 — Selección rápida de instrumento y timeframe (P1)

**Goal**: Cambio de instrumento o timeframe completado en máximo 2 interacciones, con gráfico y señales actualizadas sin recargar la página.

**Independent Test**: Cambiar de AAPL a NVDA (1 clic en watchlist) y de 1d a 15m (1 clic en pill group); verificar que el gráfico y la tabla de confluencia se actualizan. Cada fila del watchlist muestra ticker + precio actual + % cambio coloreado.

- [X] T017 [P] [US2] Crear `src/services/signals/marketApi.ts` — `getMarketQuotes(symbols: string[])` y hook `useWatchlistPrices(symbols)` con polling 30s, pausa en `document.visibilityState === 'hidden'`, retiene último valor en error. Ver `contracts/market-quotes-api.md`
- [X] T018 [P] [US2] Rediseñar `src/features/dashboard/TimeControls.tsx` — reemplazar select de timeframe por `PillGroup` (opciones: 15m / 1h / 4h / 1d); mantener lógica de `onTimeframeChange` y `onPeriodChange` existente
- [X] T019 [US2] Rediseñar `src/features/dashboard/WatchlistTree.tsx` — reescribir todas las clases Tailwind con CSS vars; cada fila: ticker bold + precio con `useAnimatedValue` + `changePercent` coloreado (`--color-buy/sell/hold`); integrar `useWatchlistPrices`; comportamiento de drawer en tablet (pasado como prop desde `DashboardLayout`)
- [X] T020 [P] [US2] Rediseñar `src/features/dashboard/CoreSelector.tsx` — toggle chips: activo → `background: var(--color-accent-subtle)`, `border-color: var(--color-accent)`; inactivo → `background: var(--color-surface-raised)`, `border-color: var(--color-border)`; ícono + texto en cada chip
- [X] T021 [US2] Crear `projects/rest-api/src/routes/market/quotes.ts` — handler `GET /api/market/quotes?symbols=...`; retorna `{ quotes: MarketQuote[] }`; 503 en modo offline; modo real → broker activo (IBKR/Alpaca); **modo demo → Alpaca paper trading sandbox** (endpoint sandbox de Alpaca, sin credenciales reales). Ver `contracts/market-quotes-api.md`

**Checkpoint**: Cambio de instrumento y timeframe funciona en 2 interacciones. Watchlist muestra precios. Ejecutar `npm run test` — 0 regresiones.

---

## Phase 5: User Story 3 — Lectura de señales de confluencia y evidencia (P2)

**Goal**: El trader accede al desglose de evidencia de una señal con 1 clic, sin perder el contexto del dashboard.

**Independent Test**: Clic en una tarjeta de señal → se abre el drawer de evidencia mostrando refs de cada core con secciones diferenciadas; cierre con ESC restaura el foco.

- [X] T022 [US3] Integrar `Drawer` en `src/features/dashboard/MainDashboard.tsx` para el panel de evidencia — añadir estado `evidenceDrawerOpen: boolean`; clic en tarjeta de señal lo abre; `Drawer` desde la derecha contiene `SignalEvidencePanel`; cierre restaura el scroll
- [X] T023 [P] [US3] Rediseñar `src/features/signals/SignalEvidencePanel.tsx` — sección por core (Technical, Options, Institutional Flow, News, AI) con color de acento propio y separador visual; tipografía `font-weight: var(--font-weight-emphasis)` para nombres de core; refs en `font-size: var(--font-size-sm)`
- [X] T024 [P] [US3] Rediseñar `src/features/dashboard/ExplainabilityTable.tsx` — aplicar tokens Revolut: fondo `--color-surface`, cabeceras con `--color-text-muted`, filas alternadas con `--color-surface-raised`

**Checkpoint**: Clic en tarjeta de señal abre drawer lateral con evidencia por core. ESC cierra el drawer. El dashboard subyacente mantiene su estado. `npm run test` — 0 regresiones.

---

## Phase 6: User Story 4 — Control de modos runtime y cores activos (P2)

**Goal**: Estado del sistema (modo Demo/Real, Online/Offline) y cores activos legibles de un vistazo; activar modo Real requiere confirmación explícita.

**Independent Test**: Sin interactuar con los controles, identificar modo activo y qué cores están habilitados en <5s. Intentar cambiar a modo Real → aparece `Modal` de confirmación antes de aplicar el cambio.

- [X] T025 [US4] Rediseñar `src/features/dashboard/RuntimeModeSwitches.tsx` — eliminar la barra separada; mover el `Badge` de modo al componente NavBar en `MainDashboard`; reescribir todas las clases Tailwind con CSS vars; reemplazar `window.confirm` con el componente `Modal` de confirmación para cambio a modo Real; badges: Demo → `--color-accent`, Real → `--color-warning`, Offline → `--color-text-muted`
- [X] T026 [P] [US4] Rediseñar `src/features/dashboard/simulation/SimulationControlPanel.tsx` — aplicar tokens Revolut; mantener toda la lógica existente
- [X] T027 [P] [US4] Rediseñar `src/features/dashboard/IndicatorsMenu.tsx` — aplicar tokens Revolut; mantener lógica existente

**Checkpoint**: Badge de modo visible en NavBar sin barra adicional. Cores activos visibles de un vistazo. Cambio a Real muestra modal. `npm run test` — 0 regresiones.

---

## Phase 7: User Story 5 — Legibilidad en condiciones de poca luz (P3)

**Goal**: WCAG AA verificado en dark y light mode; animaciones completamente deshabilitadas con `prefers-reduced-motion: reduce`.

**Independent Test**: DevTools → Rendering → Emulate `prefers-color-scheme: light` → todos los textos tienen contraste ≥4.5:1. DevTools → Emulate `prefers-reduced-motion: reduce` → cero animaciones visibles al abrir drawers o cambiar valores.

- [X] T028 [P] [US5] Auditar y ajustar contraste WCAG AA en `src/styles/tokens.css` — verificar con DevTools Accessibility inspector cada combinación de color: `--color-text / --color-bg`, `--color-text-muted / --color-surface`, `--color-buy / --color-surface-raised`, `--color-sell / --color-surface-raised` en dark Y light. Ajustar valores que fallen
- [X] T029 [P] [US5] Verificar cobertura de `prefers-reduced-motion` — confirmar que: (a) todos los `transition` y `animation` CSS están dentro de `@media (prefers-reduced-motion: no-preference)` o usan `var(--duration-*)` que llegan a 0ms; (b) `useAnimatedValue` retorna `target` sin rAF cuando `reduce` está activo; (c) el drawer no muestra slide animation

**Checkpoint**: Emular light mode y reduced-motion en DevTools y confirmar que todo el dashboard sigue siendo completamente usable en ambos estados.

---

## Phase 8: Polish y Concerns Transversales

**Propósito**: Calidad final, comentarios, validación de suite de tests y verificación end-to-end.

- [X] T030 Ejecutar suite completa de Vitest desde `projects/pwa/inversions_app/`: `npm run test` — confirmar 0 fallos en todos los archivos existentes (`dashboard.test.tsx`, `confluenceSignalsTable.test.tsx`, `simulationControlPanel.test.tsx`, `indicatorsMenu.test.tsx`)
- [X] T031 [P] Añadir/verificar comentarios FIC bilingues (EN/ES) en **todos** los archivos nuevos Y modificados — Archivos nuevos: `src/styles/tokens.css`, `src/styles/animations.css`, `src/hooks/useAnimatedValue.ts`, `src/layouts/DashboardLayout.tsx`, `src/components/ui/*.tsx`, `src/services/signals/marketApi.ts`, `projects/rest-api/src/routes/market/quotes.ts` — Archivos modificados: `src/features/dashboard/MainDashboard.tsx`, `WatchlistTree.tsx`, `RuntimeModeSwitches.tsx`, `CoreSelector.tsx`, `TimeControls.tsx`, `ConfluenceSignalsTable.tsx`, `SignalOverlay.tsx`, `ExplainabilityTable.tsx`, `simulation/SimulationControlPanel.tsx`, `IndicatorsMenu.tsx`, `src/features/signals/SignalEvidencePanel.tsx`, `src/index.css`. Ausencia de FIC comments bloquea cierre de tickets (constitución §10)
- [ ] T032 [P] Seguir la tabla de verificación de `quickstart.md` — verificar manualmente cada componente en el navegador: tokens, DashboardLayout responsive, WatchlistTree con precios, RuntimeModeSwitches badge, CoreSelector chips, TimeControls pill group, Drawer slide-in, prefers-color-scheme, prefers-reduced-motion
- [X] T033 Limpiar `src/index.css` — verificar que no quedan valores hardcodeados de color/radius/timing (todos deben ser `var(--*)`)
- [ ] T034 [P] Verificar 60fps con DevTools Performance profiler en Chrome durante actualización de datos del orquestador — abrir pestaña Performance, grabar 5 segundos con datos reales del dashboard (drawer open/close + contador de scores animándose + refresh de cotizaciones watchlist); confirmar que ningún frame supera 16ms (SC-007). Documentar resultado como screenshot o nota en `specs/004-revolut-dashboard-redesign/checklists/requirements.md`

---

## Dependencias y Orden de Ejecución

### Dependencias entre fases

- **Phase 1 (Setup)**: Sin dependencias — puede iniciar inmediatamente
- **Phase 2 (Foundational)**: Depende de Phase 1 — **BLOQUEA todas las user stories**
- **Phase 3–7 (User Stories)**: Todas dependen de Phase 2; pueden ejecutarse en orden (recomendado para un solo desarrollador) o en paralelo (equipo)
- **Phase 8 (Polish)**: Depende de todas las user stories deseadas

### Dependencias entre user stories

- **US1 (P1)**: Puede iniciar tras Phase 2. Sin dependencias de otras stories
- **US2 (P1)**: Puede iniciar tras Phase 2. Independiente de US1
- **US3 (P2)**: Puede iniciar tras Phase 2. Independiente; usa `Drawer` de Phase 2
- **US4 (P2)**: Puede iniciar tras Phase 2. T025 referencia `NavBar` de T013 (US1) — recomendado ejecutar US1 antes
- **US5 (P3)**: Puede iniciar tras Phase 2. Puramente auditora; sin dependencias de otras stories

### Dependencias internas críticas

- T006 depende de T003 (necesita que tokens.css exista para importarlo)
- T011 (Drawer) depende de T004 (animations.css con @keyframes de slide)
- T019 (WatchlistTree) depende de T017 (useWatchlistPrices hook)
- T022 (evidence Drawer en MainDashboard) depende de T011 (Drawer) y T013 (MainDashboard rediseñado)
- T025 (RuntimeModeSwitches badge en NavBar) depende de T013 (NavBar existe)

### Oportunidades de paralelismo

Dentro de Phase 2, pueden ejecutarse en paralelo: T003+T004+T005 (archivos distintos, sin dependencias entre sí).
Tras T006, pueden ejecutarse en paralelo: T007+T008+T009+T010+T011+T012.
En Phase 3: T014 y T015 son paralelos entre sí (distintos archivos).
En Phase 4: T017+T018+T020 son paralelos entre sí.
En Phase 5: T023+T024 son paralelos.
En Phase 6: T026+T027 son paralelos.
En Phase 7: T028+T029 son paralelos.
En Phase 8: T031+T032 son paralelos.

---

## Ejemplo de ejecución paralela — Phase 2

```bash
# Batch 1 (completamente independientes):
Tarea: "Crear src/styles/tokens.css con tokens Revolut dark+light+reduced-motion"
Tarea: "Crear src/styles/animations.css con @keyframes drawer, skeleton, fade"
Tarea: "Crear src/hooks/useAnimatedValue.ts con rAF y easing easeOutCubic"

# Batch 2 (tras completar Batch 1):
Tarea: "Actualizar src/index.css — importar tokens.css y animations.css"

# Batch 3 (tras completar Batch 2):
Tarea: "Crear src/components/ui/SkeletonCard.tsx"
Tarea: "Crear src/components/ui/PillGroup.tsx"
Tarea: "Crear src/components/ui/Badge.tsx"
Tarea: "Crear src/components/ui/Modal.tsx"
Tarea: "Crear src/components/ui/Drawer.tsx"
Tarea: "Crear src/layouts/DashboardLayout.tsx"
```

---

## Estrategia de implementación

### MVP (solo User Story 1)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (**crítico — bloquea todo**)
3. Completar Phase 3: User Story 1 (T013–T016)
4. **PARAR Y VALIDAR**: Dashboard abre con diseño Revolut, 3 zonas visibles, colores correctos
5. Ejecutar `npm run test` — 0 regresiones

### Entrega incremental

1. Setup + Foundational → base de design system lista
2. US1 → dashboard con identidad Revolut visible (MVP demo-able)
3. US2 → watchlist con precios + timeframe pill group + endpoint REST
4. US3 → drawer de evidencia (mejora flujo de análisis)
5. US4 → badge de modo en nav + modal confirmación Real (mejora seguridad)
6. US5 → WCAG AA + reduced-motion (accesibilidad)
7. Polish → calidad final

---

## Notas

- `[P]` = archivos distintos sin dependencias incompletas — pueden ejecutarse simultáneamente
- `[USn]` = trazabilidad directa a user story en spec.md
- El endpoint REST (T021) puede implementarse en paralelo con las tareas de PWA de US2 — son proyectos distintos
- Verificar `npm run test` tras cada fase — no acumular regresiones
- Todos los archivos nuevos y modificados requieren comentarios `// FIC:` EN/ES (T031)
- El bug preexistente de Tailwind (WatchlistTree y RuntimeModeSwitches) se resuelve en T019 y T025 respectivamente
