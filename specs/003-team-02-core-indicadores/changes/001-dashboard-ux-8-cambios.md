# Control de Cambios 001 — 8 mejoras funcionales Dashboard/Core (TEAM-02)

**Feature**: 003-team-02-core-indicadores
**Equipo**: TEAM-02 CocaDe6Lts
**Fecha**: 2026-05-31
**Tipo**: Mejora funcional sobre el core existente de señales/indicadores (frontend + backend)
**Estado**: Implementado
**Alcance**: Reutiliza el core ya entregado (`runner.ts`, `confluenceTable.ts`, `ohlcSource.ts`) sin reescribirlo. Cambios aditivos y retrocompatibles.

---

## Resumen

Se solicitaron 8 cambios funcionales. El punto 4 ya estaba implementado salvo un detalle cosmético (corregido). Los 7 restantes se implementaron nuevos. Todos los campos de request añadidos son **opcionales**, por lo que los contratos previos siguen siendo válidos.

| # | Cambio | Capa | Estado |
|---|--------|------|--------|
| 1 | Botón para limpiar la tabla de resultados/señales | Frontend | ✅ Nuevo |
| 2 | Indicadores técnicos inactivos por defecto en la UI | Frontend | ✅ Nuevo |
| 3 | Limpieza completa del panel de control | Frontend | ✅ Nuevo |
| 4 | Gráfica AAPL con datos reales (Yahoo) + fallback | Backend | ✅ Detalle corregido |
| 5 | Métricas de cuántas señales de compra/venta/total | Backend + Frontend | ✅ Nuevo |
| 6 | Señales clasificadas por CALL/PUT según fecha de solicitud | Backend | ✅ Confirmado + documentado |
| 7 | Multi-algoritmo: mostrar solo coincidencias | Backend | ✅ Nuevo |
| 8 | Datos históricos por fecha (backtest a un día del pasado) | Backend + Frontend | ✅ Nuevo |

---

## Detalle por cambio

### 1. Botón para limpiar la tabla de señales

- **Archivo**: `projects/pwa/inversions_app/src/features/dashboard/MainDashboard.tsx`
- **Qué**: Botón "Limpiar tabla" sobre la tabla de confluencia. Llama a `handleClearTable()`, que resetea `simulationRows`, `simulationVerdict`, `simulationMetrics` y el flag institucional, devolviendo la vista al estado vacío ("Selecciona un instrumento y ejecuta la simulación").
- **Antes**: la tabla solo se limpiaba sola al cambiar de ticker; no había acción manual.

### 2. Indicadores deshabilitados por defecto

- **Archivo**: `projects/pwa/inversions_app/src/features/dashboard/simulation/SimulationControlPanel.tsx`
- **Qué**: El estado `indicadoresOn` (RSI, MACD, EMA, ADX, BB) ahora inicia **todos en `false`**. El usuario los activa explícitamente. Los chips de "Cores de Análisis" no cambian (siguen activos por defecto).
- **Antes**: `indicadoresOn` se inicializaba todo en `true`.

### 3. Limpieza completa del panel de control

- **Archivos**:
  - `projects/pwa/inversions_app/src/features/dashboard/simulation/SimulationControlPanel.tsx` (botón "Limpiar panel" + `resetPanel()`)
  - `projects/pwa/inversions_app/src/features/dashboard/MainDashboard.tsx` (prop `onClear`)
- **Qué**: Botón "Limpiar panel" en el footer del panel. `resetPanel()` restablece preset (`3M`), fechas, temporalidad (`1h`), estrategia (`IRON_CONDOR`), tolerancia (`MEDIO`), cores (todos on), indicadores (todos off), fecha histórica (vacía) y errores; además invoca `onClear` para limpiar resultados previos en el dashboard.

### 4. Gráfica AAPL con datos reales (detalle corregido)

- **Archivo**: `projects/rest-api/inversions_api/src/routes/market-data/ohlc.ts`
- **Qué**: La ruta `/api/market-data/ohlc` ya servía datos reales de Yahoo Finance v8 con fallback a mock determinista. El backend devolvía `source: "yahoo_finance"` pero el front (`SuperChart.tsx`) espera `"yahoo"` para mostrar el badge. Se corrigió la etiqueta a `"yahoo"`.
- **Resultado**: el badge "Yahoo" ahora se muestra correctamente. Los datos ya eran reales; era solo cosmético.

### 5. Métricas de señales compra/venta/total

- **Archivos**:
  - `projects/rest-api/inversions_api/src/modules/indicators/types.ts` (interface `SignalMetrics`)
  - `projects/rest-api/inversions_api/src/modules/simulation/runner.ts` (`computeSignalMetrics`, campo `signalMetrics` en `SimulationRunResult`)
  - `projects/pwa/inversions_app/src/services/signals/confluenceTableApi.ts` (tipo `SignalMetrics` + `signalMetrics?` en `SimulationResponse`)
  - `projects/pwa/inversions_app/src/features/dashboard/MainDashboard.tsx` (chips `SignalMetricChip`)
- **Qué**: La simulación devuelve `signalMetrics: { buy, sell, hold, total }` (buy=CALL, sell=PUT). El dashboard muestra chips: "Compra (CALL)", "Venta (PUT)", "Hold", "Total generadas". Si el backend no envía métricas, el front las calcula del lado cliente como fallback.

### 6. Señales clasificadas por CALL/PUT según fecha de solicitud

