## 2025-05-15 - Platform-Aware Keyboard Shortcuts
**Learning:** Hardcoding "Ctrl" in UI hints alienates Mac users who expect "⌘". Keyboard event listeners that only check `e.ctrlKey` also fail for Mac users who naturally use `e.metaKey`.
**Action:** Always use a platform detection utility for shortcut hints and support both `ctrlKey` and `metaKey` in event handlers to ensure cross-platform accessibility.

## 2025-05-15 - Icon-Only Button Accessibility
**Learning:** Buttons containing only icons (like '×' for delete) are inaccessible to screen readers if they lack `aria-label`. The `title` attribute is not a substitute for `aria-label`.
**Action:** Always provide descriptive `aria-label` for icon-only interactive elements, ensuring they are uniquely identifiable (e.g., including the item name in the label).
