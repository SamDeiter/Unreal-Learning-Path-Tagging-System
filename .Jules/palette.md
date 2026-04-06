## 2026-04-06 - [LoadingSpinner Accessibility]
**Learning:** Adding 'role="status"' and 'aria-live="polite"' to a container that surrounds a text message ensures screen readers announce the update. 'aria-hidden="true"' on the visual spinner prevents redundant/confusing announcements of a decorative element.
**Action:** Always include these attributes when creating or auditing loading states/components.
