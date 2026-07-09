import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AccessibilityPanel from "../AccessibilityPanel";
import useAccessibilityPreferences from "../../../hooks/useAccessibilityPreferences";

// Mock the hook
vi.mock("../../../hooks/useAccessibilityPreferences", () => ({
  default: vi.fn(),
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  Settings: () => <div data-testid="settings-icon" />,
  X: () => <div data-testid="close-icon" />,
}));

describe("AccessibilityPanel", () => {
  const mockPrefs = {
    dyslexicFont: false,
    reducedMotion: "system",
    readingLevel: "standard",
  };
  const setDyslexicFont = vi.fn();
  const setReducedMotion = vi.fn();
  const setReadingLevel = vi.fn();

  beforeEach(() => {
    vi.mocked(useAccessibilityPreferences).mockReturnValue({
      prefs: mockPrefs,
      setDyslexicFont,
      setReducedMotion,
      setReadingLevel,
    });
  });

  it("renders the trigger button with correct attributes", () => {
    render(<AccessibilityPanel />);
    const button = screen.getByRole("button", { name: /accessibility settings/i });
    expect(button).toBeTruthy();
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByTestId("settings-icon")).toBeTruthy();
  });

  it("opens the panel when clicked", () => {
    render(<AccessibilityPanel />);
    const button = screen.getByRole("button", { name: /accessibility settings/i });
    fireEvent.click(button);

    expect(button.getAttribute("aria-expanded")).toBe("true");
    const dialog = screen.getByRole("dialog", { name: /accessibility settings/i });
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("Accessibility")).toBeTruthy();
    expect(screen.getByTestId("close-icon")).toBeTruthy();
  });

  it("returns focus to trigger when closed via Close button", () => {
    render(<AccessibilityPanel />);
    const button = screen.getByRole("button", { name: /accessibility settings/i });
    fireEvent.click(button);

    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);

    expect(document.activeElement).toBe(button);
  });

  it("returns focus to trigger when closed via Escape key", () => {
    render(<AccessibilityPanel />);
    const button = screen.getByRole("button", { name: /accessibility settings/i });
    fireEvent.click(button);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(document.activeElement).toBe(button);
  });
});
