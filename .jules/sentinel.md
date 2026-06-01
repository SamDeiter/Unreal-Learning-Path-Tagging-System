## 2025-05-14 - Fix IDOR and data overwrite vulnerability in token tracking
**Vulnerability:** Root-level `token_usage` collection allowed any authenticated user to read or overwrite daily token usage stats for any other user (IDOR).
**Learning:** Top-level collections using shared keys (like `dateKey`) without user-ID namespaces in Firestore rules create IDOR vulnerabilities and write-conflict race conditions.
**Prevention:** Always namespace per-user data under `/users/{uid}/` paths in both the client-side service and Firestore rules to ensure isolation.
