## 2026-03-03 - Centralized Admin Authorization and Error Masking
**Vulnerability:** Inconsistent admin authorization checks and potential information leakage via GitHub API error messages.
**Learning:** Having multiple `BOOTSTRAP_ADMIN_EMAILS` definitions across files increases the risk of synchronization errors and inconsistent access control. Also, returning raw downstream API errors to clients can leak internal system details.
**Prevention:** Centralize authorization logic into shared helpers that support both v1 (context) and v2 (request) Firebase Functions. Always wrap downstream API calls (like GitHub) in try-catch blocks to mask detailed errors before returning them to the client.
