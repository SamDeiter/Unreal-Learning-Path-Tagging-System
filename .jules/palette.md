## 2025-05-15 - Popover Focus Management
**Learning:** For interactive popovers (e.g., `AccessibilityPanel`), restoring focus to the trigger element when the panel closes is critical for keyboard accessibility. However, naive implementation in `useEffect` can cause unwanted focus on initial mount.
**Action:** Use a `wasOpen` ref to track state transitions and only trigger focus restoration when `open` changes from `true` to `false`.
