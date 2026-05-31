## 2025-05-14 - OS-Aware Shortcut Hints
**Learning:** Hardcoded "Ctrl" hints in the UI create friction for Mac users, as they intuitively reach for "⌘". Simply changing the text is not enough; the underlying event listeners must also be updated to handle `metaKey` to avoid a "lying" UI.
**Action:** Use a centralized `osUtils.js` to detect the platform and export a `MODIFIER_KEY`. Always update keyboard handlers to support `(e.ctrlKey || e.metaKey)` when displaying this dynamic modifier.
