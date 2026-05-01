## 2025-05-22 - [FeedbackModal & Sidebar Accessibility]
**Learning:** Screen readers require explicit state communication for collapsible elements (aria-expanded) and decorative symbols (aria-hidden). Form fields that are mandatory benefit from both visual (asterisk) and semantic (aria-required) indicators, and character counters should use role="status" to be announced correctly.
**Action:** Always include aria-expanded on toggle buttons and use the .sr-only class to provide context to screen readers for visual-only cues.
