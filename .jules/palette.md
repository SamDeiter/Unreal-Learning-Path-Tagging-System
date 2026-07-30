## 2026-05-22 - Focus Restoration and Trap on Settings Popover
**Learning:** Interactive dialogs and popovers (like `AccessibilityPanel`) need explicit focus restoration on close to avoid losing keyboard focus, plus a focus trap inside the popover boundaries to prevent users from tab-navigating background content when the modal settings dialog is active.
**Action:** Use a `wasOpen` ref and keyboard event listeners for Escape/Tab to confine focus within the active overlay, restoring focus to the triggering element once closed.
