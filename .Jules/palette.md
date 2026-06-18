## 2025-05-14 - Recent Query Deletion UX
**Learning:** Users need a way to manage their local interaction history for privacy and focus. Providing a discrete delete action on hover/focus for recent query cards balances a clean UI with necessary control.
**Action:** Always implement individual item deletion for local history stores, ensuring event propagation is stopped to avoid triggering the primary action of the item.
