## 2025-05-21 - Platform-aware keyboard shortcut hints
**Learning:** Hardcoding 'Ctrl' in UI hints for keyboard shortcuts creates friction for macOS users who primarily use the Command key (⌘). Centralizing platform detection allows for dynamic, operating-system-appropriate hints (e.g., ⌘+K vs Ctrl+K) and ensures underlying event logic handles both meta and control keys consistently.
**Action:** Use a centralized `osUtils.js` to detect the platform and provide a `MODIFIER_KEY` constant for all UI shortcut hints and event listeners.
