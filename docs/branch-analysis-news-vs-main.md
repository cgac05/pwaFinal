# Análisis de Ramas: `feature/news-integration` vs `main`

> Generado: 2026-05-31  
> Contexto: watchlist y tabla de confluencia funcionan en feature pero están rotos en main. 

---

## 1. Topología de ramas

```
main  ──────────────────────────────────────────────────────► HEAD
       │                                                         │
       │ ← Calendar/Diagonal Spread, Wheel, FundamentalPanel,   │
       │    TechnicalAnalysisExtended, auditoría, Yahoo fix...   │
       │                                                         │
   [punto de bifurcación — commit antiguo]                       │
       │                                                         │
feature/news-integration ──────────────────────────────────────►
       (8 commits: módulo de noticias + spreads encima del fork)
```

- **main** tiene ~30 commits por delante del punto de bifurcación.
- **feature/news-integration** tiene 8 commits únicos de integración de noticias.
- Ambas ramas **modificaron los mismos archivos** desde ese punto: `signals.ts`, `MainDashboard.tsx`, `ConfluenceSignalsTable.tsx`, `confluenceTableApi.ts`, `SimulatorStrategySection.tsx`.

---

## 2. ¿Por qué el Watchlist está "roto" en main?

`WatchlistView.tsx` es **IDÉNTICO** en ambas ramas — el componente en sí no tiene bugs.

El problema es estructural:

- `WatchlistView` vive dentro de `LeftPanel`, que es renderizado por `MainDashboard`.
- En `main`, `MainDashboard` tiene más estado complejo: `optionStrategyAnalysis`, `fundamentalAnalysis`, `termResult`, `wheelSummary`, `selectedStrikeData`.
- El `useEffect` de reset en `main` es **más agresivo** — limpia `selectedStrike`, `wheelSummary`, `termResult`, `selectedStrikeData` y llama a `setSelectedStrike(undefined)` en el store cada vez que cambia el símbolo seleccionado.
- Si cualquier componente hijo de `MainDashboard` lanza un error de renderizado (React no tiene error boundary), **toda la página se rompe**, incluyendo el panel lateral con el watchlist.

La única diferencia real en el test de WatchlistView es trivial (`global.fetch` vs `globalThis.fetch`) y no afecta runtime.

---

## 3. ¿Por qué la Tabla de Confluencia está "rota" en main?

### 3.1 Lógica eliminada en feature pero activa en main

En `main`, `ConfluenceSignalsTable.tsx` contiene lógica que **feature eliminó completamente**:

```typescript
// Solo existe en main — feature la eliminó:
function buildFundamentalRow(data: FundamentalAnalysisResponse, timeframe: string): ConfluenceSignalRow
function buildChatContext(row, resumen, activeStrategy): string
function explainScore(row): string
function explainTrend(row): string
function buildLocalChatExplanation(row, resumen): string
function formatMetrics(row): string
function clampScore(value: number): number
```

- `MainDashboard` en main pasa `fundamentalAnalysis={fundamentalAnalysis}` al componente.
- Cuando `FundamentalAnalysisPanel` aún no ha corrido (estado `null`), el `useMemo` puede construir filas con `buildFundamentalRow`. Si los datos tienen un shape inesperado, el modal `observationRow` falla al renderizarse.
- En `feature`, toda esa lógica fue eliminada. La tabla solo muestra lo que llega de la API, sin transformaciones locales.

### 3.2 Nombres de estrategias incompatibles

| main | feature/news-integration |
|------|--------------------------|
| `LONG_CALL` | `BUY_CALL` |
| `LONG_PUT` | `BUY_PUT` |
| `SHORT_CALL` | `SELL_CALL` |
| `SHORT_PUT` | `SELL_PUT` |
| _(ausente)_ | `BULL_PUT_SPREAD` |
| _(ausente)_ | `BEAR_CALL_SPREAD` |

### 3.3 Origen de `buildCanonicalOutputString` / `buildSignalContextMD`

| Rama | Origen de las funciones |
|------|------------------------|
| main | Re-exportadas desde `@inversions/utils` |
| feature | Definidas inline en `confluenceTableApi.ts` |

