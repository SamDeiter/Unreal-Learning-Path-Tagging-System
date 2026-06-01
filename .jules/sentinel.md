## 2026-05-19 - Missing Authorization on Admin Tooling
**Vulnerability:** The `triggerDemandScrape` Cloud Function was missing an explicit admin authorization check, allowing any authenticated user to trigger GitHub Action workflows.
**Learning:** Functions intended for internal/admin use should always enforce `admin` claims or a bootstrap allowlist, even if they already require basic authentication.
**Prevention:** Centralize authorization checks using the `isAdmin` utility or `requireAuth` middleware, and audit all `onCall` functions for appropriate privilege levels.
