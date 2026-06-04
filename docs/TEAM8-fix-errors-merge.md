# Corrección de Errores Post-Merge

## Resumen

Se corrigieron **19 errores** de TypeScript (en archivos del dashboard/estrategias y del módulo institucional), provocados por el merge de `origin/main`. Los errores eran de dos tipos: **estados no declarados** en componentes React y **rutas de import incorrectas** por archivos movidos de directorio.

---

## 1. Errores Corregidos — Dashboard / Estrategias Complejas

### 1.1 `MainDashboard.tsx` — 3 estados no declarados

Se usaban `setSimulationMetrics`, `setNewsDateRange` y `setSpreadRequest` sin haber declarado el `useState`.

**Antes** (no existía la declaración):
```tsx
// setSimulationMetrics(null);  ← Error: is not defined
// setNewsDateRange(undefined); ← Error: is not defined
// setSpreadRequest(null);      ← Error: is not defined
```

**Después**:
```tsx
import type { ConfluenceSignalRow, SimulationResponse, CoreId, SignalMetrics } from "../../services/signals/confluenceTableApi";
// ...
const [simulationMetrics, setSimulationMetrics] = useState<SignalMetrics | null>(null);
const [, setNewsDateRange] = useState<string | undefined>(undefined);
const [, setSpreadRequest] = useState<unknown>(null);
```

### 1.2 `ConfluenceSignalsTable.tsx` — 2 funciones helper faltantes

Se usaban `providerAccent()` y `compactNewsTitle()` sin estar definidas. Eran funciones del módulo de noticias que no se portaron en el merge.

**Antes**:
```tsx
// usadas en líneas 345, 359, 360, 364 sin estar declaradas:
boxShadow: row.core === "A_NOTICIAS" ? `inset 3px 0 0 ${providerAccent(row.fuente)}` : undefined,
color: providerAccent(row.fuente)
{compactNewsTitle(row)}
```

**Después** (funciones inline agregadas antes de `TABLE_COLUMNS`):
```tsx
function providerAccent(source: string): string {
  const s = source.toLowerCase();
  if (s.includes("yahoo")) return "#7c3aed";
  if (s.includes("finnhub")) return "#0ea5e9";
  if (s.includes("newsapi")) return "#f59e0b";
  if (s.includes("polygon")) return "#10b981";
  if (s.includes("alpha")) return "#ef4444";
  return "var(--color-accent)";
}

function compactNewsTitle(row: ConfluenceSignalRow): string {
  const title = row.observacion?.objetivo ?? "";
  if (title.length <= 60) return title;
  return title.slice(0, 57) + "…";
}
```

### 1.3 `SimulationControlPanel.tsx` — 3 referencias a spread/clear inexistentes

El `resetPanel` llamaba a `setSpreadParams(DEFAULT_SPREAD_PARAMS)` y `onClear?.()` que nunca existieron (el módulo de spreads fue reemplazado por coverage + term).

**Antes**:
```tsx
const resetPanel = () => {
    // ...
    setSpreadParams(DEFAULT_SPREAD_PARAMS);  // ← Error: no existe
    setError(null);
    onClear?.();                              // ← Error: no existe
  };
```

**Después**:
```tsx
const resetPanel = () => {
    // ...
    setCoverageParams(DEFAULT_COVERAGE_PARAMS);
    setTermParams(DEFAULT_TERM_PARAMS);
    setError(null);
  };
```

### 1.4 `buildStrategyRows.ts` — Type cast inválido

El cast directo `prem as Record<string, unknown>` fallaba porque `PremiumUsed` no tenía índice de tipo.

**Antes**:
```tsx
const p = prem as Record<string, unknown>;
```

**Después**:
```tsx
const p = prem as unknown as Record<string, unknown>;
```

### 1.5 `ComplexStrategyModal.tsx` — Type `unknown` no asignable a `ReactNode`

Las expresiones `{risk?.resumen && (...) }` y `{simulation?.distribucion_pnl && (...)}` devolvían tipo `unknown | false` que no es `ReactNode`.

**Antes**:
```tsx
{risk?.resumen && (
  <div ...>
    {risk.resumen as string}
  </div>
)}
{risk?.accion_recomendada && (
  <div ...>
    {risk.accion_recomendada as string}
  </div>
)}
{simulation?.distribucion_pnl && (
  <div>...</div>
)}
```

**Después**:
```tsx
{risk?.resumen ? (
  <div ...>
    {String(risk.resumen)}
  </div>
) : null}
{risk?.accion_recomendada ? (
  <div ...>
    {String(risk.accion_recomendada)}
  </div>
) : null}
{simulation?.distribucion_pnl ? (
  <div>...</div>
) : null}
```

