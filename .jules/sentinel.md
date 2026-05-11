## 2025-05-22 - IDOR in Token Usage Tracking
**Vulnerability:** Top-level collection `token_usage/{dateKey}` allowed any authenticated user to read or overwrite global daily usage statistics.
**Learning:** Using non-unique keys (like date strings) in top-level collections without user-specific namespacing or strict ownership rules creates Insecure Direct Object Reference (IDOR) vulnerabilities and potential data corruption.
**Prevention:** Always namespace user-generated telemetry or usage data under `users/{uid}` in Firestore and enforce `request.auth.uid == uid` in security rules.
