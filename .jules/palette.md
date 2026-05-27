## 2025-05-27 - OS-Aware Shortcut Hints & Keyboard Accessibility
**Learning:** Hardcoding "Ctrl" in keyboard shortcut hints is a common UX papercut for Mac users. Centralizing platform detection allows for more professional "⌘" hints. Additionally, custom interactive elements (like `div` dropzones) with `role="button"` must explicitly handle `onKeyDown` for Enter/Space to be truly accessible to keyboard-only users.
**Action:** Always use `MODIFIER_KEY` from `osUtils.js` for keyboard hints and ensure all `role="button"` elements have corresponding keyboard listeners.
