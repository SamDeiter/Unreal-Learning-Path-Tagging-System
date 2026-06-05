# Palette's Journal - UX & Accessibility Learnings

## 2025-05-22 - Accessible Toggle Groups
**Learning:** Toggle buttons (e.g., engine selection) should be grouped in a container with `role="group"` and a descriptive `aria-label`. Individual buttons must use `aria-pressed` to indicate their active state to screen readers.
**Action:** Always wrap toggle-like button sets in a `role="group"` and use `aria-pressed` for the active state.

## 2025-05-22 - Icon-only Button Labels
**Learning:** Icon-only buttons (like the '×' delete button in history) are invisible to screen readers if they only have a visual `title`. They require an explicit `aria-label`.
**Action:** Ensure all icon-only buttons have a descriptive `aria-label`.
