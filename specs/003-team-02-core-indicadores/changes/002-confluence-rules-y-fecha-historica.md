# Control de Cambios 002 — Reglas de confluencia + default de core + fix de fecha histórica (TEAM-02)

**Feature**: 003-team-02-core-indicadores
**Equipo**: TEAM-02 CocaDe6Lts
**Fecha**: 2026-05-31
**Tipo**: Ajuste de comportamiento del core de señales + bugfix visual
**Estado**: Implementado
**Relación**: refina lo entregado en `changes/001-dashboard-ux-8-cambios.md` (US2, US7, US8).

---

## Resumen

| # | Cambio | Capa | Estado |
|---|--------|------|--------|
| 1 | Core `A_INDICADORES` desactivado por defecto al iniciar (solo estado inicial) | Frontend | ✅ |
| 2 | Tabla vacía de indicadores si el core está on pero sin indicadores individuales | Backend | ✅ |
| 3 | Regla multicore: la tabla vacía solo aplica si A_INDICADORES es el único core encendido | Backend | ✅ |
| 4 | Bugfix: filas con datos históricos mostraban la fecha de hoy en vez de la fecha real | Backend | ✅ |

---

## Detalle

### 1. Core A_INDICADORES desactivado por defecto (estado inicial, no auto-apagado)

- **Archivo**: `projects/pwa/inversions_app/src/features/dashboard/simulation/SimulationControlPanel.tsx`
- **Qué**: Se añadieron factories `defaultCoresOn()` (todos los cores en `true` **excepto** `A_INDICADORES`, que arranca en `false`) y `defaultIndicadoresOn()` (todos los indicadores en `false`). Se usan tanto en el `useState` inicial como en `resetPanel()`.
- **Importante**: Es **solo el estado inicial**. No hay ninguna lógica que apague `A_INDICADORES` al presionar "Ejecutar Simulación"; si el usuario lo activa manualmente, permanece activo. Se evita así apagarlo por error.

### 2. Tabla sin filas de indicadores cuando no hay indicadores individuales activos

- **Archivo**: `projects/rest-api/inversions_api/src/modules/simulation/runner.ts`
- **Qué**: Se eliminó el fallback que, cuando `indicadoresHabilitados` venía vacío, asumía los 5 indicadores. Ahora `enabledSubs = request.indicadoresHabilitados ?? []` y la tabla de indicadores solo se construye `if (enabledCores.has("A_INDICADORES") && enabledSubs.length > 0)`.
- **Resultado**: si el core de indicadores está activo pero el usuario no eligió ningún indicador individual, el core **no emite filas** (ni subCores ni fila agregada).

### 3. Regla multicore

- **Archivo**: `projects/rest-api/inversions_api/src/modules/simulation/runner.ts`
- **Qué**: Los demás cores (`A_TECNICO`, `A_INSTITUCIONAL`, `A_FUNDAMENTAL`, `A_NOTICIAS`, `A_IA`) se construyen de forma independiente de los indicadores. Por lo tanto, la "tabla vacía" del punto 2 solo deja la tabla totalmente vacía cuando **A_INDICADORES es el único core encendido**. Si hay otros cores activos, esos sí muestran sus propios resultados.
- **Ejemplo**: cores `[A_INDICADORES, A_IA]` sin indicadores → A_INDICADORES no aporta filas, pero la fila de A_IA sí aparece.

### 4. Bugfix de fecha en datos históricos

- **Archivo**: `projects/rest-api/inversions_api/src/modules/simulation/runner.ts`
- **Síntoma**: al correr con `fechaHistorica`, las filas mostraban la fecha de hoy (porque `fecha` se derivaba de `computedAt = now`).
- **Fix**: tras ensamblar la tabla, si la corrida es histórica (`endTimeMs` definido y hay velas), se sella el campo `fecha` de **todas** las filas con la fecha real de la última vela usada (`new Date(lastCandle.time*1000)`). El campo `computed_at` conserva el timestamp real de cómputo; solo `fecha` (la fecha del dato) refleja el pasado.

---

## Pruebas

`projects/rest-api/inversions_api/tests/unit/simulation/runner.test.ts` — añadidos:
- A_INDICADORES activo + sin indicadores individuales → 0 filas de A_INDICADORES.
- Multicore: sin indicadores, otros cores activos sí emiten filas (A_IA presente).
- Históricos: con `fechaHistorica` + velas inyectadas terminando en esa fecha, todas las filas muestran la fecha histórica y no la de hoy.

**Resultado backend**: 487 tests, 486 passing. La única falla (`tests/integration/runtime/runtimeMode.test.ts`) es **preexistente y ajena** (default `operationalMode:"real"` en `runtimeModeStore.ts` vs test que espera `"demo"`). Typecheck `tsc --noEmit` limpio en los archivos modificados (frontend y backend).

## Archivos modificados

**Backend**: `src/modules/simulation/runner.ts`, `tests/unit/simulation/runner.test.ts`.
**Frontend**: `src/features/dashboard/simulation/SimulationControlPanel.tsx`.
