## 2025-05-22 - [Accessibility Pattern for Interactive Divs]
**Learning:** Interactive `div` elements acting as buttons (e.g., `case-dropzone` in `CaseReportForm.jsx`) must include an `onKeyDown` handler that triggers the click action on 'Enter' or 'Space' to support keyboard-only users, alongside `role="button"` and `tabIndex={0}`.
**Action:** Always implement `onKeyDown` with Enter/Space support when using non-semantic elements as buttons.
