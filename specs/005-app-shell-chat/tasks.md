# Tasks: App Shell VS Code + AI Chat Panel

**Input**: Design documents from `specs/005-app-shell-chat/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Incluidos — la Constitución del Proyecto requiere testing y evidencia obligatoria.

**Organization**: Tareas agrupadas por user story para implementación y testing independiente.

## Format: `[ID] [P?] [Story] Descripción con ruta de archivo`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias)
- **[Story]**: User story a la que pertenece la tarea (US1–US6)
- Se usan rutas reales del workspace `@inversions/pwa`

---

## Phase 1: Setup (Infraestructura base)

**Purpose**: Variables CSS necesarias para el layout antes de cualquier componente.

- [X] T001 Agregar 3 variables CSS al archivo `projects/pwa/inversions_app/src/styles/tokens.css`: `--activity-bar-width: 48px`, `--left-panel-width: 280px`, `--chat-panel-width: 360px`

---

## Phase 2: Foundational (Prerrequisitos bloqueantes)

**Purpose**: Store del AppShell y layout base — DEBEN completarse antes de cualquier user story.

**⚠️ CRÍTICO**: Ninguna user story puede comenzar hasta que esta fase esté completa.

- [X] T002 Crear `projects/pwa/inversions_app/src/store/appShell.ts` — store con patrón `useSyncExternalStore` (igual que `signals.ts`), campos: `activeSection`, `leftPanelCollapsed`, `chatPanelCollapsed`, `analysisCategory`; persistencia en localStorage con claves `inversions.appshell.*`; FIC: comentarios bilingues EN/ES
- [X] T003 [P] Crear `projects/pwa/inversions_app/src/layouts/AppShell.tsx` — CSS grid de 4 columnas (`--activity-bar-width | --left-panel-width | 1fr | --chat-panel-width`), colapso via `max-width + overflow:hidden` (sin unmount), en tablet (<1024px) panel izquierdo y chat usan `<Drawer>` existente; FIC: comentarios bilingues EN/ES
- [X] T004 [P] Crear `projects/pwa/inversions_app/src/components/ui/ActivityBar.tsx` — 3 botones `<button>` (Watchlist, Análisis, Estrategias), íconos de `lucide-react`, `tabIndex={0}`, `aria-label` descriptivo, `onKeyDown` Enter/Space, lógica de toggle: clic en sección activa colapsa panel, clic en inactiva cambia sección y expande; usa `useAppShellStore()`; FIC: comentarios bilingues EN/ES

**Checkpoint**: Store + layout base + barra de actividad listos. Se puede comenzar US1.

---

## Phase 3: User Story 1 — Navegar entre secciones (Priority: P1) 🎯 MVP

**Goal**: El usuario puede hacer clic en íconos de la barra de actividad para cambiar el contenido del panel izquierdo; clic en ícono activo colapsa/expande el panel.

**Independent Test**: Cargar el dashboard, hacer clic en Watchlist → Análisis → Estrategias verificando que el panel izquierdo cambia de contenido instantáneamente; hacer clic en el ícono activo y verificar que el panel se colapsa; hacer clic de nuevo para expandirlo.

### Tests para User Story 1

> **NOTA: Escribir tests ANTES de la implementación — deben FALLAR primero**

- [X] T005 [P] [US1] Crear `projects/pwa/inversions_app/src/components/ui/ActivityBar.test.tsx` — tests: (a) clic en ícono inactivo llama `setActiveSection`, (b) clic en ícono activo llama `toggleLeftPanel`, (c) Enter/Space activan el botón, (d) cada botón tiene `aria-label` correcto
- [X] T006 [P] [US1] Crear `projects/pwa/inversions_app/src/layouts/AppShell.test.tsx` — tests: (a) renderiza las 4 zonas, (b) panel izquierdo tiene `max-width: 0` cuando `leftPanelCollapsed=true`, (c) panel chat tiene `max-width: 0` cuando `chatPanelCollapsed=true`, (d) barra de actividad siempre visible, (e) en viewport de 800px el panel izquierdo no ocupa columna del grid sino que es un `<Drawer>` (FR-013: cobertura tablet) [remediación C2]

### Implementación de User Story 1

- [X] T007 [US1] Crear `projects/pwa/inversions_app/src/features/sidebar/LeftPanel.tsx` — contenedor del panel izquierdo: header con título de sección y botón de colapso, `switch` por `activeSection` que renderiza `WatchlistView | AnalysisCategoriesView | StrategiesView` (placeholders vacíos por ahora); usa `useAppShellStore()`; FIC: comentarios bilingues EN/ES
- [X] T008 [US1] Modificar `projects/pwa/inversions_app/src/features/dashboard/MainDashboard.tsx` — reemplazar `<DashboardLayout>` con `<AppShell>`, pasando `<ActivityBar>` y `<LeftPanel>` como slots del layout; `DashboardLayout.tsx` se preserva sin eliminar; verificar que el dashboard central no pierde ninguna funcionalidad

**Checkpoint**: US1 completamente funcional. La navegación entre secciones y el toggle de colapso del panel izquierdo funcionan. El MVP básico del AppShell está operativo.

---

## Phase 4: User Story 2 — Gestionar y usar el Watchlist (Priority: P2)

**Goal**: El usuario puede buscar tickers, agregar nuevos y eliminar existentes desde el panel Watchlist; ver precio y cambio % de cada instrumento.

**Independent Test**: Activar sección Watchlist en la barra de actividad, escribir "TSLA" en el buscador, agregar el ticker, verificar que aparece en el árbol con precio/%, luego eliminarlo y verificar que desaparece.

### Tests para User Story 2

- [X] T009 [P] [US2] Crear `projects/pwa/inversions_app/src/features/sidebar/views/WatchlistView.test.tsx` — tests: (a) renderiza el campo de búsqueda y el árbol, (b) el árbol filtra cuando se escribe en el buscador, (c) estado vacío "Sin resultados" cuando no hay coincidencias, (d) muestra estado de carga de precios

### Implementación de User Story 2

- [X] T010 [US2] Crear `projects/pwa/inversions_app/src/features/sidebar/views/WatchlistView.tsx` — wrapper/adaptación del componente `WatchlistTree` existente (`features/dashboard/WatchlistTree.tsx`) para el panel de 280px: ajustar estilos CSS para el ancho reducido, preservar toda la lógica de add/remove/search/prices; asegurar que los errores del backend al agregar un símbolo inválido (respuesta no-2xx de `POST /api/watchlist`) se muestran como mensaje de error inline en el campo de búsqueda (FR-014) sin cerrar el panel; FIC: comentarios bilingues EN/ES [remediación C1]
- [X] T011 [US2] Registrar `WatchlistView` en el switch de `features/sidebar/LeftPanel.tsx` — reemplazar el placeholder de Watchlist con la vista real; criterios de aceptación visuales: sin scroll horizontal, precio y porcentaje visibles sin truncar en el viewport de 280px, botón de quitar accesible sin overflow lateral [remediación A1]

**Checkpoint**: US2 completamente funcional. El usuario puede gestionar su watchlist desde el panel izquierdo.

---

## Phase 5: User Story 5 — Chat IA (Priority: P2)

**Goal**: El usuario puede abrir el panel de chat derecho, enviar preguntas al asistente de IA con contexto del instrumento activo, y el historial persiste durante la sesión.

**Independent Test**: Abrir el panel de chat (ícono o botón), verificar que el badge muestra el símbolo/timeframe activo, escribir una pregunta, verificar que el input se deshabilita durante el procesamiento, y que aparece la respuesta del asistente con historial scrollable.

### Tests para User Story 5

- [X] T012 [P] [US5] Crear `projects/pwa/inversions_app/src/services/chat/chatApi.test.ts` — tests con mock fetch: (a) sendChatMessage happy path devuelve `explanation`, (b) error 400 lanza error descriptivo, (c) error 429 lanza error de rate limit, (d) error 5xx lanza error de servidor
- [X] T013 [P] [US5] Crear `projects/pwa/inversions_app/src/features/chat/ChatInputBar.test.tsx` — tests: (a) botón de envío y textarea deshabilitados cuando `pending=true`, (b) habilitados cuando `pending=false`, (c) envío vacío no dispara `onSend`
- [X] T014 [P] [US5] Crear `projects/pwa/inversions_app/src/features/chat/ChatContextBadge.test.tsx` — tests: (a) muestra símbolo y timeframe del instrumento activo, (b) muestra "Sin contexto" cuando no hay instrumento activo

### Implementación de User Story 5

- [X] T015 [US5] Crear `projects/pwa/inversions_app/src/features/chat/types.ts` — interfaces: `ChatMessage { id, role, content, context, timestamp, status }`, `ChatContext { symbol, timeframe, analysisCategory }`, type `ChatStatus = "pending" | "ok" | "error"`, type `ChatRole = "user" | "assistant" | "system"`
- [X] T016 [US5] Crear `projects/pwa/inversions_app/src/services/chat/chatApi.ts` — función `sendChatMessage(req: ChatRequest): Promise<ChatResponse>`, usa `getAuthHeaders()` de `signalApi.ts`, maneja errores 400/404/429/5xx con mensajes descriptivos; implementar timeout con `AbortSignal.timeout(15_000)` — si la petición excede 15s lanzar error con mensaje "El asistente tardó demasiado. Intenta de nuevo." (cubre SC-003); FIC: comentarios bilingues EN/ES [remediación C3]
- [X] T017 [P] [US5] Crear `projects/pwa/inversions_app/src/features/chat/ChatContextBadge.tsx` — lee `useSignalStore().selectedInstrument` y `useSignalStore()` para timeframe; muestra badge con símbolo/timeframe o "Sin contexto"; actualización reactiva cuando cambia el instrumento activo; FIC: comentarios bilingues EN/ES
- [X] T018 [P] [US5] Crear `projects/pwa/inversions_app/src/features/chat/ChatInputBar.tsx` — `<textarea>` controlado + botón de envío; props: `onSend(text: string)`, `pending: boolean`; `disabled` en textarea y botón cuando `pending=true`; `onKeyDown` Enter (sin Shift) dispara `onSend`; FIC: comentarios bilingues EN/ES
- [X] T019 [US5] Crear `projects/pwa/inversions_app/src/features/chat/ChatMessageList.tsx` — renderiza lista de `ChatMessage[]`; mensaje del asistente con `status="pending"` muestra skeleton/spinner; `status="error"` muestra mensaje de error + botón "Reintentar"; `useEffect` → `scrollIntoView` en el último mensaje; mensaje de sistema para historial truncado; FIC: comentarios bilingues EN/ES
- [X] T020 [US5] Crear `projects/pwa/inversions_app/src/features/chat/ChatPanel.tsx` — contenedor completo: header (título + badge de contexto + botón colapso), `ChatMessageList`, `ChatInputBar`; estado del historial en `sessionStorage["inversions.chat.history"]`; lógica de envío: agrega mensaje user → agrega mensaje assistant pending → llama `sendChatMessage` → actualiza con respuesta o error; truncado a 100 mensajes; FIC: comentarios bilingues EN/ES
- [X] T021 [US5] Integrar `ChatPanel` en `projects/pwa/inversions_app/src/layouts/AppShell.tsx` como zona derecha del grid; conectar `chatPanelCollapsed` del store al estado del panel

**Checkpoint**: US5 completamente funcional. El chat IA responde con contexto del instrumento activo, el input se bloquea durante el procesamiento y el historial persiste durante la sesión.

---

## Phase 6: User Story 3 — Filtrado del dashboard por categoría de análisis (Priority: P3)

**Goal**: El usuario puede seleccionar una categoría de análisis (Técnico/Institucional/Fundamental/Noticias/IA) con chips en el panel izquierdo; el dashboard central oculta/muestra secciones según la categoría activa.

**Independent Test**: Activar sección Análisis en la barra de actividad, hacer clic en el chip "Opciones" — el dashboard debe ocultar las secciones técnicas y mostrar OptionGreeksRow y ConfluenceSignalsTable; hacer clic en "Técnico" — volver a la vista completa.

### Tests para User Story 3

- [X] T022 [P] [US3] Crear `projects/pwa/inversions_app/src/features/sidebar/views/AnalysisCategoriesView.test.tsx` — tests: (a) 5 chips renderizados con labels correctos, (b) clic en chip llama `setAnalysisCategory`, (c) chip "Técnico" activo por defecto, (d) solo un chip activo a la vez, (e) cuando `analysisCategory` ya tiene un valor en el store distinto de "technical", ese chip se muestra activo al montar — garantiza que al navegar fuera de Análisis y volver el filtro se recupera (US3 Acceptance Scenario 4) [remediación I1]

### Implementación de User Story 3

- [X] T023 [US3] Crear `projects/pwa/inversions_app/src/features/sidebar/views/AnalysisCategoriesView.tsx` — 5 chips (`<button>` estilizados): Técnico, Institucional, Fundamental, Noticias, IA; chip activo destacado visualmente; clic → `useAppShellStore().setAnalysisCategory()`; default "technical" al montar; FIC: comentarios bilingues EN/ES
- [X] T024 [US3] Registrar `AnalysisCategoriesView` en `features/sidebar/LeftPanel.tsx` — reemplazar placeholder de Análisis con la vista real
- [X] T025 [US3] Modificar `projects/pwa/inversions_app/src/features/dashboard/MainDashboard.tsx` — leer `analysisCategory` de `useAppShellStore()`; envolver cada bloque de secciones con render condicional según el mapeo de `data-model.md` Entidad 5 (usar `style={{ display: visible ? "" : "none" }}` para preservar estado interno de componentes como SuperChart); para Institucional/Fundamental/Noticias mostrar un bloque inline dentro de MainDashboard (no un componente separado) con ícono de `lucide-react` (`Construction` o `Clock`) y texto "Esta sección estará disponible próximamente" [remediación U1]

**Checkpoint**: US3 completamente funcional. Los chips filtran el dashboard correctamente.

---

## Phase 7: User Story 6 — Colapsar paneles (Priority: P3)

**Goal**: El usuario puede colapsar/expandir el panel izquierdo y el panel de chat para maximizar el espacio del dashboard central; la configuración persiste entre sesiones.

**Independent Test**: Hacer clic en el control de colapso del panel izquierdo — el dashboard debe expandirse y la barra de actividad permanecer visible; hacer clic de nuevo para expandir; recargar la página y verificar que el estado de colapso se restaura.

### Tests para User Story 6

- [X] T026 [P] [US6] Agregar tests de colapso a `projects/pwa/inversions_app/src/store/appShell.test.ts` — tests: (a) `leftPanelCollapsed` persiste en localStorage, (b) `chatPanelCollapsed` persiste en localStorage, (c) valores se restauran correctamente al re-inicializar el store

### Implementación de User Story 6

- [X] T027 [US6] Extender (no reescribir) `projects/pwa/inversions_app/src/layouts/AppShell.tsx` creado en T003 — añadir botón chevron en el borde del panel izquierdo para colapsar/expandir (`toggleLeftPanel()`); botón similar en el panel de chat (`toggleChatPanel()`); agregar `transition: max-width 0.25s ease` al estilo inline de ambos paneles; el grid y los slots definidos en T003 se preservan sin cambios [remediación D1]
- [X] T028 [US6] Verificar SC-002 y SC-008 en el browser — criterio de pass: (a) la transición de colapso/expansión completa visualmente en <300ms medido con el panel Performance de Chrome DevTools (hardware de gama media); (b) al recargar, el layout restaura su configuración antes de que transcurra el primer frame pintado (~16ms post-hydration) sin layout shift visible; documentar resultado como PASS/FAIL en `specs/005-app-shell-chat/checklists/requirements.md` [remediación U2]

**Checkpoint**: US6 completamente funcional. Los paneles se colapsan con animación y el estado persiste.

---

## Phase 8: User Story 4 — Estrategias de opciones (Priority: P4)

**Goal**: El usuario puede ver las 3 cards de estrategias y expandir cada una para ver detalles.

**Independent Test**: Activar sección Estrategias en la barra de actividad; verificar que aparecen 3 cards (Iron Condor, Collar Put, Married Put); hacer clic en una card para expandir el acordeón con la descripción.

### Implementación de User Story 4

- [X] T029 [P] [US4] Crear `projects/pwa/inversions_app/src/features/sidebar/views/StrategiesView.tsx` — 3 cards estáticas con acordeón (toggle de `isExpanded` por card): cada card muestra nombre + ícono de `lucide-react` + descripción breve; al expandir muestra perfil de riesgo y contexto de mercado (datos hardcodeados per `data-model.md` Entidad 6); FIC: comentarios bilingues EN/ES
- [X] T030 [US4] Registrar `StrategiesView` en `features/sidebar/LeftPanel.tsx` — reemplazar placeholder de Estrategias con la vista real

**Checkpoint**: US4 completamente funcional. Las 3 cards de estrategias se muestran con acordeón.

---

## Phase 9: Polish & Validación final

**Purpose**: Tests de integración, tests de regresión del dashboard y validación manual per quickstart.md.

- [X] T031 [P] Crear `projects/pwa/inversions_app/src/store/appShell.test.ts` — tests completos del store: (a) defaults correctos al inicializar sin localStorage, (b) persistencia de los 4 campos en localStorage, (c) restauración correcta al re-inicializar, (d) `setActiveSection` expande el panel cuando estaba colapsado
- [X] T032 [P] Crear `projects/pwa/inversions_app/src/features/chat/ChatPanel.test.tsx` — tests: (a) historial se carga desde sessionStorage al montar, (b) historial se guarda en sessionStorage al enviar, (c) truncado a 100 mensajes con mensaje de sistema, (d) scroll automático al recibir nuevo mensaje
- [X] T033 Agregar tests de regresión a `projects/pwa/inversions_app/src/features/dashboard/MainDashboard.test.tsx` — verificar que todos los componentes existentes del dashboard (SuperChart, ConfluenceSignalsTable, ExplainabilityTable, OptionGreeksRow, RuntimeModeSwitches, SimulationControlPanel) siguen renderizando correctamente dentro del nuevo AppShell (0 regresiones funcionales — SC-005)
- [X] T034 Ejecutar suite completa: `npm run -w @inversions/pwa test` — todos los tests deben pasar; corregir cualquier falla antes de marcar la feature como completa
- [X] T035 Validación manual per `specs/005-app-shell-chat/quickstart.md` — ejecutar los 9 pasos de verificación manual; actualizar el checklist `specs/005-app-shell-chat/checklists/requirements.md` marcando todos los SC como verificados

---

## Phase 10: Bug Fixes post-implementación

**Purpose**: Corrección de bugs detectados en validación manual post-merge de Feature 005.

- [X] T036 [BF] Fix `store/appShell.ts` — `getSnapshot()` devolvía la misma referencia del objeto mutable; añadir `let snapshot = { ...state }` y reemplazar en `emit()` para que `useSyncExternalStore` detecte cambios y React re-renderice (bug: clic en ActivityBar no actualizaba UI hasta refrescar)
- [X] T037 [BF] Fix `layouts/AppShell.tsx:20-21` — `leftWidth` y `chatWidth` usaban `"0px"` al colapsar, recortando el botón toggle con `overflow:hidden`; cambiar a `"12px"` para que el botón permanezca visible y el panel sea reapertuable
- [X] T038 [BF] Fix `features/sidebar/views/WatchlistView.tsx:123` — `onChange` llamaba `setAddError(null)` en cada keystroke, haciendo que el mensaje de error desapareciera mientras el usuario retipeaba; quitar el clear del `onChange` (ya se limpia en `handleAdd`)
- [X] T039 [BF] Fix `features/dashboard/MainDashboard.tsx` — SuperChart envuelto en condición `showTechnical` se ocultaba al cambiar `analysisCategory`; mover el bloque SuperChart + controles (RuntimeModeSwitches, IndicatorsMenu, TimeControls, SimulationControlPanel) fuera del wrapper para que sea siempre visible
- [X] T040 [BF] Ejecutar suite de tests post-fix: `npx vitest run` en `projects/pwa/inversions_app` — todos los tests deben pasar; validar manualmente los 3 bugs en el browser

---

## Phase 11: UX Polish

**Purpose**: Mejoras UI/UX identificadas en análisis experto post-implementación Feature 005.

- [X] T041 [UX] Fix AppShell.tsx (H-01) — mover toggles de colapso fuera de paneles: sacar <button> de zonas 2 y 4, insertarlos como flex siblings (zone2|leftToggle|main|chatToggle|zone4), regresar maxWidth colapsado a "0px", usar ChevronRight/ChevronLeft (lucide)
- [X] T042 [UX] Fix AppShell.test.tsx — actualizar assertions "0px" (consecuencia de T041)
- [X] T043 [UX] Fix LeftPanel.tsx (H-02) — eliminar botón ‹ del header y destructuring de toggleLeftPanel
- [X] T044 [UX] Fix CoreSelector.tsx (H-03) — reemplazar label+checkbox por <button aria-pressed>, mantener estilo visual + badge SI/NO
- [X] T045 [UX] Fix MainDashboard.tsx (H-04) — eliminar filter bar (instrumentsInput + activeCoreCount + Actualizar), cambiar orchestrator a instruments: selectedSymbol, agregar selectedSymbol a deps del useEffect via refreshDashboard callback
- [X] T046 [UX] Fix MainDashboard.tsx (H-05) — envolver "Detalle de evidencia" con isTestEnv
- [X] T047 [UX] Fix MainDashboard.tsx (H-06 + H-07) — eliminar variable nav muerta, eliminar import WatchlistTree, eliminar state drawerOpen
- [X] T048 [UX] Ejecutar suite de tests post-polish: 64/64 tests pasan + tests de dashboard actualizados (getByRole button en lugar de checkbox; assertions de filter bar eliminadas)

---

## Dependencies & Execution Order

### Dependencias entre fases

- **Setup (Phase 1)**: Sin dependencias — puede comenzar inmediatamente
- **Foundational (Phase 2)**: Depende de Phase 1 — BLOQUEA todas las user stories
- **US1 (Phase 3)**: Depende de Phase 2 — MVP mínimo viable
- **US2 (Phase 4)**: Depende de Phase 2 + US1 (LeftPanel.tsx debe existir)
- **US5 (Phase 5)**: Depende de Phase 2 — **puede ejecutarse en paralelo con US2**
- **US3 (Phase 6)**: Depende de Phase 2 + US1; requiere LeftPanel routing listo
- **US6 (Phase 7)**: Depende de Phase 2 + US1; los controles van en AppShell
- **US4 (Phase 8)**: Depende de US1; requiere LeftPanel routing listo; **puede ejecutarse en paralelo con US3 y US6**
- **Polish (Phase 9)**: Depende de todas las user stories completadas

### Dependencias dentro de cada user story

```
US5: T015 (types) → T016 (chatApi) → T017, T018 (paralelo) → T019 (ChatMessageList) → T020 (ChatPanel) → T021 (integración)
US3: T023 (view) → T024 (registro en LeftPanel) → T025 (filtro MainDashboard)
US4: T029 (view) → T030 (registro en LeftPanel)
```

### Oportunidades de paralelismo

- T003, T004 (Phase 2): Paralelos entre sí
- T005, T006 (US1 tests): Paralelos entre sí y con T003/T004
- T009, T012, T013, T014 (tests US2 y US5): Paralelos entre sí
- T017, T018 (ChatContextBadge y ChatInputBar): Paralelos entre sí
- US2 completa y US5 completa: Paralelas entre sí (archivos distintos)
- US4 puede ejecutarse en paralelo con US3 y US6

---

## Parallel Example: US2 y US5 (ambas P2)

```bash
# Ejecutar en paralelo (agentes distintos, archivos distintos):
Task A: "Implementar WatchlistView en features/sidebar/views/WatchlistView.tsx"
Task B: "Crear ChatPanel completo en features/chat/ChatPanel.tsx"

