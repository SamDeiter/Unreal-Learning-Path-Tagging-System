## 2025-07-16 - User-scoped Firestore Path Isolation
**Vulnerability:** Insecure Direct Object Reference (IDOR) in `token_usage` collection. Global root collection allowed any authenticated user to read/write any other user's usage stats if they knew the date key.
**Learning:** Root-level collections in Firestore that track user-specific data are inherently prone to IDOR unless strictly scoped under `/users/{uid}`. Firestore security rules do not automatically inherit user ownership from a `request.auth != null` check.
**Prevention:** Always nest user-specific data under `/users/{uid}` and enforce `request.auth.uid == uid` in the security rules for those paths.
