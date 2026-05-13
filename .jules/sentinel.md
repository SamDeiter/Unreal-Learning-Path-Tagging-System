## 2026-05-13 - User-Level Namespacing for Telemetry Data
**Vulnerability:** Top-level collections using shared keys (like `dateKey`) without user-ID namespaces in Firestore rules create IDOR vulnerabilities and write-conflict race conditions.
**Learning:** Authenticated-only access is insufficient for collections that aggregate data across users using predictable IDs.
**Prevention:** Always namespace user-generated telemetry or usage data under `/users/{uid}/` paths in Firestore and enforce ownership in security rules.
