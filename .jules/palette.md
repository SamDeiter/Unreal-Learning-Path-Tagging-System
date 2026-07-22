## 2026-07-22 - Accessibility and Consistency of Portal-based Modal Dialogs

**Learning:** Portal-rendered interactive components like the `AccessibilityPanel` must explicitly implement focus trapping (Tab/Shift+Tab) and focus restoration to prevent keyboard focus from being lost in the outer document body upon opening/closing, and should avoid using raw emojis/ASCII characters to maintain design system consistency.

**Action:** Implement focus-trapping inside the `keydown` event listener of the dialog container, restore focus back to the triggering element using a `wasOpen` state tracker only upon closing, and replace emojis with semantic `lucide-react` icons.