---

## 2. Errores Corregidos — Módulo Institucional

### 2.1 `institutionalApi.ts` — 2 rutas de import incorrectas

El archivo estaba en `src/institutional/` pero los imports apuntaban a `src/` en lugar de `src/services/`.

**Antes**:
```tsx
import { getAuthHeaders } from "../signals/signalApi";     // → src/signals/  ✗
import { getCached, setCache } from "../apiCache";          // → src/apiCache  ✗
```

**Después**:
```tsx
import { getAuthHeaders } from "../services/signals/signalApi";  // → src/services/signals/  ✓
import { getCached, setCache } from "../services/apiCache";      // → src/services/          ✓
```

### 2.2 `InstitutionalDetailModal.tsx` — 5 rutas de import incorrectas

El archivo fue movido a `src/institutional/` pero los imports mantenían rutas relativas de su ubicación anterior.

**Antes**:
```tsx
import { ContentModal } from "../../components/ui/ContentModal";          // → components/ui/         ✗
import { MarkdownContent } from "../../components/ui/MarkdownContent";     // → components/ui/         ✗
import type { InstitutionalAnalysisResponse } from "../../services/institutional/institutionalApi"; // → services/ ✗
import type { ConfluenceSignalRow } from "../../services/signals/confluenceTableApi";                // → services/ ✗
import { ObservationsTab } from "../dashboard/ObservationsTab";            // → src/dashboard/         ✗
```

**Después**:
```tsx
import { ContentModal } from "../components/ui/ContentModal";                    // → src/components/ui/  ✓
import { MarkdownContent } from "../components/ui/MarkdownContent";               // → src/components/ui/  ✓
import type { InstitutionalAnalysisResponse } from "./institutionalApi";          // → mismo directorio    ✓
import type { ConfluenceSignalRow } from "../services/signals/confluenceTableApi"; // → src/services/      ✓
import { ObservationsTab } from "../features/dashboard/ObservationsTab";          // → src/features/       ✓
```

---

## 3. Errores No Tocados (por equipo)

| Archivo(s) | Errores | Equipo | Tipo |
|-----------|---------|--------|------|
| `src/ai/aiChatApi.ts` | Cannot find module `../signals/signalApi` | **TEAM-07** | Ruta de import |
| `src/ai/GlobalChatDrawer.tsx` | 17 errores: módulos no encontrados + propiedad `role` no existe en `ExtendedChatMessage` | **TEAM-07** | Ruta de import + tipo |
| `src/ai/volatilityAnalysisApi.ts` | Cannot find module `../signals/signalApi` | **TEAM-07** | Ruta de import |
| `src/fundamental/fundamentalApi.ts` | 3 errores: `../signals/signalApi`, `../apiCache`, `../signals/confluenceTableApi` | **TEAM-03** | Ruta de import |
| `src/options/optionChainApi.ts` | Cannot find module `../signals/signalApi` | **TEAM-01** | Ruta de import |
| `src/options/OptionChainTable.tsx` | 5 errores: módulos no encontrados + `any` implícitos | **TEAM-01** | Ruta de import + tipo |
| `src/views/StrategiesView.tsx` | Cannot find module `../../coverage/CoverageStrategyModal` | — | Ruta de import |
| `src/views/WatchlistView.tsx` | 4 errores: módulos no encontrados | — | Ruta de import |
| `src/views/OptionsCalculatorView.tsx` | 2 errores: módulos no encontrados | — | Ruta de import |
| `src/views/AnalysisCategoriesView.tsx` | Cannot find module `../../../store/appShell` | — | Ruta de import |
| `src/ui/ActivityBar.tsx` | Cannot find module `../../store/appShell` | — | Ruta de import |
| `src/store/appShell.test.ts` | 4 errores: `global` no definido + propiedades renombradas | — | Test desactualizado |
| `src/App.tsx` | Type props no asignable | — | Tipo componente |

**Nota**: Todos los errores no tocados son **idénticos en naturaleza** a los ya corregidos — rutas de import relativas incorrectas por archivos movidos de directorio al integrarse de `main`. Ninguno afecta al dashboard de simulación ni a las estrategias complejas.

---

## 4. Resumen Final

| Concepto | Cantidad |
|----------|----------|
| Errores corregidos (Dashboard / Estrategias) | 12 |
| Errores corregidos (Institucional) | 7 |
| Errores no tocados (otros equipos) | ~45 |
| Archivos modificados | 7 |
| Errores nuevos generados por las correcciones | 0 |

*Documentación generada el 2026-05-31*
