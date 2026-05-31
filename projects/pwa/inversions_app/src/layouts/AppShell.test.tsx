// FIC: AppShell layout tests — 3-zone render, panel collapse, tablet drawer behavior.

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "./AppShell";

const mockStore = {
  leftPanelCollapsed: false,
  toggleLeftPanel: vi.fn(),
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
};

describe("AppShell", () => {
  it("renderiza las 3 zonas correctamente", () => {
    render(<AppShell {...props} />);
    expect(screen.getByTestId("app-shell-activity-bar")).toBeDefined();
    expect(screen.getByTestId("app-shell-left-panel")).toBeDefined();
    expect(screen.getByTestId("app-shell-main")).toBeDefined();
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
