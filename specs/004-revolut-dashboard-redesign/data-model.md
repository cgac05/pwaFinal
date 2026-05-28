# Modelo de Datos: Rediseño Dashboard Principal (Revolut Design System)

**Branch**: `004-redesign-ui-ux` | **Fecha**: 2026-05-28

---

## Entidades del Feature

Este feature es principalmente visual/UX. Las entidades que introduce o modifica son:

---

### 1. RevolutTokenSet

Representa el conjunto de CSS custom properties que implementan el Revolut Design System. No es un tipo TypeScript — es el contrato del archivo `src/styles/tokens.css`.

**Propiedades (CSS custom properties)**:

```
Capa de color:
  --color-bg              Fondo principal de la aplicación
  --color-surface         Superficie de cards y nav bar
  --color-surface-raised  Superficie elevada (dropdowns, tooltips)
  --color-border          Borde estándar
  --color-border-subtle   Borde sutil (separadores internos)
  --color-text            Texto principal
  --color-text-muted      Texto secundario / labels
  --color-accent          Acento principal (cobalt-violet #494fdf)
  --color-accent-hover    Acento hover
  --color-buy             Estado positivo / compra (teal #00a87e)
  --color-sell            Estado negativo / venta (danger #e23b4a)
  --color-hold            Estado neutro (yellow #b09000)

Capa de forma:
  --radius-pill           999px (botones, badges, pills)
  --radius-lg             20px (cards, drawers)
  --radius-md             12px (inputs, chips)
  --radius-sm             8px  (elementos pequeños)

Capa de tipografía:
  --font-family           'Inter', system-ui, sans-serif
  --font-weight-body      400
  --font-weight-emphasis  600
  --font-weight-bold      700

Capa de animación:
  --duration-fast         120ms
  --duration-normal       220ms
  --duration-slow         350ms
  --easing-standard       cubic-bezier(0.4, 0, 0.2, 1)
  --easing-decelerate     cubic-bezier(0, 0, 0.2, 1)
```

**Variantes**: Las mismas propiedades se re-declaran en `@media (prefers-color-scheme: light)` para el tema claro. Ver `research.md` Hallazgo 6.

**Reglas de validación**:
- Ningún componente hardcodea valores de color, spacing o radius — siempre referencias a CSS variables.
- Las variables de animación se usan solo dentro de `@media (prefers-reduced-motion: no-preference)`.

---

### 2. WatchlistItem (extendida)

Extensión del tipo existente con campos de cotización de mercado.

```typescript
interface WatchlistItem {
  // Campos existentes (sin cambio)
  id: string;
  symbol: string;
  name: string;
  category: string;
  isFavorite: boolean;

  // Campos nuevos (poblados por useWatchlistPrices hook)
  price?: number;           // Último precio negociado
  change?: number;          // Cambio absoluto del día
  changePercent?: number;   // Cambio porcentual del día (ej: 1.09 = +1.09%)
  priceLoading?: boolean;   // true mientras se carga el primer precio
}
```

**Reglas de validación**:
- `price`, `change`, `changePercent` son opcionales; la UI muestra `—` cuando son `undefined`.
- `changePercent > 0` → color `var(--color-buy)`; `< 0` → `var(--color-sell)`; `=== 0` → `var(--color-text-muted)`.
- Los campos de precio son de solo lectura en la UI — no se persisten en el servidor.

**Ciclo de vida**:
```
mount → useWatchlistPrices(symbols[]) → fetch /api/market/quotes → merge en WatchlistItem[]
                                     ↓ polling 30s
                                     → update price/change/changePercent
                                     → micro-animación de contador si valor cambió
```

---

### 3. MarketQuote

Respuesta del nuevo endpoint `GET /api/market/quotes`.

```typescript
interface MarketQuote {
  symbol: string;
  price: number;
  change: number;           // Delta absoluto vs. cierre anterior
  changePercent: number;    // Delta porcentual vs. cierre anterior
  timestamp: string;        // ISO 8601
}

interface MarketQuotesResponse {
  quotes: MarketQuote[];
}
```

**Reglas de validación**:
- `symbol` debe estar en la lista solicitada.
- `price` > 0.
- `timestamp` no debe tener más de 5 minutos de antigüedad para considerarse fresco.

---

### 4. DrawerState

Estado local para drawers (Watchlist en tablet + Panel de evidencia).

```typescript
interface DrawerState {
  isOpen: boolean;
  type: 'watchlist' | 'evidence' | null;
}
```

**Transiciones de estado**:
```
cerrado → abierto: clase CSS 'drawer--open' → animation slide-in 350ms
abierto → cerrado: clase CSS 'drawer--closing' → animation slide-out 220ms → isOpen = false
```

**Reglas de validación**:
- Solo un drawer puede estar abierto a la vez.
- Al abrir un drawer, el scroll del documento subyacente se bloquea (`overflow: hidden` en `body`).
- Cierre por ESC o click en backdrop; al cerrar se restaura el foco al elemento que lo abrió.

---

### 5. RuntimeBadgeConfig

Configuración visual del badge de modo runtime en la nav bar.

```typescript
interface RuntimeBadgeConfig {
  runtimeMode: 'online' | 'offline';
  operationalMode: 'demo' | 'real';
  label: string;            // Texto del badge (ej: "ONLINE · DEMO")
  color: string;            // CSS variable o valor literal
  icon: string;             // Nombre del ícono de lucide-react
  requiresConfirmation: boolean;  // true solo si operationalMode === 'real'
}
```

**Valores por modo**:

| runtimeMode | operationalMode | label | color | icon | requiresConfirmation |
|-------------|-----------------|-------|-------|------|----------------------|
| online | demo | ONLINE · DEMO | `var(--color-accent)` | `Zap` | false |
| online | real | ONLINE · REAL | `#ec7e00` (warning) | `AlertTriangle` | true |
| offline | demo | OFFLINE · DEMO | `var(--color-text-muted)` | `WifiOff` | false |
| offline | real | OFFLINE · REAL | `#ec7e00` | `AlertTriangle` | true |

---

### 6. AnimatedValueConfig

Configuración del hook `useAnimatedValue` para contadores de números.

```typescript
interface AnimatedValueConfig {
  target: number;
  duration?: number;    // ms; default: var(--duration-normal) = 220ms
  decimals?: number;    // cifras decimales en el render; default: 2
  easing?: (t: number) => number;  // función de easing; default: easeOutCubic
}

// Hook signature
function useAnimatedValue(config: AnimatedValueConfig): number;
```

**Reglas de validación**:
- Si `prefers-reduced-motion` está activo, el hook retorna `target` inmediatamente sin animar.
- El hook cancela el `requestAnimationFrame` anterior cuando `target` cambia antes de completar la animación.
- Solo anima diferencias > 0.001 para evitar micro-oscilaciones.

---

## Relaciones entre Entidades

```
RevolutTokenSet
    └── consumido por todos los componentes vía CSS variables

WatchlistItem ──── enriquecida por ──→ MarketQuote
    └── renderizada en WatchlistTree
    └── price/change renderizados vía useAnimatedValue

DrawerState
    └── manejado en DashboardLayout
    └── controla WatchlistDrawer (tablet) y EvidenceDrawer

RuntimeBadgeConfig
    └── derivado de SignalStoreState.runtimeMode + .operationalMode
    └── renderizado en NavBar
    └── requiresConfirmation → dispara Modal de confirmación

AnimatedValueConfig
    └── useAnimatedValue hook
    └── usado en WatchlistItem (price, changePercent) y SignalOverlay (score)
```
