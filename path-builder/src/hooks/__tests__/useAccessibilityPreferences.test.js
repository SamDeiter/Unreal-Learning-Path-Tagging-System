/**
 * useAccessibilityPreferences — unit tests.
 *
 * Verifies:
 *   - defaults when localStorage is empty
 *   - persists across updates under "udl-prefs-v1"
 *   - applies data-font / data-motion to <html> on mount and on change
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useAccessibilityPreferences, {
  STORAGE_KEY,
} from "../useAccessibilityPreferences";

describe("useAccessibilityPreferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-font");
    document.documentElement.removeAttribute("data-motion");
  });

  it("returns defaults when localStorage is empty", () => {
    const { result } = renderHook(() => useAccessibilityPreferences());
    expect(result.current.prefs.dyslexicFont).toBe(false);
    expect(result.current.prefs.reducedMotion).toBe("system");
  });

  it("applies data-attrs to <html> on mount for defaults (no attrs)", () => {
    renderHook(() => useAccessibilityPreferences());
    expect(document.documentElement.getAttribute("data-font")).toBeNull();
    expect(document.documentElement.getAttribute("data-motion")).toBeNull();
  });

  it("persists dyslexicFont to localStorage and mirrors to <html>", () => {
    const { result } = renderHook(() => useAccessibilityPreferences());

    act(() => {
      result.current.setDyslexicFont(true);
    });

    expect(result.current.prefs.dyslexicFont).toBe(true);
    expect(document.documentElement.getAttribute("data-font")).toBe("dyslexic");
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(stored.dyslexicFont).toBe(true);
  });

  it("persists reducedMotion and mirrors to <html>", () => {
    const { result } = renderHook(() => useAccessibilityPreferences());

    act(() => {
      result.current.setReducedMotion("always-off");
    });
    expect(document.documentElement.getAttribute("data-motion")).toBe("always-off");

    act(() => {
      result.current.setReducedMotion("always-on");
    });
    expect(document.documentElement.getAttribute("data-motion")).toBe("always-on");

    act(() => {
      result.current.setReducedMotion("system");
    });
    expect(document.documentElement.getAttribute("data-motion")).toBeNull();

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(stored.reducedMotion).toBe("system");
  });

  it("rejects invalid reducedMotion values (falls back to system)", () => {
    const { result } = renderHook(() => useAccessibilityPreferences());

    act(() => {
      result.current.setReducedMotion("garbage");
    });

    expect(result.current.prefs.reducedMotion).toBe("system");
  });

  it("reads persisted prefs on initial mount", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ dyslexicFont: true, reducedMotion: "always-off" })
    );
    const { result } = renderHook(() => useAccessibilityPreferences());
    expect(result.current.prefs.dyslexicFont).toBe(true);
    expect(result.current.prefs.reducedMotion).toBe("always-off");
    expect(document.documentElement.getAttribute("data-font")).toBe("dyslexic");
    expect(document.documentElement.getAttribute("data-motion")).toBe("always-off");
  });

  it("falls back to defaults when stored JSON is corrupt", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not valid json");
    const { result } = renderHook(() => useAccessibilityPreferences());
    expect(result.current.prefs.dyslexicFont).toBe(false);
    expect(result.current.prefs.reducedMotion).toBe("system");
  });

  // ── Phase 3 — readingLevel (tutor prompt preference) ──────────────
  it("defaults readingLevel to 'standard'", () => {
    const { result } = renderHook(() => useAccessibilityPreferences());
    expect(result.current.prefs.readingLevel).toBe("standard");
  });

  it("persists readingLevel to localStorage under the shared key", () => {
    const { result } = renderHook(() => useAccessibilityPreferences());

    act(() => {
      result.current.setReadingLevel("simple");
    });
    expect(result.current.prefs.readingLevel).toBe("simple");
    let stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(stored.readingLevel).toBe("simple");

    act(() => {
      result.current.setReadingLevel("advanced");
    });
    expect(result.current.prefs.readingLevel).toBe("advanced");
    stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(stored.readingLevel).toBe("advanced");
  });

  it("rejects invalid readingLevel values (falls back to 'standard')", () => {
    const { result } = renderHook(() => useAccessibilityPreferences());

    act(() => {
      result.current.setReadingLevel("phd-plus");
    });

    expect(result.current.prefs.readingLevel).toBe("standard");
  });

  it("defaults readingLevel when reading an older-shape stored blob (backwards compat)", () => {
    // Simulate a pre-Phase-3 stored blob that doesn't include readingLevel
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ dyslexicFont: true, reducedMotion: "always-off" })
    );
    const { result } = renderHook(() => useAccessibilityPreferences());
    expect(result.current.prefs.dyslexicFont).toBe(true);
    expect(result.current.prefs.reducedMotion).toBe("always-off");
    expect(result.current.prefs.readingLevel).toBe("standard");
  });

  it("reads a persisted readingLevel on initial mount", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        dyslexicFont: false,
        reducedMotion: "system",
        readingLevel: "advanced",
      })
    );
    const { result } = renderHook(() => useAccessibilityPreferences());
    expect(result.current.prefs.readingLevel).toBe("advanced");
  });

  it("does not mirror readingLevel to <html> data-attrs (it is a prompt-only pref)", () => {
    const { result } = renderHook(() => useAccessibilityPreferences());

    act(() => {
      result.current.setReadingLevel("simple");
    });

    // readingLevel is threaded through to Gemini, not applied as a CSS hook.
    expect(document.documentElement.getAttribute("data-reading-level")).toBeNull();
  });
});
