# Contrato: AppShell Store

**Feature**: 005-app-shell-chat  
**Tipo**: Estado global del cliente (localStorage-backed)  
**Archivo de implementación**: `projects/pwa/inversions_app/src/store/appShell.ts`

---

## Interfaz pública del hook `useAppShellStore()`

```ts
interface AppShellStoreState {
  activeSection: "watchlist" | "analysis" | "strategies";
  leftPanelCollapsed: boolean;
  chatPanelCollapsed: boolean;
  analysisCategory: "technical" | "institutional" | "fundamental" | "news" | "ai";
}

interface AppShellStore extends AppShellStoreState {
  setActiveSection: (section: AppShellStoreState["activeSection"]) => void;
  toggleLeftPanel: () => void;
  setLeftPanelCollapsed: (collapsed: boolean) => void;
  toggleChatPanel: () => void;
  setChatPanelCollapsed: (collapsed: boolean) => void;
  setAnalysisCategory: (category: AppShellStoreState["analysisCategory"]) => void;
}
```

## Comportamiento de persistencia

| Acción | localStorage key | Nota |
|--------|-----------------|------|
| `setActiveSection("analysis")` | `inversions.appshell.section = "analysis"` | |
| `toggleLeftPanel()` | `inversions.appshell.left-collapsed = "true"/"false"` | |
| `toggleChatPanel()` | `inversions.appshell.chat-collapsed = "true"/"false"` | |
| `setAnalysisCategory("ai")` | `inversions.appshell.analysis-cat = "ai"` | |

## Valores iniciales (defaults al primer load)

```ts
activeSection: localStorage.getItem("inversions.appshell.section") ?? "watchlist"
leftPanelCollapsed: localStorage.getItem("inversions.appshell.left-collapsed") === "true"
chatPanelCollapsed: localStorage.getItem("inversions.appshell.chat-collapsed") === "true"
analysisCategory: localStorage.getItem("inversions.appshell.analysis-cat") ?? "technical"
```

## Patrón de implementación

Mismo patrón que `src/store/signals.ts`:

```ts
import { useSyncExternalStore } from "react";

let state: AppShellStoreState = { /* defaults con localStorage */ };
const listeners = new Set<() => void>();

function emit() { listeners.forEach(l => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return state; }

export function useAppShellStore(): AppShellStore {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...snap, setActiveSection: ..., toggleLeftPanel: ..., ... };
}
```
