## 2026-05-07 - [Accessible Loading States]
**Learning:** For multi-phase AI operations like the `DiagnosisLoader`, simply showing a spinner is insufficient for screen readers. Using `role="status"` and `aria-live="polite"` on the container ensures phase transitions are announced, while `role="progressbar"` with `aria-valuetext` provides context for the current step.
**Action:** Always implement ARIA live regions and progress attributes for async operations that replace main content.
