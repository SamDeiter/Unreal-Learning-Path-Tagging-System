## 2025-05-15 - [Individual Recent Query Deletion]
**Learning:** Users need a way to manage their local search history. Providing a way to delete individual items improves privacy and reduces clutter without requiring a "clear all" action that might be too destructive.
**Action:** When implementing lists of history or saved items, always include an individual delete action. Ensure it uses `e.stopPropagation()` if the list item is also a link/button, and make the delete action accessible via keyboard focus (`:focus-within`).
