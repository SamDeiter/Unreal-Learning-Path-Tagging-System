## 2025-03-24 - Focus Management for List Deletion
**Learning:** When an item is deleted from a list via a button (like a "Remove" button), focus is often lost because the focused element is removed from the DOM. This breaks the experience for keyboard and screen reader users.
**Action:** Always move focus programmatically to a neighboring item (previous or next) or a logical parent container (like a section label) immediately after the deletion to maintain accessibility context.
