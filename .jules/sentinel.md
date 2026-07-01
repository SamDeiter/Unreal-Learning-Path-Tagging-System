## 2026-07-01 - [IDOR in Token Usage Tracking]
**Vulnerability:** Insecure Direct Object Reference (IDOR) in `tokenTracker.js`. Token usage statistics were stored in a global `token_usage` collection indexed by date, allowing any authenticated user to read or overwrite the daily stats for the entire application.
**Learning:** Shared global collections for user-specific metrics without per-user document isolation or strict Firestore rules create IDOR risks. Even non-sensitive metrics like token counts can be abused to inflate costs or deny service by overwriting data.
**Prevention:** Always isolate user-specific data into subcollections under `users/{uid}/` and enforce ownership via Firestore rules: `match /users/{uid} { allow read, write: if request.auth.uid == uid; }`.
