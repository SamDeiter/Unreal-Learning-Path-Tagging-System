## 2026-07-07 - Insecure Direct Object Reference in token_usage
**Vulnerability:** The `token_usage` collection was global and keyed only by date, allowing any authenticated user to read or overwrite anyone else's usage data.
**Learning:** Shared global collections with client-side writes are a major IDOR risk. Even if data seems "low impact" (like usage stats), it can leak patterns or be corrupted by malicious actors.
**Prevention:** Always isolate user-specific data under a `/users/{uid}/` path in Firestore and enforce it with `request.auth.uid == uid` in security rules.
