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
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { Settings, X } from "lucide-react";
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
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  const wasOpen = useRef(false);
  useEffect(() => {
    if (!open && wasOpen.current) {
      triggerRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const POPOVER_WIDTH = 240;
    const GAP = 6;
    const updatePosition = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const popoverHeight = popoverRef.current?.offsetHeight ?? 280;
      const left = Math.min(
        Math.max(8, r.left),
        window.innerWidth - POPOVER_WIDTH - 8
      );
      const top = Math.max(8, r.top - popoverHeight - GAP);
      setPos({ left, top });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (
        !popoverRef.current?.contains(e.target) &&
        !triggerRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "Tab" && popoverRef.current) {
        const focusables = popoverRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`a11y-panel ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        className="a11y-panel__trigger"
        aria-label="Accessibility settings"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Accessibility settings"
        onClick={() => setOpen((v) => !v)}
      >
        <Settings size={14} aria-hidden="true" />
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          className="a11y-panel__popover"
          role="dialog"
          aria-modal="true"
          aria-label="Accessibility settings"
          style={{ left: pos.left, top: pos.top }}
        >
          <div className="a11y-panel__header">
            <strong>Accessibility</strong>
            <button
              type="button"
              className="a11y-panel__close"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              <X size={14} aria-hidden="true" />
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
        </div>,
        document.body
      )}
    </div>
  );
}

AccessibilityPanel.propTypes = {
  className: PropTypes.string,
};
