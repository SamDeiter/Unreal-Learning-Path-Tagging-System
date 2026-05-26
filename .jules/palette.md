## 2025-05-14 - OS-Aware Keyboard Shortcuts
**Learning:** Hardcoded 'Ctrl' hints in the UI are misleading for macOS users who expect '⌘'. Centralizing OS detection allows for platform-accurate hints across all input components.
**Action:** Use `MODIFIER_KEY` from `osUtils.js` for all keyboard shortcut hints in JSX to ensure platform parity.

## 2025-05-14 - Accessible Icon-Only Buttons
**Learning:** Visual 'title' attributes on icon-only buttons are insufficient for screen readers; they require explicit `aria-label` to communicate action context (e.g., "Remove history item: [query]").
**Action:** Always provide `aria-label` for buttons that do not contain visible text labels, especially in repeating lists like history or search results.
