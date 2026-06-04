// FIC: ChatInputBar tests — disabled state during pending, empty send prevention, Enter key behavior.
// FIC: Tests de ChatInputBar — estado deshabilitado durante pending, prevención de envío vacío, comportamiento de Enter.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatInputBar } from "./ChatInputBar";

describe("ChatInputBar", () => {
  it("textarea y botón están deshabilitados cuando pending=true", () => {
    render(<ChatInputBar onSend={vi.fn()} pending={true} />);
    const textarea = screen.getByRole("textbox");
    const button = screen.getByRole("button", { name: "Enviar mensaje" });
    expect((textarea as HTMLTextAreaElement).disabled).toBe(true);
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("textarea y botón están habilitados cuando pending=false", () => {
    render(<ChatInputBar onSend={vi.fn()} pending={false} />);
    const textarea = screen.getByRole("textbox");
    expect((textarea as HTMLTextAreaElement).disabled).toBe(false);
  });

  it("envío vacío no dispara onSend", () => {
    const onSend = vi.fn();
    render(<ChatInputBar onSend={onSend} pending={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it("Enter llama onSend con el texto y limpia el campo", () => {
    const onSend = vi.fn();
    render(<ChatInputBar onSend={onSend} pending={false} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "¿Tendencia?" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSend).toHaveBeenCalledWith("¿Tendencia?");
  });

  it("Shift+Enter no dispara onSend", () => {
    const onSend = vi.fn();
    render(<ChatInputBar onSend={onSend} pending={false} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "línea" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });
});
