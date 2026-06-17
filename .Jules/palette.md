## 2026-06-17 - Accessibility & Keyboard Navigation in Interactive Inputs
**Learning:** Interactive components like engine toggles and history chips frequently lack clear focus indicators for keyboard-only users. Furthermore, decorative icons within buttons or headers can create noise for screen readers if not properly hidden.
**Action:** Always implement `:focus-visible` for custom interactive elements to provide visual feedback without affecting mouse users. Use `aria-pressed` for toggles and `aria-hidden="true"` for decorative icons to maintain a clean and semantic accessibility tree.
