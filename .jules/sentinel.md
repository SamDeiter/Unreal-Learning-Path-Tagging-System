## 2025-03-03 - [Vulnerability] IDOR and Data Collision in Token Tracking

**Vulnerability:** The `token_usage` collection was using non-isolated document IDs (just the date), allowing any authenticated user to read and overwrite the aggregate daily usage data of all users.
**Learning:** Shared document IDs in collections that track per-user state (like usage metrics or carts) without explicit UID filtering in both document IDs and Firestore rules lead to data leakage and race conditions.
**Prevention:** Always use composite document IDs including the `userId` (e.g., `${userId}_${dateKey}`) and enforce ownership checks in Firestore rules using `resource.data.userId == request.auth.uid`.
