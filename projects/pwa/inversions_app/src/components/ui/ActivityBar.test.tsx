// FIC: ActivityBar unit tests — navigation button and toggle behavior.

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActivityBar } from "./ActivityBar";

const mockToggleLeftPanel = vi.fn();

vi.mock("../../store/appShell", () => ({
  useAppShellStore: () => ({
    leftPanelCollapsed: false,
    toggleLeftPanel: mockToggleLeftPanel,
  }),
}));

describe("ActivityBar", () => {
  beforeEach(() => {
    mockToggleLeftPanel.mockClear();
  });

  it("renderiza el botón de navegación Watchlist", () => {
    render(<ActivityBar />);
    expect(screen.getByRole("button", { name: "Watchlist" })).toBeDefined();
  });

  it("el botón tiene aria-label correcto", () => {
    render(<ActivityBar />);
    expect(screen.getByLabelText("Watchlist")).toBeDefined();
  });

  it("clic en el botón llama a toggleLeftPanel", () => {
    render(<ActivityBar />);
    fireEvent.click(screen.getByLabelText("Watchlist"));
    expect(mockToggleLeftPanel).toHaveBeenCalled();
  });
});
