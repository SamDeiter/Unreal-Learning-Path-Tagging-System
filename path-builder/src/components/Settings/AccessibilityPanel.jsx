/**
 * AccessibilityPanel — UDL settings popover (Phase 3).
 *
 * Lightweight toggle panel for the persistent UDL preferences:
 *   - Dyslexic-friendly font (boolean)
 *   - Reduced motion mode (system / always-on / always-off)
 *   - Reading level (simple / standard / advanced) — threaded to Gemini prompts
 *
 * Discoverable via a small gear icon mounted in the sidebar. State is held by
 * useAccessibilityPreferences() which persists to localStorage and mirrors to
 * <html data-font> / <html data-motion> so the global stylesheet applies.
 * `readingLevel` is not a CSS hook — it rides into lesson/problem-first
 * callables so the tutor prose matches the learner's chosen altitude.
 */
import { useState } from "react";
import PropTypes from "prop-types";
import useAccessibilityPreferences from "../../hooks/useAccessibilityPreferences";
import "./AccessibilityPanel.css";

const READING_LEVELS = [
  { v: "simple", l: "Simple", hint: "Middle-school tone; analogies over jargon." },
  { v: "standard", l: "Standard", hint: "Default tutor voice for most learners." },
  { v: "advanced", l: "Advanced", hint: "Graduate tone; assumes domain terminology." },
];

export default function AccessibilityPanel({ className = "" }) {
  const { prefs, setDyslexicFont, setReducedMotion, setReadingLevel } =
    useAccessibilityPreferences();
  const [open, setOpen] = useState(false);

  return (
    <div className={`a11y-panel ${className}`.trim()}>
      <button
        type="button"
        className="a11y-panel__trigger"
        aria-label="Accessibility settings"
        aria-expanded={open}
        title="Accessibility settings"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">⚙️</span>
      </button>

      {open && (
        <div className="a11y-panel__popover" role="dialog" aria-label="Accessibility settings">
          <div className="a11y-panel__header">
            <strong>Accessibility</strong>
            <button
              type="button"
              className="a11y-panel__close"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="a11y-panel__row">
            <label className="a11y-panel__label" htmlFor="a11y-dyslexic-font">
              Dyslexic-friendly font
            </label>
            <input
              id="a11y-dyslexic-font"
              type="checkbox"
              checked={!!prefs.dyslexicFont}
              onChange={(e) => setDyslexicFont(e.target.checked)}
            />
          </div>

          <div className="a11y-panel__row a11y-panel__row--stack">
            <span className="a11y-panel__label">Motion</span>
            <div className="a11y-panel__segmented" role="radiogroup" aria-label="Motion preference">
              {[
                { v: "system", l: "System" },
                { v: "always-on", l: "On" },
                { v: "always-off", l: "Off" },
              ].map(({ v, l }) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={prefs.reducedMotion === v}
                  className={`a11y-panel__seg ${prefs.reducedMotion === v ? "is-active" : ""}`}
                  onClick={() => setReducedMotion(v)}
                >
                  {l}
                </button>
              ))}
            </div>
            <p className="a11y-panel__hint">
              “System” follows your OS reduce-motion setting.
            </p>
          </div>

          <div className="a11y-panel__row a11y-panel__row--stack">
            <span className="a11y-panel__label">Reading level</span>
            <div
              className="a11y-panel__segmented"
              role="radiogroup"
              aria-label="Reading level preference"
            >
              {READING_LEVELS.map(({ v, l }) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={prefs.readingLevel === v}
                  className={`a11y-panel__seg ${prefs.readingLevel === v ? "is-active" : ""}`}
                  onClick={() => setReadingLevel(v)}
                >
                  {l}
                </button>
              ))}
            </div>
            <p className="a11y-panel__hint">
              {READING_LEVELS.find((r) => r.v === prefs.readingLevel)?.hint ||
                READING_LEVELS[1].hint}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

AccessibilityPanel.propTypes = {
  className: PropTypes.string,
};
