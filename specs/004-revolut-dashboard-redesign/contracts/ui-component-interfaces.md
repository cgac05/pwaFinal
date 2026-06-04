# Contrato: Interfaces de Componentes UI Nuevos

**Versión**: 1.0 | **Fecha**: 2026-05-28

## Propósito

Define las props públicas de los nuevos componentes reutilizables (`components/ui/`) para garantizar que su integración en los componentes de feature sea predecible y testeable.

---

## Drawer

Componente base para drawers overlay (Watchlist tablet + Panel de evidencia).

```typescript
// src/components/ui/Drawer.tsx

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  position?: 'left' | 'right';  // default: 'right'
  width?: string;                // default: var(--drawer-width) = 320px
  title?: string;
  children: React.ReactNode;
  'data-testid'?: string;
}
```

**Comportamiento**:
- Slide-in desde `position` al abrir; slide-out al cerrar.
- Backdrop semitransparente que cubre el resto de la pantalla.
- Cierre con clic en backdrop, tecla ESC, o llamada a `onClose`.
- Cuando `isOpen = true`: `overflow: hidden` en `document.body` para prevenir scroll del fondo.
- Al cerrar: restaura el foco al elemento que disparó la apertura (`aria-modal` pattern).
- Animaciones solo en `@media (prefers-reduced-motion: no-preference)`.

**Accesibilidad**:
- `role="dialog"`, `aria-modal="true"`, `aria-label` del `title`.
- Focus trap mientras el drawer está abierto.
- Primer elemento focusable recibe foco al abrirse.

---

## Modal

Componente para confirmación de cambio de modo Real.

```typescript
// src/components/ui/Modal.tsx

interface ModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel?: string;   // default: 'Confirmar'
  cancelLabel?: string;    // default: 'Cancelar'
  variant?: 'danger' | 'warning' | 'default';  // default: 'default'
  'data-testid'?: string;
}
```

**Comportamiento**:
- Aparece centrado sobre el contenido con backdrop.
- `variant: 'warning'` usa `--color-warning` para el botón de confirmación.
- El botón de cancelar siempre tiene estilos neutros.
- Cierre con ESC llama `onCancel`.
- No se cierra con clic en backdrop (confirmación explícita requerida).

---

## Badge

Badge de modo runtime en la nav bar.

```typescript
// src/components/ui/Badge.tsx

interface BadgeProps {
  label: string;
  color: string;       // CSS color value o variable
  icon?: React.ReactNode;
  size?: 'sm' | 'md';  // default: 'sm'
  pulse?: boolean;     // animación pulsante para estados activos críticos
}
```

---

## PillGroup

Selector segmentado para timeframe (tipo Revolut sub-nav-pill).

```typescript
// src/components/ui/PillGroup.tsx

interface PillOption<T extends string = string> {
  value: T;
  label: string;
}

interface PillGroupProps<T extends string = string> {
  options: PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  'aria-label'?: string;
}
```

**Comportamiento**:
- La opción activa tiene fondo `--color-accent` con texto blanco.
- Las opciones inactivas tienen fondo `--color-surface-raised` con texto `--color-text-muted`.
- Transición de color en `--duration-fast` al cambiar.
- Todos los botones tienen `role="radio"` dentro de un `role="radiogroup"`.

---

## SkeletonCard

Placeholder de carga que replica la forma de una card.

```typescript
// src/components/ui/SkeletonCard.tsx

interface SkeletonCardProps {
  height?: string | number;  // default: 110px
  lines?: number;            // filas de texto simuladas; default: 3
  className?: string;
}
```

**Comportamiento**:
- Pulso CSS de `--color-surface-raised` → `--color-surface` → `--color-surface-raised`.
- Animación solo en `@media (prefers-reduced-motion: no-preference)`.
- En `reduce`: fondo estático sin animación.

---

## useAnimatedValue

Hook para animar valores numéricos con contador.

```typescript
// src/hooks/useAnimatedValue.ts

interface UseAnimatedValueOptions {
  duration?: number;   // ms; default: 220 (--duration-normal)
  decimals?: number;   // default: 2
}

function useAnimatedValue(
  target: number,
  options?: UseAnimatedValueOptions
): number;
```

**Comportamiento**:
- Usa `requestAnimationFrame` con easing `easeOutCubic`.
- Cuando `prefers-reduced-motion: reduce`, retorna `target` sin animar.
- Cuando `target` cambia antes de terminar la animación previa, la cancela y comienza desde el valor actual interpolado.
- Solo inicia animación si `|target - currentValue| > 0.001`.

---

## DashboardLayout

Componente de layout responsivo principal.

```typescript
// src/layouts/DashboardLayout.tsx

interface DashboardLayoutProps {
  sidebar: React.ReactNode;       // WatchlistTree (visible en desktop)
  nav: React.ReactNode;           // NavBar
  main: React.ReactNode;          // Contenido central
  drawerOpen?: boolean;           // Controla el drawer del sidebar en tablet
  onDrawerClose?: () => void;
}
```

**Comportamiento**:
- Desktop (≥1024px): grid de 2 columnas — `--sidebar-width` + `1fr`.
- Tablet (768–1023px): columna única `1fr`; sidebar se oculta; `drawerOpen` lo muestra como overlay.
- El botón para abrir el drawer en tablet está en el `nav` (responsabilidad del llamador).
