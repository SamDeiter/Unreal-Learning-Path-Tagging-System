## 2025-05-15 - Syncing Animations for Hover Effects
**Learning:** When adding interactive elements (like delete buttons) that should appear on hover to a component that also has its own hover effect (like a transform: translateY), they must be wrapped in a shared container that handles the transform.
**Action:** Wrap the component and the new element in a 'card-wrapper' div and apply the hover transform to the wrapper to ensure both move together smoothly.
