# Plan de Implementación: Rediseño del Dashboard Principal (Revolut Design System)

**Branch**: `004-redesign-ui-ux` | **Fecha**: 2026-05-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification desde `specs/004-revolut-dashboard-redesign/spec.md`

---

## Summary

Rediseño visual completo del dashboard principal de la PWA de inversiones aplicando el Revolut Design System: sustitución del sistema de CSS variables existente por tokens Revolut (cobalt-violet, Inter, border-radius pill/lg/md, canvas negro puro), restyling de todos los componentes de `features/dashboard/`, nuevo sistema de layout responsivo con drawer para tablet, micro-animaciones CSS + hook de contador animado, y extensión del WatchlistTree con precio y % de cambio en tiempo real vía nuevo endpoint REST. No se modifica lógica de negocio, APIs existentes ni el modelo de datos del orquestador.

---

## Technical Context

**Language/Version**: TypeScript 5.6 / React 18.3
**Primary Dependencies**: Vite 5.4, lightweight-charts 5.2 (chart), lucide-react 1.16 (íconos)
**Nuevas dependencias**: Ninguna (animaciones con CSS + rAF; Inter via Google Fonts CDN)
**Storage**: N/A (UI-only; localStorage para runtime mode ya existe en `useSignalStore`)
**Testing**: Vitest 4.1 + @testing-library/react 16.3 + happy-dom
**Target Platform**: PWA web — desktop ≥1024px (primary); tablet 768–1023px (secondary)
**Performance Goals**: 60fps en animaciones; render inicial del dashboard <2s; polling de cotizaciones cada 30s
**Constraints**: sin mobile <768px; sin cambios a lógica de negocio/APIs existentes; tests existentes pasan sin modificación; `prefers-reduced-motion` respetado; `prefers-color-scheme` sin toggle manual
**Scale/Scope**: ~15 componentes a restylear; 5 nuevos componentes UI primitivos; 1 nuevo layout; 1 nuevo hook; 1 nuevo endpoint REST (lado API)

---

## Constitution Check

*GATE: Evaluado pre-Phase 0 y post-Phase 1.*

| Gate Constitucional | Estado | Evidencia / Justificación |
|--------------------|--------|---------------------------|
| Idioma oficial español | ✅ PASA | Todos los artefactos generados en español |
| Stack PWA: Vite + React + TypeScript | ✅ PASA | Confirmado en `projects/pwa/inversions_app/package.json` |
| Arquitectura modular por features | ✅ PASA | Restyling dentro de `features/dashboard/`; nuevos primitivos en `components/ui/`; nuevo layout en `layouts/` |
| FIC bilingual comments (ES + EN) | ✅ PASA | Todos los archivos nuevos y modificados incluirán comentarios `// FIC:` EN/ES |
| Modelo semi-automático (sin auto-trading) | ✅ PASA | Feature es exclusivamente visual/UX |
| Control humano obligatorio | ✅ PASA | Modal de confirmación para cambio a modo Real (mejora sobre `window.confirm` actual) |
| Testing obligatorio | ✅ PASA | Suite de tests existente sin regresiones; nuevos componentes tienen tests unitarios |
| Observabilidad/logging | ✅ PASA | Sin cambios en logging; errores de cotización se loguean en consola |
| Seguridad de credenciales | ✅ PASA | Sin cambios en flujos de autenticación |
| Separación PWA / REST API | ✅ PASA | Solo se modifica la PWA; el nuevo endpoint REST es una adición aislada |
| Spec-Driven Development | ✅ PASA | Siguiendo el flujo SDD: spec → clarify → plan → tasks → implement |

**Resultado Phase 0**: Sin violaciones. Procede a Phase 1.

---

## UX Architecture & Control Strategy

