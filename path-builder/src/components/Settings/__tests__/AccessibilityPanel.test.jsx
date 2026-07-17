import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

const mockSetDyslexicFont = vi.fn();
const mockSetReducedMotion = vi.fn();
const mockSetReadingLevel = vi.fn();

const mockUseAccessibilityPreferences = vi.fn(() => ({
  prefs: {
    dyslexicFont: false,
    reducedMotion: "system",
    readingLevel: "standard",
  },
  setDyslexicFont: mockSetDyslexicFont,
  setReducedMotion: mockSetReducedMotion,
  setReadingLevel: mockSetReadingLevel,
}));

vi.mock("../../../hooks/useAccessibilityPreferences", () => ({
  default: () => mockUseAccessibilityPreferences(),
}));

import AccessibilityPanel from "../AccessibilityPanel";

describe("AccessibilityPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the trigger button initially", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole("button", { name: "Accessibility settings" });
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("opens popover with accessibility controls on click", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole("button", { name: "Accessibility settings" });
    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("dialog", { name: "Accessibility settings" })).toBeTruthy();
    expect(screen.getByLabelText("Dyslexic-friendly font")).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Motion preference" })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Reading level preference" })).toBeTruthy();
  });

  it("calls preference handlers on interacting with controls", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole("button", { name: "Accessibility settings" });
    fireEvent.click(trigger);

    const checkbox = screen.getByLabelText("Dyslexic-friendly font");
    fireEvent.click(checkbox);
    expect(mockSetDyslexicFont).toHaveBeenCalledWith(true);

    const simpleBtn = screen.getByRole("radio", { name: "Simple" });
    fireEvent.click(simpleBtn);
    expect(mockSetReadingLevel).toHaveBeenCalledWith("simple");
  });

  it("closes popover on Escape key down", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole("button", { name: "Accessibility settings" });
    fireEvent.click(trigger);

    expect(screen.queryByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("implements focus trapping and focus restoration correctly", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole("button", { name: "Accessibility settings" });

    // Focus starts elsewhere
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    // Open popover
    fireEvent.click(trigger);

    // Focus should be restored/set to first focusable element (close button)
    const closeBtn = screen.getByRole("button", { name: "Close" });
    expect(document.activeElement).toBe(closeBtn);

    // Trap focus Tab logic: get all focusable elements inside popover
    const popover = screen.getByRole("dialog");
    const focusable = popover.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Focus on last element
    last.focus();
    expect(document.activeElement).toBe(last);

    // Pressing Tab on last element should focus first element
    fireEvent.keyDown(popover, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    // Pressing Shift+Tab on first element should focus last element
    first.focus();
    fireEvent.keyDown(popover, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    // Close popover
    fireEvent.click(closeBtn);

    // Focus should be restored back to the trigger button
    expect(document.activeElement).toBe(trigger);
  });
});
