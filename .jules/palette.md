## 2025-05-14 - OS-aware Shortcut Hints
**Learning:** Hardcoding "Ctrl" for keyboard shortcuts in UI hints is a common accessibility/UX oversight for macOS users who expect "⌘" (Command).
**Action:** Use a centralized `osUtils.js` helper to detect the platform and provide a `MODIFIER_KEY` constant for use across all components with keyboard shortcuts (ProblemInput, ChatInput, CourseLibrary).
