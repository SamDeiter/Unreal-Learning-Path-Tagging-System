## 2024-06-03 - Accessible Custom Interactive Elements
**Learning:** Custom interactive elements like `div` dropzones or "cards" that act as buttons often lack keyboard support even if they have `tabIndex={0}`. Adding an `onKeyDown` handler that maps 'Enter' and 'Space' to the click action is essential for keyboard accessibility.
**Action:** Always implement `onKeyDown` with 'Enter'/'Space' support whenever using `tabIndex={0}` on non-button elements acting as triggers.
