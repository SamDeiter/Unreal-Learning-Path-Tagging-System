## 2026-05-19 - Centralized Administrator Authorization

**Vulnerability:** Duplicated administrator email lists across multiple Cloud Functions and missing authorization checks on sensitive CI-triggering endpoints.
**Learning:** Hardcoded, duplicated security logic leads to inconsistent enforcement and increased maintenance overhead. The `triggerDemandScrape` function was particularly vulnerable as it allowed any authenticated user to consume CI resources.
**Prevention:** Centralize sensitive authorization logic into a single utility (`authGuard.js`) and use high-level requirement helpers (`requireAdmin`) to enforce the principle of least privilege consistently across all administrative endpoints.
