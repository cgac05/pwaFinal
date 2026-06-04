# Research: App Shell VS Code + AI Chat Panel

**Branch**: `005-app-shell-chat` | **Fecha**: 2026-05-28
**Referencia**: `specs/005-app-shell-chat/spec.md`

---

## Decisión 1 — WatchlistTree existente: reusar vs crear nuevo componente

**Decisión**: Adaptar `WatchlistTree.tsx` existente como `WatchlistView.tsx` en la nueva estructura del sidebar, manteniendo su lógica y envolviéndola en el LeftPanel.

**Rationale**: `WatchlistTree.tsx` ya implementa add ticker (POST `/api/watchlist`), remove ticker (DELETE `/api/watchlist/:id`), precios en tiempo real vía `useWatchlistPrices`, búsqueda y árbol por categorías. Reescribirlo sería duplicar trabajo validado. El ajuste necesario es de estilos/dimensiones para el panel de 280px.

**Alternativas consideradas**:
- Crear `WatchlistView.tsx` desde cero → duplicación innecesaria; lógica de gestión ya probada.
- Importar `WatchlistTree` directamente en `LeftPanel` → factible, pero es mejor tener un wrapper `WatchlistView` para mantener el contrato de interfaz del sidebar limpio.

---

## Decisión 2 — AppShell Store: patrón `useSyncExternalStore`

**Decisión**: El store del AppShell (`src/store/appShell.ts`) seguirá exactamente el mismo patrón que `src/store/signals.ts` — `useSyncExternalStore` nativo de React, sin Zustand ni Context.

**Rationale**: El proyecto ya estableció este patrón como su arquitectura de estado global ligero. Añadir Zustand o Context sería inconsistente y viola el principio de mínima complejidad. La persistencia via `localStorage` sigue el mismo patrón de `inversions.runtime.*`.

**Claves de localStorage para AppShell**:

| Clave | Valor | Default |
|-------|-------|---------|
| `inversions.appshell.section` | `"watchlist" \| "analysis" \| "strategies"` | `"watchlist"` |
| `inversions.appshell.left-collapsed` | `"true" \| "false"` | `"false"` |
| `inversions.appshell.chat-collapsed` | `"true" \| "false"` | `"false"` |
| `inversions.appshell.analysis-category` | `"technical" \| "institutional" \| "fundamental" \| "news" \| "ai"` | `"technical"` |
| `inversions.appshell.watchlist` | JSON string de `string[]` (símbolos) | `'["AAPL","MSFT","NVDA","SPY"]'` |

**Alternativas consideradas**:
- Zustand → dependencia externa innecesaria para 5 campos de estado.
- React Context → crea re-renders innecesarios; `useSyncExternalStore` es más eficiente.

---

## Decisión 3 — Historial del chat: sessionStorage

**Decisión**: El historial de mensajes del chat se almacena en `sessionStorage` bajo la clave `inversions.chat.history` como JSON array de `ChatMessage[]`.

**Rationale**: El spec (FR-009) indica que el historial persiste durante la sesión pero puede perderse al recargar. `sessionStorage` cumple exactamente este contrato: persiste mientras la pestaña está abierta, se limpia al cerrar/recargar. Evita crecimiento ilimitado en localStorage.

**Límite de crecimiento**: Si el historial supera 100 mensajes, se trunca el 20% más antiguo (80 mensajes) para evitar problemas de rendimiento. El usuario ve un mensaje de sistema indicando que se comprimió el historial.

**Alternativas consideradas**:
- localStorage → persiste entre sesiones (contradice FR-009).
- Estado React puro → se pierde al cerrar el panel o navegar; el spec requiere que persista al navegar entre secciones del dashboard.
- IndexedDB → sobreingeniería para el volumen esperado de mensajes.

---

## Decisión 4 — Endpoint de chat: contrato existente

**Decisión**: El chat panel usa `POST /api/chat/explain` con el payload `{symbol, timeframe, question, context?}`. El campo `context` se usa para enviar la categoría de análisis activa.

**Contrato verificado** (de `projects/rest-api/inversions_api/src/routes/indicators/chatExplain.ts`):

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `symbol` | string | ✅ | Símbolo del instrumento activo (e.g., `"AAPL"`) |
| `timeframe` | string | ✅ | Timeframe activo (e.g., `"1d"`, `"1h"`) |
| `question` | string | ✅ | Pregunta del usuario |
| `context` | string | ❌ | Contexto adicional (usaremos categoría de análisis activa) |

**Timeframes válidos**: `1m, 5m, 15m, 1h, 4h, 1d`

**Rate limit**: 10 requests/min por usuario (bucket "chat").

**Autenticación**: `getAuthHeaders()` de `src/services/signals/signalApi.ts`.

**Respuesta**: objeto con campo `explanation` (string) más metadatos del modelo.

**Si no hay instrumento activo**: `symbol` se omite o se envía vacío → el backend devuelve 400. El chat deberá mostrar un mensaje amigable y no deshabilitar el input; en su lugar enviar la pregunta sin contexto de instrumento (symbol = "" se maneja mostrando error al usuario).

**Alternativas consideradas**:
- Crear nuevo endpoint específico para chat panel → innecesario; el existente cubre el caso.

