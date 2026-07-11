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

  beforeEach(() => {
    useAccessibilityPreferences.mockReturnValue({
      prefs: mockPrefs,
      setDyslexicFont: vi.fn(),
      setReducedMotion: vi.fn(),
      setReadingLevel: vi.fn(),
    });
  });

  it("renders the trigger button with correct ARIA attributes", () => {
    render(<AccessibilityPanel />);
    const button = screen.getByRole("button", { name: /accessibility settings/i });
    expect(button).toBeDefined();
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("opens the panel when clicked and has aria-modal", () => {
    render(<AccessibilityPanel />);
    const button = screen.getByRole("button", { name: /accessibility settings/i });
    fireEvent.click(button);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("returns focus to trigger when closed", () => {
    render(<AccessibilityPanel />);
    const button = screen.getByRole("button", { name: /accessibility settings/i });

    // Open
    fireEvent.click(button);
    expect(screen.getByRole("dialog")).toBeDefined();

    // Close via Close button
    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(button);
  });
});
