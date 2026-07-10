## 2026-07-10 - IDOR in token_usage isolation
**Vulnerability:** Insecure Direct Object Reference (IDOR) where the `token_usage` collection was stored at the root level, allowing any authenticated user to read any other user's usage stats.
**Learning:** Security fixes for IDOR can regress during refactors if data ownership isn't explicitly tied to the user's UID in both the storage path and Firestore rules.
**Prevention:** Always scope user-specific data under `/users/{uid}/` and enforce ownership in `firestore.rules` using `request.auth.uid == uid`.
