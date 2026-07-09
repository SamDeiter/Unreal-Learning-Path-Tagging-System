## 2026-03-03 - IDOR in token_usage
**Vulnerability:** Insecure Direct Object Reference (IDOR) allowing any authenticated user to read and overwrite token usage data of all other users in a global Firestore collection.
**Learning:** Firestore collections at the root level without explicit per-user filters in rules or client logic are vulnerable to IDOR. A previous fix for this had regressed, likely during a refactor.
**Prevention:** Always scope user-specific data under `/users/{uid}` in both Firestore rules and client-side service paths. Use `getCurrentUser().uid` to enforce isolation.