En main el paquete `@inversions/utils` exporta correctamente estas funciones — no hay problema de compilación en producción.

---

## 4. Errores de TypeScript detectados en main

```
src/store/appShell.test.ts(17,23): error TS2304: Cannot find name 'global'.
src/store/appShell.test.ts(30,27): error TS2551: Property 'chatPanelCollapsed' does not exist ...
src/store/appShell.test.ts(53,32): error TS2551: Property 'toggleChatPanel' does not exist ...
src/store/appShell.test.ts(91,27): error TS2551: Property 'chatPanelCollapsed' does not exist ...
```

**Impacto**: Solo afectan archivos de test. No afectan el bundle de producción ni el servidor de desarrollo. Son residuos de una feature de chat panel que aún no se integró al store.

---

## 5. Qué tiene main que feature NO tiene (no perder)

| Feature | Archivo clave |
|---------|--------------|
| Calendar Spread y Diagonal Spread | `simulation/TermStrategyModal.tsx` |
| Wheel Strategy | `simulation/WheelParamsModal.tsx` |
| `FundamentalAnalysisPanel` completo | `dashboard/FundamentalAnalysisPanel.tsx` |
| `TechnicalAnalysisExtendedSection` | `dashboard/TechnicalAnalysisExtendedSection.tsx` |
| `OptionStrategyParamsModal` (`LONG_CALL` etc.) | `simulation/OptionStrategyParamsModal.tsx` |
| Fix rate-limiting Yahoo Finance | `rest-api/src/routes/market/quotes.ts` |
| Módulos de auditoría | `modules/audit/auditedStrategyComparator.ts` |
| `SelectedOptionsStrategy` + `OptionsStrategyParams` en store | `store/signals.ts` |
| Campos extendidos en `SelectedStrike` | `store/signals.ts` |

---

## 6. Qué tiene feature que main NO tiene (traer)

| Feature | Archivos nuevos |
|---------|----------------|
| Módulo de noticias (frontend) | `features/news/*.tsx`, `services/news/newsApi.ts` |
| `NewsSection` en dashboard | `dashboard/NewsSection.tsx` |
| `MultiSymbolCharts` | `dashboard/MultiSymbolCharts.tsx` |
| `SpreadParamsModal` | `simulation/SpreadParamsModal.tsx` |
| `NewsDetailModal` en confluencia | integrado en `ConfluenceSignalsTable.tsx` |
| `FundamentalCopilotPanel` mejorado | `ai/FundamentalCopilotPanel.tsx` |
| `FundamentalAnalysisModal` | `simulation/FundamentalAnalysisModal.tsx` |
| Rutas de noticias (backend) | `routes/news/index.ts`, `sentiment.ts`, `urlAnalysis.ts` |
| Servicios de noticias (backend) | `modules/news/*.ts` |
| Servicio de notificaciones | `services/notificationService.ts` |
| Tests de integración y unitarios nuevos | `tests/integration/news/`, `tests/unit/news/` |

---

## 7. Recomendación: estrategia de integración

### NO recomendado

```bash
# PELIGROSO — perderías Calendar, Wheel, FundamentalPanel y todo lo de main
git checkout main
git reset --hard feature/news-integration
```

```bash
# ARRIESGADO — conflictos masivos en 10+ archivos compartidos sin contexto claro
git checkout feature/news-integration
git rebase main
```

---

### RECOMENDADO: Merge con resolución controlada

```bash
# Paso 1: rama de integración segura desde main
git checkout main
git checkout -b integration/news-into-main

# Paso 2: iniciar merge
git merge feature/news-integration --no-ff -m "feat: integrate news module into main"

# Paso 3: al aparecer conflictos, resolverlos con estas reglas:
```

#### Reglas de resolución por archivo

