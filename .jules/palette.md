## 2026-05-05 - FeedbackModal Accessibility & UX Polish
**Learning:** Adding a character counter with `aria-live="polite"` and `aria-describedby` provides critical feedback for limited text inputs, especially for screen reader users who might otherwise not know they are approaching a limit until it's too late. Also, ensure that global animations like `spin` are defined in a shared stylesheet if used across multiple components.
**Action:** Always link character counters to their inputs using `aria-describedby` and define standard `@keyframes` in `index.css`.