---

## Decisión 5 — Filtrado de secciones del dashboard por categoría de análisis

**Decisión**: El dashboard central aplica un `analysisCategory` filter que muestra/oculta bloques de componentes. El mapeo de categoría → secciones visibles es:

| Chip | Secciones visibles en MainDashboard |
|------|-------------------------------------|
| `technical` | SuperChart, TimeControls, IndicatorsMenu, ConfluenceSignalsTable, ExplainabilityTable |
| `options` | OptionGreeksRow, ConfluenceSignalsTable |
| `institutional` | ConfluenceSignalsTable (flujo), SignalOverlay + mensaje "Sección en construcción" |
| `fundamental` | Mensaje "Sección en construcción" |
| `news` | Mensaje "Sección en construcción" |
| `ai` | ExplainabilityTable, SignalOverlay, ConfluenceSignalsTable |

**Estado inicial** (`technical`): todas las secciones técnicas visibles (comportamiento actual del dashboard).

**Mecanismo**: `MainDashboard` lee `analysisCategory` del `appShell` store y aplica renders condicionales en cada bloque. No se unmount/remount completo — se usa `display: none` via className para preservar el estado interno de los componentes (ej. SuperChart mantiene su chart sin regenerarlo).

**Alternativas consideradas**:
- Tabs en el dashboard principal → cambia la arquitectura actual sin necesidad; AppShell chips ya cumplen el rol.
- Context de filtro → innecesario; el store es suficiente.

---

## Decisión 6 — Layout AppShell: CSS Grid de 4 columnas

**Decisión**: AppShell usa CSS grid con 4 columnas:
```
[activity-bar 48px] [left-panel var(--left-panel-width, 280px)] [main 1fr] [chat-panel var(--chat-panel-width, 360px)]
```
Los paneles colapsados usan `width: 0; overflow: hidden` en lugar de `display: none` para preservar el estado interno y mantener los elementos en el DOM (accesibilidad).

**Variables CSS nuevas en tokens.css**:
```css
--activity-bar-width: 48px;
--left-panel-width: 280px;
--chat-panel-width: 360px;
```

**Tablet (<1024px)**: grid colapsa a 2 columnas `[activity-bar 48px] [main 1fr]`. Los paneles izquierdo y de chat se convierten en `<Drawer>` (componente ya existente en `src/components/ui/Drawer.tsx`).

**Alternativas consideradas**:
- Flexbox → más difícil gestionar el collapse responsivo con transiciones CSS.
- 3 columnas con CSS variables para ocultar → grid de 4 columnas es más explícito y fácil de razonar.

---

## Decisión 7 — AnalysisCategoriesView: reusar PillGroup vs chips propios

**Decisión**: Crear chips propios en `AnalysisCategoriesView.tsx` en lugar de reusar `PillGroup.tsx`.

**Rationale**: `PillGroup.tsx` es un componente genérico de selección de pills. Sin embargo, los chips de Análisis necesitan un layout específico (wrap en 280px) y el mapeo directo a `appShell.setAnalysisCategory`. Reusar PillGroup añadiría una capa de prop-mapping innecesaria. Los chips propios son simples (5 items estáticos) y mantenibles.

**Alternativas consideradas**:
- Reusar PillGroup → posible, pero el overhead de adaptación supera el beneficio.

---

## Decisión 8 — Estrategias: cards estáticas informativas

**Decisión**: `StrategiesView.tsx` muestra 3 cards estáticas (Iron Condor, Collar Put, Married Put). Al hacer clic en una card se expande un acordeón con descripción de la estrategia. No hay lógica de configuración de estrategias en esta feature.

**Rationale**: El spec (Assumptions) establece que el catálogo inicial es fijo y la gestión dinámica queda fuera del alcance. Las cards estáticas cumplen FR-006 y US-4 sin over-engineering.

**Contenido de cada card**:
- Nombre + ícono
- Descripción breve (1-2 líneas)
- Perfil de riesgo (limitado/ilimitado)
- Cuándo usarla (mercado lateral/alcista/bajista)

---

## Decisión 9 — Navegación por teclado en ActivityBar

**Decisión**: Los botones de ActivityBar usan `<button>` HTML estándar con `tabIndex={0}`, `role="navigation"`, `aria-label` descriptivo y manejador `onKeyDown` que responde a Enter y Space. La navegación entre botones usa Tab (secuencia natural de botones HTML).

**Rationale**: Usar `<button>` nativo garantiza accesibilidad por defecto (Enter/Space funciona sin código extra). Solo se añade `onKeyDown` como refuerzo. El spec (FR-016) requiere solo la barra de actividad — no todo el panel.

---

## Decisión 10 — Validación de símbolo al agregar al Watchlist

**Decisión**: La validación del símbolo al agregarlo al watchlist se hace vía el endpoint `POST /api/watchlist` (ya existente). Si el backend devuelve error (symbol no reconocido), se muestra un mensaje de error inline en el campo de búsqueda. No se hace validación client-side previa.

**Rationale**: El backend ya tiene la lógica de validación. Duplicarla en el cliente crearía desincronización. La latencia de red es aceptable (el usuario ya espera la confirmación de persistencia).
