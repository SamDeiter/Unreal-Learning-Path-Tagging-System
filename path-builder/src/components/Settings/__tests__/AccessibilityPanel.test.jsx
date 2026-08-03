import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AccessibilityPanel from "../AccessibilityPanel";

const mockPrefs = { dyslexicFont: false, reducedMotion: "system", readingLevel: "standard" };
const mockSetDyslexicFont = vi.fn();
const mockSetReducedMotion = vi.fn();
const mockSetReadingLevel = vi.fn();

vi.mock("../../../hooks/useAccessibilityPreferences", () => ({
  default: () => ({
    prefs: mockPrefs,
    setDyslexicFont: mockSetDyslexicFont,
    setReducedMotion: mockSetReducedMotion,
    setReadingLevel: mockSetReadingLevel,
  }),
}));

describe("AccessibilityPanel Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should support open, escape close, focus-on-open and focus restoration", async () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByLabelText("Accessibility settings");
    expect(trigger).toBeTruthy();

    trigger.focus();
    fireEvent.click(trigger);

    await new Promise((resolve) => setTimeout(resolve, 60));

    const popover = screen.getByRole("dialog");
    expect(popover).toBeTruthy();
    expect(popover.getAttribute("aria-modal")).toBe("true");

    const closeBtn = screen.getByLabelText("Close");
    expect(document.activeElement).toBe(closeBtn);

    fireEvent.keyDown(popover, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("should trap focus inside the dialog on tab/shift-tab", async () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByLabelText("Accessibility settings");
    fireEvent.click(trigger);
    await new Promise((resolve) => setTimeout(resolve, 60));

    const popover = screen.getByRole("dialog");
    const focusables = popover.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])');
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    first.focus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    last.focus();
    fireEvent.keyDown(last, { key: "Tab", shiftKey: false });
    expect(document.activeElement).toBe(first);
  });
});
