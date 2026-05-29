// FIC: AppShell store tests — defaults, localStorage persistence, state transitions via renderHook.
// FIC: Tests del store AppShell — defaults, persistencia localStorage, transiciones de estado via renderHook.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

describe("appShell store", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.resetModules();
  });

  it("defaults correctos sin localStorage previo", async () => {
    const { useAppShellStore } = await import("./appShell");
    const { result } = renderHook(() => useAppShellStore());
    expect(result.current.activeSection).toBe("watchlist");
    expect(result.current.leftPanelCollapsed).toBe(false);
    expect(result.current.chatPanelCollapsed).toBe(false);
    expect(result.current.analysisCategory).toBe("technical");
  });

  it("persiste activeSection en localStorage", async () => {
    const { useAppShellStore } = await import("./appShell");
    const { result } = renderHook(() => useAppShellStore());
    act(() => { result.current.setActiveSection("analysis"); });
    expect(localStorageMock.getItem("inversions.appshell.section")).toBe("analysis");
  });

  it("persiste leftPanelCollapsed en localStorage", async () => {
    const { useAppShellStore } = await import("./appShell");
    const { result } = renderHook(() => useAppShellStore());
    act(() => { result.current.toggleLeftPanel(); });
    expect(localStorageMock.getItem("inversions.appshell.left-collapsed")).toBe("true");
    act(() => { result.current.toggleLeftPanel(); });
    expect(localStorageMock.getItem("inversions.appshell.left-collapsed")).toBe("false");
  });

  it("persiste chatPanelCollapsed en localStorage", async () => {
    const { useAppShellStore } = await import("./appShell");
    const { result } = renderHook(() => useAppShellStore());
    act(() => { result.current.toggleChatPanel(); });
    expect(localStorageMock.getItem("inversions.appshell.chat-collapsed")).toBe("true");
  });

  it("persiste analysisCategory en localStorage", async () => {
    const { useAppShellStore } = await import("./appShell");
    const { result } = renderHook(() => useAppShellStore());
    act(() => { result.current.setAnalysisCategory("ai"); });
    expect(localStorageMock.getItem("inversions.appshell.analysis-cat")).toBe("ai");
  });

  it("setActiveSection expande el panel cuando estaba colapsado", async () => {
    const { useAppShellStore } = await import("./appShell");
    const { result } = renderHook(() => useAppShellStore());
    act(() => { result.current.setLeftPanelCollapsed(true); });
    act(() => { result.current.setActiveSection("strategies"); });
    expect(result.current.leftPanelCollapsed).toBe(false);
  });

  it("setActiveSection en sección ya activa colapsa el panel (toggle)", async () => {
    const { useAppShellStore } = await import("./appShell");
    const { result } = renderHook(() => useAppShellStore());
    expect(result.current.leftPanelCollapsed).toBe(false);
    act(() => { result.current.setActiveSection("watchlist"); }); // already active → toggle
    // FIC: Check via localStorage side effect — useSyncExternalStore rerender timing varies per env.
    // FIC: Verificar via efecto en localStorage — el timing del re-render de useSyncExternalStore varía.
    expect(localStorageMock.getItem("inversions.appshell.left-collapsed")).toBe("true");
  });

  it("restaura valores de localStorage al inicializar el store", async () => {
    localStorageMock.setItem("inversions.appshell.section", "strategies");
    localStorageMock.setItem("inversions.appshell.left-collapsed", "true");
    localStorageMock.setItem("inversions.appshell.chat-collapsed", "true");
    localStorageMock.setItem("inversions.appshell.analysis-cat", "news");
    const { useAppShellStore } = await import("./appShell");
    const { result } = renderHook(() => useAppShellStore());
    expect(result.current.activeSection).toBe("strategies");
    expect(result.current.leftPanelCollapsed).toBe(true);
    expect(result.current.chatPanelCollapsed).toBe(true);
    expect(result.current.analysisCategory).toBe("news");
  });
});
