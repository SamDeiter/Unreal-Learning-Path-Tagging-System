## 2025-03-24 - [Tactile Feedback & Accessibility]
**Learning:** Applying tactile feedback (scale transforms) alongside accessibility attributes (ARIA labels, roles) significantly enhances the "feel" of a highly interactive dashboard. Using `cubic-bezier(0.4, 0, 0.2, 1)` provides a natural, snappy response that users associate with modern design systems.
**Action:** When implementing interactive cards or chips, always combine `:hover { transform: scale(1.1) }` with appropriate ARIA attributes like `aria-pressed` or `role="button"` to ensure both delight and accessibility are maintained.
