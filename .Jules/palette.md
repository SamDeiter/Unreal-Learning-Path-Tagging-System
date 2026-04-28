## 2025-05-22 - [Standardize Accessibility for Loading and Status States]
**Learning:** Purely visual elements like loading spinners and status icons (emojis) must be handled explicitly with ARIA attributes to ensure inclusive design. `role="status"` and `aria-live="polite"` are essential for async feedback, while `aria-hidden="true"` prevents screen reader noise from decorative icons.
**Action:** Always apply `role="status"`/`aria-live` to loading containers and `aria-hidden` to decorative icons/emojis in this design system. Add unit tests in `component-smoke.test.jsx` to verify these attributes.

## 2025-05-23 - [Avoid Redundant ARIA Nesting]
**Learning:** Avoid nesting `aria-hidden="true"` attributes. When wrapping symbols (like expand arrows) in a container that already has `aria-hidden="true"`, applying it again to child nodes adds unnecessary DOM complexity without improving accessibility.
**Action:** Ensure `aria-hidden` is applied at the highest necessary level for a decorative group and avoid repeating it on child elements.
