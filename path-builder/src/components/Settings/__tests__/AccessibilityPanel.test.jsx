import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AccessibilityPanel from "../AccessibilityPanel";

describe("AccessibilityPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-font");
    document.documentElement.removeAttribute("data-motion");
  });

  it("renders trigger button with correct attributes", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole("button", { name: /accessibility settings/i });
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("opens dialog on click and sets aria-expanded to true", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole("button", { name: /accessibility settings/i });

    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const dialog = screen.getByRole("dialog", { name: /accessibility settings/i });
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("automatically focuses the close button on open", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole("button", { name: /accessibility settings/i });

    fireEvent.click(trigger);

    const closeBtn = screen.getByRole("button", { name: /close/i });
    expect(document.activeElement).toBe(closeBtn);
  });

  it("restores focus to trigger button when closed", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole("button", { name: /accessibility settings/i });

    // Open
    fireEvent.click(trigger);
    const closeBtn = screen.getByRole("button", { name: /close/i });

    // Close
    fireEvent.click(closeBtn);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("traps focus inside the dialog with Tab and Shift+Tab", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole("button", { name: /accessibility settings/i });

    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: /accessibility settings/i });
    const focusable = dialog.querySelectorAll("button, input");
    const first = focusable[0]; // close button
    const last = focusable[focusable.length - 1]; // last reading level option

    // Focus last element
    last.focus();
    expect(document.activeElement).toBe(last);

    // Press Tab on last element -> wraps to first
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    // Press Shift+Tab on first element -> wraps to last
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("closes dialog on Escape keypress", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole("button", { name: /accessibility settings/i });

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
