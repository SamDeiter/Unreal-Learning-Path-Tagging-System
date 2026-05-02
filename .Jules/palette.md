## 2026-05-02 - FeedbackModal Accessibility & UX
**Learning:** Buttons acting as mutually exclusive selectors (like feedback types) should use `aria-pressed` for state signaling rather than `role="radio"` if full keyboard arrow-key navigation isn't implemented. This avoids broken accessibility patterns while still providing clear state feedback to screen readers.
**Action:** Use `aria-pressed` for toggle/selection buttons in simple forms to maintain standard tab-based navigation while improving state visibility.

## 2026-05-02 - Visually Hidden Content
**Learning:** The `.sr-only` utility is essential for providing context to screen reader users (like "(required)" labels) without cluttering the visual interface.
**Action:** Ensure `.sr-only` is available in global CSS for use in component-level accessibility enhancements.
