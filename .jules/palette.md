## 2026-04-30 - Accessible Character Counters and Required Fields
**Learning:** Users with screen readers benefit from `aria-live="polite"` and `role="status"` on dynamic text like character counters. Linking these counters to the input via `aria-describedby` provides context. Visually-hidden `(required)` labels via `.sr-only` classes ensure semantic clarity without cluttering the UI.
**Action:** Always include a `.sr-only` utility in the global CSS and use it for essential screen-reader-only context. Link dynamic status indicators to their respective inputs using `aria-describedby`.
