## 2025-05-22 - Improving LoadingSpinner Accessibility
**Learning:** Loading indicators often fail to communicate their state to screen reader users if they don't use standard ARIA roles like `role="status"` and `aria-live="polite"`. The visual-only spinner should be hidden using `aria-hidden="true"` to reduce screen reader noise.
**Action:** Always wrap loading indicators in a container with `role="status"` and `aria-live="polite"`. Hide decorative visual elements of the indicator.