# Estas dos user stories no comparten archivos y pueden completarse simultáneamente
```

---

## Implementation Strategy

### MVP (Solo US1 — Phase 1 a Phase 3)

1. Completar Phase 1: Setup (tokens.css)
2. Completar Phase 2: Foundational (store + AppShell + ActivityBar)
3. Completar Phase 3: US1 (LeftPanel routing + integración MainDashboard)
4. **PARAR Y VALIDAR**: La barra de actividad cambia entre secciones placeholder
5. El dashboard central funciona sin regresiones

### Entrega incremental

1. Phase 1+2+3 → MVP: navegación entre secciones ✅
2. Phase 4 (US2) → Watchlist con gestión completa ✅
3. Phase 5 (US5) → Chat IA funcional ✅
4. Phase 6 (US3) → Filtrado del dashboard ✅
5. Phase 7 (US6) → Colapso de paneles con persistencia ✅
6. Phase 8 (US4) → Cards de estrategias ✅
7. Phase 9 → Tests completos + validación manual ✅

---

## Notes

- [P] = archivos distintos, sin dependencias entre sí en esa fase
- [Story] = traza la tarea a una user story específica del spec
- Cada user story es completable y testeable de forma independiente
- Convención FIC: obligatoria en todos los archivos nuevos
- `DashboardLayout.tsx` se PRESERVA — no eliminar
- Breakpoint tablet: 1024px (mismo que DashboardLayout existente)
- Patrón de store: `useSyncExternalStore` (sin Zustand ni Context)
- CSS: sin Tailwind; solo CSS custom properties de `tokens.css`
