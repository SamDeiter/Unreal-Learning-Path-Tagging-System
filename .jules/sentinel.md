## 2026-05-01 - [User Data Isolation in Firestore]
**Vulnerability:** Broken Access Control / Insecure Direct Object Reference (IDOR) on `token_usage` collection.
**Learning:** Top-level collections that store per-user data (like usage metrics or history) but lack `resource.data.userId == request.auth.uid` checks in rules are vulnerable to cross-user data enumeration or modification if they are indexed by guessable keys (like dates).
**Prevention:** Always namespace user-private data under `match /users/{uid}` in `firestore.rules` or enforce strict UID equality checks on all operations. Favor nested paths to inherit parent authorization contexts.
