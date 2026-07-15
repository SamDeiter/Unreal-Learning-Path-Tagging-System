import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AccessibilityPanel from "../AccessibilityPanel";

vi.mock("../../../hooks/useAccessibilityPreferences", () => ({
  default: () => ({
    prefs: { dyslexicFont: false, reducedMotion: "system", readingLevel: "standard" },
    setDyslexicFont: vi.fn(), setReducedMotion: vi.fn(), setReadingLevel: vi.fn(),
  }),
}));

describe("AccessibilityPanel", () => {
  it("verifies A11y attributes and focus restoration", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole("button", { name: /accessibility settings/i });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(trigger).toHaveFocus();
  });
});
