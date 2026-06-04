## 2026-06-04 - DiagnosisLoader Accessibility and Visual Feedback
**Learning:** Loading states often overlook screen reader accessibility. Adding role="status" and role="progressbar" ensures that non-visual users are kept in the loop. A subtle pulse animation provides visual confirmation of activity without being distracting.
**Action:** Always include ARIA live regions for async loading states and use aria-valuetext for human-readable progress updates.
