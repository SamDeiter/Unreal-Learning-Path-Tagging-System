## 2026-04-22 - [Broken Access Control in Administrative Callable]
**Vulnerability:** The `triggerDemandScrape` callable function was accessible to any authenticated user, allowing unauthorized triggering of GitHub Action workflows.
**Learning:** Functions managing external infrastructure (like GitHub) must explicitly verify administrative privileges beyond simple authentication.
**Prevention:** Use a centralized `requireAdmin` helper that checks both Firebase custom claims and an environment-based UID whitelist for fail-safe access control.
