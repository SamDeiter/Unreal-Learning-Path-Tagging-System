## 2026-07-12 - [Critical] IDOR in token_usage collection
**Vulnerability:** The `token_usage` collection was a root-level collection where any authenticated user could write to and read from any document (keyed by date). This allowed users to enumerate and potentially overwrite API usage data for the entire application.
**Learning:** Root-level collections in Firestore that are not explicitly scoped under `/users/{uid}` are prone to IDOR vulnerabilities if rules only check for `request.auth != null`.
**Prevention:** Always scope user-specific data under `/users/{uid}` and enforce ownership in Firestore rules.
**Note:** Moving the data to `users/{uid}/token_usage` is a breaking change that makes existing global usage data inaccessible to the client. This was necessary to ensure immediate security isolation.
