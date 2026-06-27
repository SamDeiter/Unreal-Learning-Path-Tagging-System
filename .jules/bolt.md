## 2025-03-24 - Module-level caching for localStorage services
**Learning:** Synchronous `localStorage.getItem` and `JSON.parse` operations inside hot loops (e.g., `applyFeedbackMultiplier` during video ranking) can cause significant latency as the feedback data grows.
**Action:** Use module-level caching in the service to ensure `localStorage` is read and parsed only once. Always export a reset function for tests to prevent state leakage.

## 2025-03-24 - React.memo for high-frequency list items
**Learning:** `VideoResultCard` components were re-rendering in bulk whenever the parent shopping cart state updated, even if the specific card's `isAdded` status or video data hadn't changed.
**Action:** Wrap individual result items in `memo()` to skip re-renders when props are shallowly equal, significantly improving UI responsiveness during cart interactions.
