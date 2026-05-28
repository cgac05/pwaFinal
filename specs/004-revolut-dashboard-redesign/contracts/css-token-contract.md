# Contrato: CSS Token Registry (Revolut Design System)

**Versión**: 1.0 | **Fecha**: 2026-05-28

## Propósito

Define el inventario canónico de CSS custom properties que implementan el Revolut Design System en la PWA. Este contrato es la fuente de verdad para todos los componentes — ningún valor de color, spacing, radius o timing debe hardcodearse fuera de este archivo.

## Archivo fuente

`projects/pwa/inversions_app/src/styles/tokens.css`

## Estructura

```css
/* ────────────────────────────────────────
   REVOLUT DESIGN SYSTEM — Token Registry
   Modo: dark (default) + light (override)
   ──────────────────────────────────────── */

:root {
  /* Color — Canvas */
  --color-bg: #000000;
  --color-surface: #0a0a0a;
  --color-surface-raised: #16181a;

  /* Color — Bordes */
  --color-border: rgba(255, 255, 255, 0.12);
  --color-border-subtle: rgba(255, 255, 255, 0.06);

  /* Color — Texto */
  --color-text: #ffffff;
  --color-text-muted: rgba(255, 255, 255, 0.72);

  /* Color — Acento (cobalt-violet, única marca Revolut) */
  --color-accent: #494fdf;
  --color-accent-hover: #4f55f1;
  --color-accent-subtle: rgba(73, 79, 223, 0.12);

  /* Color — Estados financieros */
  --color-buy: #00a87e;
  --color-sell: #e23b4a;
  --color-hold: #b09000;

  /* Color — Modo real (warning) */
  --color-warning: #ec7e00;
  --color-warning-subtle: rgba(236, 126, 0, 0.12);

  /* Forma — Border radius */
  --radius-pill: 999px;
  --radius-lg: 20px;
  --radius-md: 12px;
  --radius-sm: 8px;
  --radius-xs: 4px;

  /* Elevación */
  --shadow-card: none;  /* Revolut no usa drop-shadows; elevación por contraste */

  /* Tipografía */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-weight-body: 400;
  --font-weight-emphasis: 600;
  --font-weight-bold: 700;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.5rem;

  /* Espaciado */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;

  /* Animaciones */
  --duration-fast: 120ms;
  --duration-normal: 220ms;
  --duration-slow: 350ms;
  --easing-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --easing-decelerate: cubic-bezier(0, 0, 0.2, 1);

  /* Layout */
  --nav-height: 64px;
  --sidebar-width: 280px;
  --drawer-width: 320px;
}

@media (prefers-color-scheme: light) {
  :root {
    --color-bg: #ffffff;
    --color-surface: #f4f4f4;
    --color-surface-raised: #ffffff;
    --color-border: #e2e2e7;
    --color-border-subtle: rgba(0, 0, 0, 0.06);
    --color-text: #191c1f;
    --color-text-muted: #505a63;
    --color-accent: #494fdf;
    --color-accent-hover: #3a40c4;
    --color-accent-subtle: rgba(73, 79, 223, 0.08);
    --shadow-card: 0 1px 4px rgba(0, 0, 0, 0.08);
  }
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 0ms;
    --duration-normal: 0ms;
    --duration-slow: 0ms;
  }
}
```

## Reglas de uso

1. **Solo referencias** — nunca `color: #000000`; siempre `color: var(--color-text)`.
2. **Sin sombras de caja** — Revolut usa contrastes de superficie, no `box-shadow`. La excepción es `--shadow-card` que solo se activa en light mode.
3. **Acento escaso** — `--color-accent` debe aparecer máximo una vez por viewport como elemento dominante.
4. **Estados financieros** — `--color-buy` (teal) para valores positivos, `--color-sell` (danger) para negativos, `--color-hold` para neutros.
5. **Animaciones en `no-preference`** — toda `transition` o `animation` CSS debe estar dentro de `@media (prefers-reduced-motion: no-preference)` o reseteada en `reduce`.

## Cambios respecto al sistema anterior

| Variable antigua | Variable nueva | Cambio |
|-----------------|----------------|--------|
| `--color-bg: #0d1117` | `--color-bg: #000000` | Canvas negro puro Revolut |
| `--color-surface: #161b22` | `--color-surface: #0a0a0a` | Surface más oscura |
| `--color-accent: #388bfd` | `--color-accent: #494fdf` | Azul → Cobalt-violet |
| `--color-border: #30363d` | `--color-border: rgba(255,255,255,0.12)` | Sólido → semitransparente |
| `--radius-sm: 6px` | `--radius-sm: 8px` | Ajuste Revolut |
| `--radius-md: 10px` | `--radius-md: 12px` | Ajuste Revolut |
| `--radius-lg: 14px` | `--radius-lg: 20px` | Ajuste Revolut (cards) |
| `--shadow-card: 0 1px 3px...` | `--shadow-card: none` (dark) | Sin sombra en dark |
| *(no existía)* | `--radius-pill: 999px` | Nuevo para buttons/badges |
| *(no existía)* | `--color-accent-subtle` | Nuevo para fondos activos |
| *(no existía)* | `--duration-*`, `--easing-*` | Nuevas vars de animación |
