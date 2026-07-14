## 2026-03-03 - [HIGH] Fix IDOR in token usage tracking
**Vulnerability:** The `token_usage` collection was at the root level, allowing any authenticated user to read or overwrite any other user's daily usage statistics by manipulating the document ID (date).
**Learning:** Security rules for subcollections in Firestore do not automatically inherit isolation from parent document rules unless explicitly nested or path-scoped. Root-level collections are inherently prone to IDOR if they lack ownership fields and corresponding rule checks.
**Prevention:** Always scope user-specific data under `/users/{uid}/...` and enforce ownership with `request.auth.uid == uid` in Firestore rules. Use unit tests with mocked auth to verify that service-layer path construction is correctly user-isolated.