- **Target Experience**: Revolut financial cockpit — canvas negro puro (#000000), cobalt-violet (#494fdf) como acento único y escaso, tipografía Inter bold para valores numéricos, tarjetas `border-radius: 20px` sin drop-shadows (contraste de superficie como elevación)

- **Critical Controls**:

  | Control | Tipo | Estado activo | Estado inactivo |
  |---------|------|---------------|-----------------|
  | Watchlist sidebar | Panel fijo (desktop) / Drawer overlay (tablet) | visible / drawer abierto | oculto (tablet) |
  | Timeframe | PillGroup (`border-radius: 999px`) | fondo `--color-accent`, texto blanco | fondo `--color-surface-raised`, texto muted |
  | Cores activos | Toggle chips | borde + fondo sutil cobalt-violet | borde + fondo `--color-surface-raised` |
  | Modo runtime | Badge en nav bar | Demo: índigo · Real: naranja con ícono | — |
  | Panel evidencia | Drawer derecho overlay | slide-in visible | oculto |
  | SuperChart | Card wrapper únicamente | fondo `--color-surface` | — |

- **State Strategy**:
  - Theming: CSS `prefers-color-scheme` puro — sin estado React
  - Drawers: `useState<boolean>` local en `DashboardLayout`
  - Modo runtime: `useSignalStore` existente (sin cambios)
  - Cotizaciones watchlist: `useWatchlistPrices` hook con polling, estado local en el hook
  - Contadores animados: `useAnimatedValue` hook por instancia de valor

- **Performance Boundaries**:
  - Animaciones: solo `transform` y `opacity` (compositor layer, cero layout/paint triggers)
  - Contador `rAF`: cancela frame anterior al cambiar target; pausa si `prefers-reduced-motion`
  - Polling cotizaciones: pausa cuando `document.visibilityState === 'hidden'`
  - SuperChart: sin cambios internos (lightweight-charts gestiona su propio render)

---

## Data Source Routing & Runtime Modes

- **Modificaciones de routing**: Ninguna — este feature no altera el routing de datos del orquestador
- **Nuevo endpoint requerido**: `GET /api/market/quotes?symbols=...` (ver `contracts/market-quotes-api.md`)
  - Requiere implementación en `projects/rest-api/`
  - Ruteado al broker activo en modo real; datos de referencia en modo demo; 503 en modo offline
- **Modo runtime** (sin cambio funcional, mejora visual):
  - `online + demo` → Badge cobalt-violet en nav bar
  - `online + real` → Badge naranja (#ec7e00) + ícono `AlertTriangle` + modal de confirmación al activar
  - `offline + *` → Badge gris + controles de refresh deshabilitados visualmente
- **Credential/Account Strategy**: Sin cambios — `useSignalStore` (runtime/operational mode) se mantiene

---

## Dynamic Schema Governance

- **Token Registry**: `src/styles/tokens.css` — fuente única de verdad de CSS custom properties. Cambiar un token aquí se propaga a todos los componentes automáticamente.
- **Evolvability Rule**: Ningún componente hardcodea valores de color/radius/timing. Toda actualización futura del design system requiere solo editar `tokens.css`.
- **Theming**: Variables dark declaradas en `:root`; variables light sobreescritas en `@media (prefers-color-scheme: light) { :root {} }`. Sin JavaScript ni localStorage para theming.
- **Reduced Motion**: Variables `--duration-*` se establecen en `0ms` en `@media (prefers-reduced-motion: reduce)`, deshabilitando todas las animaciones automáticamente.

---

## Project Structure

### Documentación (esta feature)

```text
specs/004-revolut-dashboard-redesign/
├── spec.md                         ← Especificación funcional (clarificada)
├── plan.md                         ← Este archivo
├── research.md                     ← Decisiones técnicas (Phase 0)
├── data-model.md                   ← Entidades y tipos TypeScript (Phase 1)
├── quickstart.md                   ← Guía de arranque rápido (Phase 1)
├── DESIGN.md                       ← Tokens Revolut (output de getdesign, referencia)
├── contracts/
│   ├── css-token-contract.md       ← Inventario de CSS custom properties
│   ├── market-quotes-api.md        ← Contrato del nuevo endpoint REST
│   └── ui-component-interfaces.md ← Props de componentes UI nuevos
└── tasks.md                        ← Generado por /speckit-tasks (pendiente)
```

### Código fuente — Cambios en la PWA

```text
projects/pwa/inversions_app/
├── index.html                              MODIFICAR — agregar Google Fonts (Inter)
└── src/
    ├── styles/
    │   ├── tokens.css                      NUEVO — CSS variables Revolut (dark+light+reduced-motion)
    │   └── animations.css                  NUEVO — @keyframes drawer, skeleton, transitions
    ├── hooks/
    │   └── useAnimatedValue.ts             NUEVO — hook contador animado con rAF
    ├── components/
    │   └── ui/
    │       ├── Badge.tsx                   NUEVO — badge modo runtime
    │       ├── Drawer.tsx                  NUEVO — drawer overlay genérico
    │       ├── Modal.tsx                   NUEVO — modal de confirmación
    │       ├── SkeletonCard.tsx            NUEVO — skeleton loader Revolut-style
    │       └── PillGroup.tsx               NUEVO — pill group segmentado
    ├── layouts/
    │   └── DashboardLayout.tsx             NUEVO — layout responsivo 2-col/1-col
    ├── services/
    │   └── signals/
    │       └── marketApi.ts                NUEVO — getMarketQuotes() + useWatchlistPrices hook
    └── features/
        └── dashboard/
            ├── MainDashboard.tsx           MODIFICAR — integra DashboardLayout, nuevo NavBar
            ├── WatchlistTree.tsx           MODIFICAR — Tailwind→CSS vars, precio/% cambio
            ├── RuntimeModeSwitches.tsx     MODIFICAR — Tailwind→CSS vars, Badge, Modal confirmación
            ├── CoreSelector.tsx            MODIFICAR — restyling toggle chips Revolut
            ├── TimeControls.tsx            MODIFICAR — integra PillGroup timeframe
            ├── ConfluenceSignalsTable.tsx  MODIFICAR — aplica tokens Revolut
            ├── SignalOverlay.tsx           MODIFICAR — tarjetas señal con tokens + animated score
            ├── ExplainabilityTable.tsx     MODIFICAR — aplica tokens
            └── simulation/
                └── SimulationControlPanel.tsx  MODIFICAR — aplica tokens
```

### Código fuente — Cambios en la REST API

```text
projects/rest-api/
└── src/
    └── routes/
        └── market/
            └── quotes.ts               NUEVO — GET /api/market/quotes
```

---

## Complexity Tracking

> Sin violaciones constitucionales que justificar.

| Ítem | Estado |
|------|--------|
| Complejidad de animaciones | Controlada — CSS puro + 1 hook; sin librería externa |
| Bug preexistente (Tailwind sin instalar) | Resuelto como efecto colateral del restyling |
| Nuevo endpoint REST | Acotado — 1 route handler; sin cambio de modelo de datos |
