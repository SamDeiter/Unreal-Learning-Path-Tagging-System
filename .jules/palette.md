## 2025-03-24 - AccessibilityPanel Keyboard UX
**Learning:** Dialogs and popovers using `createPortal` do not automatically manage focus or trap it. Without explicit handling, keyboard users lose their place when the panel opens or closes, and can tab "behind" the modal into the main page content.
**Action:** Always implement programmatic auto-focus on open, focus-return on close, and a focus trap for modal components. Use `:focus-visible` to ensure clear indicators for keyboard users without adding noise for mouse users.