- **Confirmación del typo**: "PULL" **es un typo de PUT**. El core nunca usó "PULL"; el tipo canónico es `TipoSenal = "CALL" | "PUT" | "HOLD"` (`types.ts`). CALL = sesgo de compra, PUT = sesgo de venta, HOLD = neutral.
- **Fecha de solicitud**: el request ya acepta `rangoEstrategia { from, to }`; con el cambio 8 (`fechaHistorica`) ahora el core puede además calcular la señal **a una fecha puntual del pasado**, clasificada por CALL/PUT/HOLD. No se requirió cambio de clasificación; quedó documentado y reforzado por el cambio 8.

### 7. Multi-algoritmo: mostrar solo coincidencias

- **Archivos**:
  - `projects/rest-api/inversions_api/src/modules/indicators/types.ts` (`soloCoincidencias?` en `SimulationRequest`)
  - `projects/rest-api/inversions_api/src/modules/simulation/runner.ts` (`applyCoincidenceFilter`)
  - `projects/pwa/inversions_app/src/features/dashboard/simulation/SimulationControlPanel.tsx` (envía `soloCoincidencias: true`)
- **Regla**: cuando hay **≥2 indicadores** habilitados, solo se devuelven las filas de indicador (subCore) cuya `tipoSenal` coincide con la de **al menos otro** indicador; las disidentes se ocultan. Se aplica por igual a CALL, PUT y HOLD. La fila agregada de `A_INDICADORES` y los demás cores nunca se filtran. Con **un solo indicador** no hay con qué comparar, así que se muestran todos los resultados.
- **Ejemplo**: RSI=CALL, EMA=CALL, MACD=PUT → se muestran RSI y EMA (coinciden en CALL); se oculta MACD.
- **Override**: `soloCoincidencias: false` desactiva el filtro (usado en tests y futuras vistas).

### 8. Datos históricos por fecha (backtest a un día del pasado)

- **Archivos**:
  - `projects/rest-api/inversions_api/src/modules/indicators/types.ts` (`fechaHistorica?` en `SimulationRequest`)
  - `projects/rest-api/inversions_api/src/modules/indicators/ohlcSource.ts` (`getCandles` honra `endTimeMs`)
  - `projects/rest-api/inversions_api/src/modules/simulation/runner.ts` (validación + truncado de velas a la fecha)
  - `projects/pwa/inversions_app/src/features/dashboard/simulation/SimulationControlPanel.tsx` (input "Fecha Histórica (opcional)")
- **Diseño elegido — snapshot a una fecha**: cuando el usuario envía `fechaHistorica` (ISO `yyyy-mm-dd`), el core ensancha el rango de Yahoo para cubrir suficiente historia previa, trunca la serie al **fin de ese día** (`endOfDayMs`) y calcula la señal **como si hoy fuera esa fecha**. Así el operador ve qué buy/hold/sell aplicaba en ese punto del pasado. Reusa el pipeline existente (1 fila por indicador), sin un modelo nuevo de filas por timestamp.
- **Validación**: `fechaHistorica` vacía/ausente → usa datos más recientes; fecha no parseable → `400 INVALID_SIMULATION_REQUEST`; fecha futura → `400 INVALID_RANGE`.
- **Límite conocido**: el alcance hacia atrás depende del rango máximo de Yahoo por timeframe (p.ej. intradía 1m≈7d, 60m≈730d, 1d≈5y). Fuera de ese rango se cae a mock determinista, sin romper la respuesta.

---

## Pruebas

- `projects/rest-api/inversions_api/tests/unit/simulation/runner.test.ts` — añadidos:
  - Validación de `fechaHistorica` (vacía/ausente OK, no parseable → `INVALID_SIMULATION_REQUEST`, futura → `INVALID_RANGE`).
  - `signalMetrics` consistente con la tabla (`buy+sell+hold === total === table.length`).
  - Un solo indicador → no se filtra (US7).
  - Filtro de coincidencias (default) deja ≤ filas que desactivándolo, y cada sobreviviente comparte `tipoSenal` con ≥1 par (US7).
- **Resultado backend**: 484 tests, 483 passing. La única falla (`tests/integration/runtime/runtimeMode.test.ts`) es **preexistente y ajena** a estos cambios: `runtimeModeStore.ts` tiene `operationalMode: "real"` hardcodeado mientras el test espera `"demo"`. No se tocó runtime.
- **Typecheck**: `tsc --noEmit` limpio en los archivos modificados (frontend y backend). Los errores de tipos en `src/store/appShell.test.ts` son preexistentes y ajenos.

## Decisiones de diseño

- **US7 (coincidencias)**: se filtran filas disidentes manteniendo la fila agregada, en lugar de colapsar a una sola fila de consenso, para preservar la trazabilidad por indicador.
- **US8 (histórico)**: snapshot a una fecha (trunca y recalcula) en lugar de backtest por puntos (filas por timestamp), por simplicidad y reutilización del pipeline. Si más adelante se requiere ver señales en múltiples puntos del pasado, se puede extender a un modelo por timestamp.

## Archivos modificados

**Backend** (`projects/rest-api/inversions_api/`):
- `src/modules/indicators/types.ts`
- `src/modules/indicators/ohlcSource.ts`
- `src/modules/simulation/runner.ts`
- `src/routes/market-data/ohlc.ts`
- `tests/unit/simulation/runner.test.ts`

**Frontend** (`projects/pwa/inversions_app/`):
- `src/services/signals/confluenceTableApi.ts`
- `src/features/dashboard/simulation/SimulationControlPanel.tsx`
- `src/features/dashboard/MainDashboard.tsx`
