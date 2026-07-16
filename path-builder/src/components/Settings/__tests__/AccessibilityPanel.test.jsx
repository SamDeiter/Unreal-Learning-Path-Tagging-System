import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AccessibilityPanel from "../AccessibilityPanel";
import useAccessibilityPreferences from "../../../hooks/useAccessibilityPreferences";

// Mock the hook
vi.mock("../../../hooks/useAccessibilityPreferences", () => ({
  default: vi.fn(),
}));

describe("AccessibilityPanel", () => {
  const mockPrefs = {
    dyslexicFont: false,
    reducedMotion: "system",
    readingLevel: "standard",
  };

  const mockSetDyslexicFont = vi.fn();
  const mockSetReducedMotion = vi.fn();
  const mockSetReadingLevel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAccessibilityPreferences.mockReturnValue({
      prefs: mockPrefs,
      setDyslexicFont: mockSetDyslexicFont,
      setReducedMotion: mockSetReducedMotion,
      setReadingLevel: mockSetReadingLevel,
    });
  });

  it("restores focus to the trigger button when closed", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole("button", { name: /accessibility settings/i });

    // Open the panel
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeDefined();

    // Focus something inside
    const dyslexicCheckbox = screen.getByLabelText(/dyslexic-friendly font/i);
    dyslexicCheckbox.focus();
    expect(document.activeElement).toBe(dyslexicCheckbox);

    // Close the panel using the close button
    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);

    // Verify focus is restored to trigger
    expect(document.activeElement).toBe(trigger);
  });

  it("restores focus to the trigger button when closed via Escape key", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole("button", { name: /accessibility settings/i });

    // Open the panel
    fireEvent.click(trigger);

    // Close via Escape
    fireEvent.keyDown(document, { key: "Escape" });

    // Verify focus is restored
    expect(document.activeElement).toBe(trigger);
  });

  it("traps focus within the panel when tabbing", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole("button", { name: /accessibility settings/i });

    // Open
    fireEvent.click(trigger);

    // Manually find focusable elements in order
    const popover = screen.getByRole("dialog");
    const focusableElements = popover.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    // Focus last, then Tab -> should go to first
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    // Focus first, then Shift+Tab -> should go to last
    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
