## 2025-05-15 - Improving Portal-based Popover Accessibility
**Learning:** Dialogs and popovers using `createPortal` (such as the `AccessibilityPanel`) do not automatically manage focus; focus must be explicitly moved into the portal when opened and returned to the trigger when closed. Additionally, a focus trap is required to prevent the Tab key from leaving the dialog and interacting with the background page.
**Action:** Always implement programmatic focus management (auto-focus first element, focus restoration) and a focus trap for any portal-rendered interactive dialog.
