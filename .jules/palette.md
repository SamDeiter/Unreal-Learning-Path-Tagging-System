## 2026-05-09 - Accessibility and UX Enhancements for FeedbackModal

**Learning:** The application's feedback and input components often lack clear state communication for screen readers (e.g., active selection states) and visual affordances for constraints like character limits. The absence of a global `.sr-only` utility also makes it difficult to provide necessary context to screen readers without affecting the visual layout.

**Action:** Always ensure interactive elements with a selected state use `aria-pressed` or `aria-selected`. For textareas, provide a live character count using `role="status"` and `aria-live="polite"`, and use `.sr-only` for supplementary labels like "(required)" to maintain clean visual design while staying accessible.
