## 2026-05-11 - Accessibility for Toggle Button Groups
**Learning:** Icon-only or text-based toggle buttons in a group (like feedback type selection) are often opaque to screen readers without explicit ARIA roles. Using `role="group"` on the container and `aria-pressed` on the buttons correctly communicates the selection state.
**Action:** Always wrap selection button groups in a `role="group"` with an `aria-label`, and use `aria-pressed` for the active state.

## 2026-05-11 - Live Character Counts for Text Inputs
**Learning:** Users benefit from knowing the length of their input in real-time, especially when there might be unstated backend limits or for general situational awareness. It adds a "premium" feel to simple forms.
**Action:** Implement a simple `.length` counter display below textareas to provide immediate input feedback.