| Archivo | Estrategia |
|---------|-----------|
| `store/signals.ts` | **Mantener main** — tiene `SelectedOptionsStrategy`, `OptionsStrategyParams` y campos extendidos de `SelectedStrike` que feature eliminó. |
| `MainDashboard.tsx` | **Base main** + agregar de feature: `NewsSection`, `newsDateRange`, `handleSpreadConfirmed`, `spreadRequest`. |
| `ConfluenceSignalsTable.tsx` | **Base main** + agregar de feature: `NewsDetailModal` para filas `A_NOTICIAS`, `showNewsModal`, `newsArticle`. Mantener el modal `observationRow` de main. |
| `confluenceTableApi.ts` | **Mantener main** (re-exporta `@inversions/utils`) + agregar de feature: `BULL_PUT_SPREAD`, `BEAR_CALL_SPREAD`, `BUY_CALL`, `BUY_PUT`, `SELL_CALL`, `SELL_PUT` a `CANONICAL_ESTRATEGIAS`. |
| `SimulatorStrategySection.tsx` | **Base main** (mantiene `LONG_CALL` etc.) + agregar de feature: lógica de `SpreadParamsModal` para spreads nuevos. |
| `package.json` | **Mergear ambos** — cada rama puede tener dependencias nuevas. |

```bash
# Paso 4: aceptar archivos nuevos de feature que no existen en main (sin conflictos)
git checkout feature/news-integration -- \
  projects/pwa/inversions_app/src/features/news/ \
  projects/pwa/inversions_app/src/services/news/newsApi.ts \
  projects/pwa/inversions_app/src/features/dashboard/NewsSection.tsx \
  projects/pwa/inversions_app/src/features/dashboard/MultiSymbolCharts.tsx \
  projects/pwa/inversions_app/src/features/dashboard/simulation/SpreadParamsModal.tsx \
  projects/rest-api/inversions_api/src/modules/news/ \
  projects/rest-api/inversions_api/src/routes/news/ \
  projects/rest-api/inversions_api/src/services/notificationService.ts

# Paso 5: verificar que TypeScript compile sin errores en código fuente
cd projects/pwa/inversions_app && npx tsc --noEmit
cd projects/rest-api/inversions_api && npx tsc --noEmit

# Paso 6: correr tests
cd projects/pwa/inversions_app && npx vitest run
cd projects/rest-api/inversions_api && npx vitest run

# Paso 7: si todo pasa, crear PR hacia main
git push origin integration/news-into-main
```

---

## 8. Fix rápido para bugs actuales en main (sin merge)

Si el objetivo inmediato es solo estabilizar main antes de integrar feature:

### Bug 1: `ConfluenceSignalsTable` — modal `observationRow` inestable

El modal se abre cuando `row.core === "A_FUNDAMENTAL"` y usa `buildFundamentalRow` que depende de `fundamentalAnalysis` prop. Agregar un guard defensivo:

```typescript
// En main — ConfluenceSignalsTable.tsx, dentro del modal observationRow
{observationRow && observationRow.observacion && (() => {
  // ... resto del modal
})()}
```

### Bug 2: `appShell.test.ts` — errores de TypeScript en tests

```bash
# Actualizar el test para que use las propiedades correctas del store actual
# o eliminar los tests obsoletos de chatPanel
```

### Bug 3: Reset agresivo de estado en `MainDashboard`

En main, el `useEffect` de reset llama `setSelectedStrike(undefined)` lo cual puede desencadenar re-renders en cadena. Considera remover `setSelectedStrike` del reset o envolverlo en una condición:

```typescript
// Solo limpiar selectedStrike si el símbolo cambió a uno diferente (no a null)
if (selectedSymbol) {
  setSelectedStrikeData(null);
  setSelectedStrike(undefined);
}
```

---

## 9. Resumen ejecutivo

| Pregunta | Respuesta |
|----------|-----------|
| ¿Watchlist roto en main? | No es el componente — es un crash en cadena desde `MainDashboard`. |
| ¿Confluencia rota en main? | Lógica de fundamental analysis integrada en el componente puede fallar con datos null/inesperados. |
| ¿Merge normal? | Sí, pero con resolución cuidadosa. Main es la base, feature aporta news. |
| ¿Rebase? | No recomendado — demasiados conflictos en archivos compartidos. |
| ¿Forzar main = feature? | No — perderías Calendar, Wheel, FundamentalPanel y más. |
| ¿Camino correcto? | Rama `integration/news-into-main` desde main, merge con reglas de resolución. |
