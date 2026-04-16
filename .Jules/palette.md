## 2025-05-22 - [Standardize Accessibility for Loading and Status States]
**Learning:** Purely visual elements like loading spinners and status icons (emojis) must be handled explicitly with ARIA attributes to ensure inclusive design. `role="status"` and `aria-live="polite"` are essential for async feedback, while `aria-hidden="true"` prevents screen reader noise from decorative icons.
**Action:** Always apply `role="status"`/`aria-live` to loading containers and `aria-hidden` to decorative icons/emojis in this design system. Add unit tests in `component-smoke.test.jsx` to verify these attributes.

## 2025-05-23 - [Resilient UI Testing with Accessible Icons]
**Learning:** Wrapping decorative emojis or icons in spans with `aria-hidden="true"` (for accessibility) splits text nodes in the DOM. This causes exact string matchers in tests (like `screen.getByText('🔬 Diagnosis')`) to fail.
**Action:** Use flexible regex matchers (e.g., `screen.getByText(/Diagnosis/)`) in unit tests when elements contain both text and decorative symbols to ensure tests remain resilient to accessibility improvements.
