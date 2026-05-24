## 2025-05-14 - Interactive Component Accessibility
**Learning:** In this design system, custom interactive elements (like the image dropzone) are often implemented using `div` with `role="button"` and `tabIndex={0}`. These elements lack native keyboard support and visual focus indicators, making them inaccessible to keyboard-only users.
**Action:** Always pair `role="button"` and `tabIndex={0}` with an `onKeyDown` handler (supporting Enter and Space) and a CSS `:focus-visible` state. For visual progress indicators, always use `role="progressbar"` with appropriate ARIA attributes.
