## 2025-05-22 - [Standardize Accessibility for Loading and Status States]
**Learning:** Purely visual elements like loading spinners and status icons (emojis) must be handled explicitly with ARIA attributes to ensure inclusive design. `role="status"` and `aria-live="polite"` are essential for async feedback, while `aria-hidden="true"` prevents screen reader noise from decorative icons.
**Action:** Always apply `role="status"`/`aria-live` to loading containers and `aria-hidden` to decorative icons/emojis in this design system. Add unit tests in `component-smoke.test.jsx` to verify these attributes.

## 2025-05-23 - [Communicating State in Collapsible Navigation]
**Learning:** Expandable sidebar items (like "Path Builders" or "Analytics") must use `aria-expanded` to communicate their visibility state to screen readers. Unicode arrows used as indicators should be hidden with `aria-hidden="true"` to avoid confusing screen reader output.
**Action:** Ensure all toggleable or expandable components in the sidebar or similar navigation menus implement `aria-expanded` on the trigger button and hide decorative state icons.
