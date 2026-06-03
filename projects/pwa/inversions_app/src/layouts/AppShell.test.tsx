// FIC: AppShell layout tests — 4-zone render, panel collapse, tablet drawer behavior.
// FIC: Tests del layout AppShell — renderizado 4 zonas, colapso de paneles, comportamiento Drawer en tablet.

import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "./AppShell";

const mockStore = {
  leftPanelCollapsed: false,
  chatPanelCollapsed: false,
  toggleLeftPanel: vi.fn(),
  toggleChatPanel: vi.fn(),
  activeSection: "watchlist" as const,
  analysisCategory: "technical" as const,
  setActiveSection: vi.fn(),
};

vi.mock("../store/appShell", () => ({
  useAppShellStore: () => mockStore,
}));

const props = {
  activityBar: <div data-testid="activity-bar">AB</div>,
  leftPanel: <div data-testid="left-panel">LP</div>,
  main: <div data-testid="main-content">Main</div>,
  chatPanel: <div data-testid="chat-panel">Chat</div>,
};

describe("AppShell", () => {
  beforeEach(() => {
    mockStore.leftPanelCollapsed = false;
    mockStore.chatPanelCollapsed = false;
  });

  it("renderiza las 4 zonas correctamente", () => {
    render(<AppShell {...props} />);
    expect(screen.getByTestId("app-shell-activity-bar")).toBeDefined();
    expect(screen.getByTestId("app-shell-left-panel")).toBeDefined();
    expect(screen.getByTestId("app-shell-main")).toBeDefined();
    expect(screen.getByTestId("app-shell-chat-panel")).toBeDefined();
  });

  it("barra de actividad siempre está presente en el DOM", () => {
    render(<AppShell {...props} />);
    expect(screen.getByTestId("activity-bar").textContent).toBe("AB");
  });

  it("panel izquierdo tiene width 0px cuando leftPanelCollapsed=true", () => {
    mockStore.leftPanelCollapsed = true;
    render(<AppShell {...props} />);
    const panel = screen.getByTestId("app-shell-left-panel");
    expect(panel.style.width).toBe("0px");
    mockStore.leftPanelCollapsed = false;
  });

  it("panel de chat tiene width 0px cuando chatPanelCollapsed=true", () => {
    mockStore.chatPanelCollapsed = true;
    render(<AppShell {...props} />);
    const panel = screen.getByTestId("app-shell-chat-panel");
    expect(panel.style.width).toBe("0px");
    expect(panel.style.transform).toBe("translateX(100%)");
  });

  it("panel de chat abierto se sobrepone sin quitar ancho al main", () => {
    render(<AppShell {...props} />);
    const panel = screen.getByTestId("app-shell-chat-panel");
    const main = screen.getByTestId("app-shell-main");
    expect(panel.style.position).toBe("absolute");
    expect(panel.style.right).toBe("0px");
    expect(main.style.flex).toBe("1 1 0%");
    expect(main.style.width).toBe("0px");
  });

  it("el contenido principal se renderiza dentro de main", () => {
    render(<AppShell {...props} />);
    expect(screen.getByTestId("main-content").textContent).toBe("Main");
  });

  it("panel izquierdo tiene clase CSS que permite ocultarlo en tablet via media query (FR-013)", () => {
    render(<AppShell {...props} />);
    const panel = screen.getByTestId("app-shell-left-panel");
    expect(panel.className).toContain("app-shell-left-panel");
  });
});
