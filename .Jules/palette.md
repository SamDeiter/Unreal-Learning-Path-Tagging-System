## 2025-05-22 - [Standardize Accessibility for Loading and Status States]
**Learning:** Purely visual elements like loading spinners and status icons (emojis) must be handled explicitly with ARIA attributes to ensure inclusive design. `role="status"` and `aria-live="polite"` are essential for async feedback, while `aria-hidden="true"` prevents screen reader noise from decorative icons.
**Action:** Always apply `role="status"`/`aria-live` to loading containers and `aria-hidden` to decorative icons/emojis in this design system. Add unit tests in `component-smoke.test.jsx` to verify these attributes.

## 2025-05-23 - [Accessible Complex Navigation and Progress Indicators]
**Learning:** For multi-stage loaders and expandable sidebars, `aria-expanded` and `role="progressbar"` are critical for screen reader users to understand the current application state and available actions. Decorative status icons in progress lists should be hidden to avoid redundant announcements.
**Action:** Use `aria-expanded` on all toggle buttons that control sub-menus or sections. Implement `role="progressbar"` with `aria-valuenow` for multi-step loading phases. Ensure all decorative icons in these high-interaction areas have `aria-hidden="true"`.
