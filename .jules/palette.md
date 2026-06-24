## 2025-03-24 - [Accessible Deletion Pattern]
**Learning:** To avoid invalid nested button violations in interactive lists, the container should be a `div` with `role="button"` and `tabIndex={0}`. When an item is deleted, programmatic focus must be moved to a neighbor to prevent focus loss.
**Action:** Use `role="button"` for cards with internal actions and implement a focus-restoration strategy using `useRef` and query selectors.
