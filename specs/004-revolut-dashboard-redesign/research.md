# Research: Rediseño Dashboard Principal (Revolut Design System)

**Branch**: `004-redesign-ui-ux` | **Fecha**: 2026-05-28
**Referencia**: `specs/004-revolut-dashboard-redesign/spec.md`

---

## Hallazgo 1 — Formato de salida de `getdesign`

**Decisión**: Los tokens de Revolut se mapean manualmente a CSS custom properties en `src/styles/tokens.css`.

**Rationale**: `npx getdesign@latest add revolut` genera un archivo `DESIGN.md` — un documento de referencia en YAML/Markdown para agentes de IA, NO variables CSS listas para usar. No existe un paso de transformación automático. El plan requiere una fase de mapeo manual (o semi-automatizado) de tokens a propiedades CSS.

**Alternativas consideradas**:
- Usar un design token transformer (Style Dictionary) → sobreingeniería para esta escala; ~15 tokens relevantes.
- Copiar valores directamente en cada componente → viola el principio de token registry único.

**Tokens clave mapeados** (dark mode, que es el default de `prefers-color-scheme: dark`):

| Token Revolut | CSS Variable | Valor |
|---------------|-------------|-------|
| `canvas-dark` | `--color-bg` | `#000000` |
| `surface-deep` | `--color-surface` | `#0a0a0a` |
| `surface-elevated` | `--color-surface-raised` | `#16181a` |
| `hairline-dark` | `--color-border` | `rgba(255,255,255,0.12)` |
| `divider-soft` | `--color-border-subtle` | `rgba(255,255,255,0.06)` |
| `on-dark` | `--color-text` | `#ffffff` |
| `on-dark-mute` | `--color-text-muted` | `rgba(255,255,255,0.72)` |
| `primary` | `--color-accent` | `#494fdf` |
| `primary-bright` | `--color-accent-hover` | `#4f55f1` |
| `accent-teal` | `--color-buy` | `#00a87e` |
| `accent-danger` | `--color-sell` | `#e23b4a` |
| `accent-yellow` | `--color-hold` | `#b09000` |
| `rounded.full` | `--radius-pill` | `999px` |
| `rounded.lg` | `--radius-lg` | `20px` |
| `rounded.md` | `--radius-md` | `12px` |
| `rounded.sm` | `--radius-sm` | `8px` |
| `body-md` (Inter 400) | `--font-body` | `'Inter', system-ui, sans-serif` |
| `heading-sm` (Inter 600) | `--font-weight-heading` | `600` |

**Tokens light mode** (activados por `@media (prefers-color-scheme: light)`):

| CSS Variable | Valor light |
|-------------|-------------|
| `--color-bg` | `#ffffff` |
| `--color-surface` | `#f4f4f4` |
| `--color-surface-raised` | `#ffffff` |
| `--color-border` | `#e2e2e7` |
| `--color-border-subtle` | `rgba(0,0,0,0.06)` |
| `--color-text` | `#191c1f` |
| `--color-text-muted` | `#505a63` |
| `--color-accent` | `#494fdf` |
| `--color-accent-hover` | `#3a40c4` |

---

## Hallazgo 2 — Componentes con Tailwind classes sin Tailwind instalado

**Decisión**: Reescribir `WatchlistTree.tsx` y `RuntimeModeSwitches.tsx` usando CSS custom properties (mismo patrón que `CoreSelector.tsx` y `MainDashboard.tsx`).

**Rationale**: El `package.json` de la PWA no tiene Tailwind CSS como dependencia. `WatchlistTree` y `RuntimeModeSwitches` usan clases como `flex`, `items-center`, `bg-white`, `text-gray-500` que no producen ningún estilo — el DOM renderiza sin CSS aplicado. Esto es un bug preexistente que el rediseño resuelve como efecto colateral.

**Alternativas consideradas**:
- Instalar Tailwind CSS → introduce un sistema de estilos dual (Tailwind + CSS vars); aumenta el bundle; contradice el patrón ya establecido en el proyecto.
- Mantener clases Tailwind y agregar Tailwind → mismo problema.

---

## Hallazgo 3 — Estrategia de animaciones

**Decisión**: CSS transitions + `@keyframes` nativos + hook `useAnimatedValue` basado en `requestAnimationFrame`. Sin librería de animación externa.

