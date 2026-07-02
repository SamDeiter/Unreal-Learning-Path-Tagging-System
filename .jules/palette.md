## 2025-03-24 - AccessibilityPanel UX and Accessibility Improvements

**Learning:** Interactive popovers and dialogs must maintain keyboard focus state by returning focus to the trigger element upon closure. Using semantic icons (Lucide) over emojis provides a more professional and accessible interface, as screen readers handle them more predictably with proper aria-hidden attributes.

**Action:** Always implement focus return logic in `useEffect` or cleanup functions for modal-like components. Use `aria-haspopup="dialog"` on triggers and `aria-modal="true"` on the containers to signal the component's behavior to assistive technologies.
