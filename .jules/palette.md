## 2025-05-22 - [Loading State Accessibility]
**Learning:** Generic loading spinners are often invisible to screen readers if they don't have the correct ARIA roles. Adding `role="status"` and `aria-live="polite"` ensures that users are notified when an operation is in progress without being interrupted.
**Action:** Always wrap loading indicators in a container with `role="status"` and `aria-live="polite"`, and hide decorative visual elements with `aria-hidden="true"`.
