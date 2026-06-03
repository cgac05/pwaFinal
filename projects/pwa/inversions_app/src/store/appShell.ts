// FIC: AppShell layout store — persists panel state to localStorage using useSyncExternalStore pattern.
// FIC: Store del layout AppShell — persiste el estado de paneles en localStorage usando el patrón useSyncExternalStore.

import { useSyncExternalStore } from "react";

export type AppShellSection = "watchlist" | "analysis" | "strategies";
export type AnalysisCategory = "technical" | "institutional" | "fundamental" | "news" | "news2" | "ai";

interface AppShellStoreState {
  activeSection: AppShellSection;
  leftPanelCollapsed: boolean;
  analysisCategory: AnalysisCategory;
}

type Listener = () => void;

const listeners = new Set<Listener>();

function readLS(key: string, fallback: string): string {
  return (typeof window !== "undefined" && window.localStorage.getItem(key)) || fallback;
}

function writeLS(key: string, value: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, value);
  }
}

const state: AppShellStoreState = {
  activeSection: readLS("inversions.appshell.section", "watchlist") as AppShellSection,
  leftPanelCollapsed: readLS("inversions.appshell.left-collapsed", "false") === "true",
  analysisCategory: readLS("inversions.appshell.analysis-cat", "technical") as AnalysisCategory,
};

let snapshot: AppShellStoreState = { ...state };

function emit(): void {
  snapshot = { ...state };
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): AppShellStoreState {
  return snapshot;
}

export function useAppShellStore() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    ...snap,

    setActiveSection(section: AppShellSection) {
      if (state.activeSection === section) {
        // FIC: Toggle panel collapse when tapping the already-active section icon.
        // FIC: Alternar colapso del panel al tocar el ícono de la sección ya activa.
        state.leftPanelCollapsed = !state.leftPanelCollapsed;
        writeLS("inversions.appshell.left-collapsed", String(state.leftPanelCollapsed));
      } else {
        state.activeSection = section;
        writeLS("inversions.appshell.section", section);
        // FIC: Expand panel when switching to a new section if it was collapsed.
        // FIC: Expandir el panel al cambiar de sección si estaba colapsado.
        if (state.leftPanelCollapsed) {
          state.leftPanelCollapsed = false;
          writeLS("inversions.appshell.left-collapsed", "false");
        }
      }
      emit();
    },

    toggleLeftPanel() {
      state.leftPanelCollapsed = !state.leftPanelCollapsed;
      writeLS("inversions.appshell.left-collapsed", String(state.leftPanelCollapsed));
      emit();
    },

    setLeftPanelCollapsed(collapsed: boolean) {
      state.leftPanelCollapsed = collapsed;
      writeLS("inversions.appshell.left-collapsed", String(collapsed));
      emit();
    },

    setAnalysisCategory(category: AnalysisCategory) {
      state.analysisCategory = category;
      writeLS("inversions.appshell.analysis-cat", category);
      emit();
    },
  };
}
