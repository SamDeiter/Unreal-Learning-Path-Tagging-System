## 2025-05-22 - [Standardize Accessibility for Loading and Status States]
**Learning:** Purely visual elements like loading spinners and status icons (emojis) must be handled explicitly with ARIA attributes to ensure inclusive design. `role="status"` and `aria-live="polite"` are essential for async feedback, while `aria-hidden="true"` prevents screen reader noise from decorative icons.
**Action:** Always apply `role="status"`/`aria-live` to loading containers and `aria-hidden` to decorative icons/emojis in this design system. Add unit tests in `component-smoke.test.jsx` to verify these attributes.

## 2025-05-15 - [A11y Audit: Loading States & Toggle Buttons]
**Learning:** Purely decorative icons and animations (like spinners or emojis) must be hidden from screen readers using `aria-hidden="true"` to avoid verbal clutter. Complex loading states should use `role="status"` and `aria-live="polite"` to communicate progress without interrupting the user's current task. Toggle buttons must use `aria-pressed` to communicate their state, as visual-only active classes (e.g. `.active`) are not accessible.
**Action:** Always wrap visual-only icons in `aria-hidden="true"` and ensure interactive state changes are reflected with standard ARIA attributes (`aria-pressed`, `aria-expanded`, etc.).
