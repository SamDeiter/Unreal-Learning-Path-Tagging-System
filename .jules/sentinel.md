## 2026-03-03 - Insecure token_usage isolation (IDOR)
**Vulnerability:** Root-level collections without user scoping are inherently prone to IDOR. The `token_usage` collection was at the top level, allowing any authenticated user to enumerate or overwrite others' usage data.
**Learning:** Firestore security rules do not automatically inherit access controls for subcollections; however, nesting data under `/users/{uid}` is a reliable pattern for enforcing per-user isolation when combined with `match /users/{uid}` rules.
**Prevention:** Always scope user-generated telemetry or usage stats under the user's private document path (`/users/{uid}/...`) instead of root-level collections with shared keys.
