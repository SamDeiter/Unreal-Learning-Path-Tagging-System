## 2025-05-15 - Centralized Admin Authorization

**Vulnerability:** Duplicated admin authorization logic with hardcoded "bootstrap" email lists across multiple Cloud Functions (`setAdminClaim`, `mineMisconceptions`). Additionally, `triggerDemandScrape` was overly permissive, allowing any authenticated user to trigger an external scraping workflow.

**Learning:** Duplicating sensitive authorization logic leads to inconsistent security postures (e.g., forgetting to update one list) and makes it harder to audit access. Insecure defaults (like allowing all authenticated users to trigger expensive/sensitive workflows) are often overlooked during rapid development of "internal" tools.

**Prevention:** Always centralize authorization guards in a shared utility. Use a single source of truth for administrative fallback access (bootstrap lists) and apply the principle of least privilege by defaulting to admin-only for any function that triggers side effects in external systems or CI/CD pipelines.
