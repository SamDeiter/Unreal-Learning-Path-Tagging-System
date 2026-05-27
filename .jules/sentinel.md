
## 2026-05-27 - Centralized Admin Authorization & Secret Removal
**Vulnerability:** Exposed Gemini API key in an unused client-side service and inconsistent/missing admin checks on sensitive Cloud Functions (e.g., triggering GitHub Actions).
**Learning:** Hardcoding 'VITE_' prefixed environment variables in Vite projects bundles them into the client-side code, even if the service is unused. Additionally, decentralized authorization logic leads to security gaps where sensitive operations might only be guarded by simple authentication instead of role-based authorization.
**Prevention:** Remove unused code paths that leak secrets. Centralize authorization guards (like requireAdmin) into a single utility that supports both v1 and v2 Cloud Functions, ensuring consistent enforcement across the entire backend.
