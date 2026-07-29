# Palette's Journal - Critical UX/Accessibility Learnings

## 2025-07-29 - Lucide Icon Standardization and Popover A11y
**Learning:** Using literal emojis for key actions (e.g. ⚙️, ×, 🔊) compromises visual styling control and screen-reader accessibility. Incorporating native SVG icons via `lucide-react` paired with explicit keyboard trapping and focus restoration on toggle components creates a seamless, standard-compliant experience.
**Action:** Replace arbitrary emojis with semantic `lucide-react` components (`Settings`, `X`, `Volume2`, `Pause`, `Play`). Implement focus trapping and a `wasOpen` ref pattern for modal and popover dialogs to ensure keyboard-only navigation does not lose context upon panel closure.
