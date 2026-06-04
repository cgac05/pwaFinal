# Quickstart: Rediseño Dashboard Principal (Revolut Design System)

**Branch**: `004-redesign-ui-ux` | **Fecha**: 2026-05-28

## Prerrequisitos

```bash
# Verificar que estás en la rama correcta
git rev-parse --abbrev-ref HEAD
# Esperado: 004-redesign-ui-ux

# Instalar dependencias de la PWA
cd projects/pwa/inversions_app
npm install
```

## Paso 1 — Obtener el Design System de Revolut

```bash
# Desde la raíz del proyecto
npx getdesign@latest add revolut --out specs/004-revolut-dashboard-redesign/DESIGN.md

# El archivo generado es la referencia canónica de tokens.
# NO se usa directamente en el código — ver contracts/css-token-contract.md
# para el mapeo a CSS custom properties.
```

## Paso 2 — Revisar artefactos del plan

```
specs/004-revolut-dashboard-redesign/
├── spec.md                              ← Especificación funcional
├── plan.md                              ← Este plan (contexto técnico completo)
├── research.md                          ← Decisiones técnicas y hallazgos
├── data-model.md                        ← Entidades y tipos TypeScript
├── contracts/
│   ├── css-token-contract.md            ← Inventario de CSS variables Revolut
│   ├── market-quotes-api.md             ← Nuevo endpoint REST requerido
│   └── ui-component-interfaces.md      ← Props de componentes nuevos
└── tasks.md                             ← Generado por /speckit-tasks (pendiente)
```

## Paso 3 — Levantar el servidor de desarrollo

```bash
cd projects/pwa/inversions_app
npm run dev
# Servidor en http://localhost:5173
```

## Paso 4 — Ejecutar tests existentes (baseline)

```bash
cd projects/pwa/inversions_app
npm run test
# Todos deben pasar ANTES de comenzar el rediseño.
# Si alguno falla, resolver antes de iniciar implementación.
```

## Orden de implementación recomendado

Seguir el orden de `tasks.md` (generado por `/speckit-tasks`). A grandes rasgos:

1. **`src/styles/tokens.css`** — Crear el token registry Revolut (dark + light + reduced-motion).
   Verificar: cambiar `prefers-color-scheme` en DevTools y ver que los colores cambian.

2. **`index.html`** — Agregar Google Fonts (Inter 400/600/700).

3. **`src/hooks/useAnimatedValue.ts`** — Implementar hook de contador animado.

4. **`src/components/ui/`** — Implementar en orden: `SkeletonCard`, `Badge`, `PillGroup`, `Modal`, `Drawer`.

5. **`src/layouts/DashboardLayout.tsx`** — Layout responsivo con grid 2 columnas / 1 columna.

6. **`src/features/dashboard/`** — Restylear en orden de impacto visual:
   - `MainDashboard.tsx` (estructura principal)
   - `WatchlistTree.tsx` (Tailwind → CSS vars + precio/% cambio)
   - `RuntimeModeSwitches.tsx` (Tailwind → CSS vars + Badge + Modal)
   - `CoreSelector.tsx` (toggle chips Revolut)
   - `TimeControls.tsx` (PillGroup para timeframe)
   - `SignalOverlay.tsx` (tarjetas de señal)
   - `ConfluenceSignalsTable.tsx` (data table tokens)
   - `ExplainabilityTable.tsx` (tokens)
   - `SimulationControlPanel.tsx` (tokens)

7. **Nuevo servicio** — `src/services/signals/marketApi.ts` + `useWatchlistPrices` hook.

8. **REST API** — `GET /api/market/quotes` (separado; ver `contracts/market-quotes-api.md`).

## Verificación rápida por componente

| Componente | Verificación visual |
|-----------|---------------------|
| tokens.css | DevTools → inspector muestra `--color-bg: #000000` |
| DashboardLayout | A 1024px: sidebar visible. A 900px: sidebar oculto, botón hamburger presente |
| WatchlistTree | Cada fila muestra ticker + precio + % en verde/rojo |
| RuntimeModeSwitches | Badge en nav bar, no barra separada. Cambio a Real muestra modal |
| CoreSelector | Chips con borde cobalt-violet cuando activos |
| TimeControls | Pill group horizontal, opción activa en cobalt-violet |
| Drawer | Slide-in 350ms desde derecha; ESC cierra; backdrop oscuro |
| prefers-color-scheme | DevTools → Rendering → Emulate `prefers-color-scheme` → cambio instantáneo |
| prefers-reduced-motion | DevTools → Rendering → Emulate → animaciones desaparecen |

## Variables de entorno relevantes

```bash
# No hay cambios en variables de entorno para este feature.
# La PWA usa las mismas variables de conexión al REST API.
VITE_API_BASE_URL=http://localhost:3001  # URL del REST API local
```
