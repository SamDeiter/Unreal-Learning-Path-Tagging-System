## 2025-05-15 - Hover-Reveal Accessibility Pattern
**Learning:** Interactive elements that are hidden by default (e.g., delete buttons visible only on hover) must be made visible when the parent container receives focus to ensure keyboard accessibility. Using `:focus-within` on the wrapper and `:focus-visible` on the element itself ensures screen reader and keyboard users can discover and interact with "hidden" controls.
**Action:** Always pair hover-based reveal logic with `:focus-within` visibility rules and ensure the revealed element has distinct `:focus-visible` styles.
