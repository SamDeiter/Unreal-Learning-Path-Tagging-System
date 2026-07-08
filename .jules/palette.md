## 2025-05-15 - Accessibility Focus Restoration in Popovers
**Learning:** Dialogs and popovers (like the `AccessibilityPanel`) often neglect focus restoration, which breaks the flow for keyboard and screen reader users. Simply closing the portal is not enough; the focus must explicitly return to the element that triggered the panel.
**Action:** Always implement focus-return logic in modal-like components. In React, this can be done by tracking the `open` state change with `useRef` and calling `triggerRef.current?.focus()` when transitioning from open to closed.
