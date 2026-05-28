## 2025-05-15 - OS-aware Keyboard Shortcut Hints
**Learning:** Users on different operating systems expect different keyboard shortcuts (e.g., ⌘ vs Ctrl). Providing hardcoded "Ctrl" hints on macOS can be confusing and reduces the perceived quality of the application.
**Action:** Always use a centralized utility like `osUtils.js` to detect the platform and provide dynamic `MODIFIER_KEY` hints in the UI. Ensure event handlers also support both `ctrlKey` and `metaKey` where appropriate.