**Rationale**: El proyecto ya tiene `transition: background 0.15s` en botones (index.css). Los requerimientos (B+C de la spec) se cubren completamente con:
- **Transiciones de estado** (hover, focus, open/close): CSS `transition` en los elementos afectados.
- **Drawer slide-in/out**: CSS `@keyframes` con `transform: translateX()` + clase activa manejada por React state.
- **Contadores animados** (precios, scores): hook `useAnimatedValue(target, duration)` usando `requestAnimationFrame` con easing `easeOutCubic`.
- **Skeleton loaders con pulse**: CSS `@keyframes pulse` con `opacity` oscilante.

**Regla de `prefers-reduced-motion`**: Todo el CSS de animación se envuelve en `@media (prefers-reduced-motion: no-preference)` o se anula explícitamente con `@media (prefers-reduced-motion: reduce)`.

**Alternativas consideradas**:
- `framer-motion` → ~50KB gzip; sobreingeniería para los requerimientos; introduce dependencia mayor.
- `react-spring` → similar a framer-motion; mismo argumento.
- Web Animations API → menor soporte en Safari; más verboso que CSS.

---

## Hallazgo 4 — Fuente Aeonik Pro

**Decisión**: Usar `Inter` como fuente principal. Aeonik Pro NO se aplica.

**Rationale**: El propio Design System de Revolut indica "Use **Inter** for body, button labels, captions — never substitute Aeonik Pro for body type." Aeonik Pro es exclusiva para display/marketing (80–136px headlines) que no existen en el dashboard operativo. Inter es gratis, está disponible en Google Fonts, y ya es parte del font stack system del proyecto.

**Acción**: Añadir `<link>` a Google Fonts (Inter 400/500/600/700) en `index.html`.

---

## Hallazgo 5 — Datos de precio y % cambio para WatchlistTree

**Decisión**: Nuevo endpoint `GET /api/market/quotes?symbols=AAPL,MSFT,...` en la REST API; hook `useWatchlistPrices` en la PWA que lo consume con polling cada 30s.

**Rationale**: El endpoint actual `/api/watchlist` devuelve `{ id, symbol, name, category, isFavorite }` — sin datos de precio. Para mostrar ticker + precio + % cambio (FR-014) se necesita:
1. Un endpoint de cotizaciones en la REST API (Picoro → Krilin implementa).
2. Un hook en la PWA que recibe la lista de símbolos y devuelve `{ [symbol]: { price, change, changePercent } }`.

**Alternativas consideradas**:
- Enriquecer `/api/watchlist` con precio → acopla datos de mercado al recurso de watchlist; viola separación de responsabilidades.
- Usar datos del orquestador ya cargado → el orquestador solo tiene símbolos del payload activo, no toda la watchlist.
- WebSocket/SSE en lugar de polling → complejidad no justificada para v1 del rediseño.

**Contrato del endpoint**:
```
GET /api/market/quotes?symbols=AAPL,MSFT,NVDA,SPY
Response 200:
{
  "quotes": [
    { "symbol": "AAPL", "price": 213.45, "change": 2.30, "changePercent": 1.09 },
    ...
  ]
}
```

---

## Hallazgo 6 — Estrategia de theming `prefers-color-scheme`

**Decisión**: CSS media query en `tokens.css` — sin estado React, sin JavaScript, sin localStorage.

**Rationale**: El mecanismo más simple y performante. No requiere contexto React ni recarga. Los tokens dark son el default en `:root`; los tokens light se sobreescriben en `@media (prefers-color-scheme: light) { :root { } }`. El navegador aplica el tema correcto antes del primer paint.

**Patrón implementado**:
```css
:root {
  --color-bg: #000000;       /* dark default */
  /* ... resto de tokens dark */
}

@media (prefers-color-scheme: light) {
  :root {
    --color-bg: #ffffff;     /* light override */
    /* ... resto de tokens light */
  }
}
```

---

## Resumen de decisiones

| # | Pregunta | Decisión |
|---|----------|----------|
| 1 | Formato de tokens getdesign | Mapeo manual a CSS custom properties en `tokens.css` |
| 2 | Componentes con Tailwind roto | Reescribir con CSS vars (bug preexistente resuelto) |
| 3 | Librería de animaciones | Sin dependencia externa: CSS transitions + rAF hook |
| 4 | Fuente Aeonik Pro | Inter via Google Fonts (recomendado por Revolut para body/UI) |
| 5 | Datos precio/% WatchlistTree | Nuevo endpoint REST + hook `useWatchlistPrices` con polling |
| 6 | Theming dark/light | CSS `@media (prefers-color-scheme)` puro, sin JS |
