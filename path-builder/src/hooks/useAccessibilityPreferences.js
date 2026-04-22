/**
 * useAccessibilityPreferences — UDL preferences hook (Phase 3 tutor roadmap).
 *
 * Single source of truth for user-controlled accessibility preferences.
 * Reads/writes to localStorage under key "udl-prefs-v1" and mirrors the
 * current state onto <html> via data-attributes so CSS can target it:
 *
 *   html[data-font="dyslexic"]        → switches body font to dyslexic-friendly stack
 *   html[data-motion="always-off"]    → forces reduced-motion regardless of OS
 *   html[data-motion="always-on"]     → forces full animations regardless of OS
 *   (no attribute / "system")         → defers to prefers-reduced-motion
 *
 * `readingLevel` is a tutor-prompt preference (not a CSS hook): it rides
 * the same localStorage entry but is threaded through to Gemini via the
 * generateLesson / queryLearningPath callable payloads so the model can
 * tune its prose to "simple" | "standard" | "advanced".
 *
 * Returns { prefs, setDyslexicFont, setReducedMotion, setReadingLevel }.
 */
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "udl-prefs-v1";

const DEFAULT_PREFS = {
  dyslexicFont: false,
  reducedMotion: "system", // "system" | "always-on" | "always-off"
  readingLevel: "standard", // "simple" | "standard" | "advanced"
};

const VALID_MOTION = new Set(["system", "always-on", "always-off"]);
const VALID_READING_LEVEL = new Set(["simple", "standard", "advanced"]);

function readPrefs() {
  if (typeof window === "undefined" || !window.localStorage) return { ...DEFAULT_PREFS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    return {
      dyslexicFont: typeof parsed.dyslexicFont === "boolean" ? parsed.dyslexicFont : false,
      reducedMotion: VALID_MOTION.has(parsed.reducedMotion) ? parsed.reducedMotion : "system",
      // Older-shape guard: pre-Phase-3 reads won't have readingLevel — default to "standard"
      readingLevel: VALID_READING_LEVEL.has(parsed.readingLevel) ? parsed.readingLevel : "standard",
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function writePrefs(prefs) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // quota exceeded / disabled — fail silently
  }
}

/**
 * Apply prefs to <html> via data-attributes. Exposed so main.jsx can pre-paint
 * before React mounts if desired (keeps the hook itself pure side-effect on mount).
 */
export function applyPrefsToDocument(prefs) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (!html) return;
  if (prefs.dyslexicFont) {
    html.setAttribute("data-font", "dyslexic");
  } else {
    html.removeAttribute("data-font");
  }
  if (prefs.reducedMotion && prefs.reducedMotion !== "system") {
    html.setAttribute("data-motion", prefs.reducedMotion);
  } else {
    html.removeAttribute("data-motion");
  }
}

export default function useAccessibilityPreferences() {
  const [prefs, setPrefs] = useState(() => readPrefs());

  // Apply on mount & whenever prefs change
  useEffect(() => {
    applyPrefsToDocument(prefs);
    writePrefs(prefs);
  }, [prefs]);

  const setDyslexicFont = useCallback((value) => {
    setPrefs((p) => ({ ...p, dyslexicFont: !!value }));
  }, []);

  const setReducedMotion = useCallback((value) => {
    const v = VALID_MOTION.has(value) ? value : "system";
    setPrefs((p) => ({ ...p, reducedMotion: v }));
  }, []);

  const setReadingLevel = useCallback((value) => {
    const v = VALID_READING_LEVEL.has(value) ? value : "standard";
    setPrefs((p) => ({ ...p, readingLevel: v }));
  }, []);

  return { prefs, setDyslexicFont, setReducedMotion, setReadingLevel };
}

export { STORAGE_KEY, DEFAULT_PREFS };
