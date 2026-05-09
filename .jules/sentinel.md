## 2025-05-09 - Token Tracking IDOR and Data Overwrite
**Vulnerability:** Global top-level collection `token_usage` allowed any authenticated user to read all application usage stats and overwrite daily totals because documents were keyed by date only (e.g., `token_usage/2025-05-10`).
**Learning:** Shared global collections with client-side writes create both security (IDOR) and data integrity (race conditions/overwrites) risks. Last-writer-wins behavior in `setDoc` corrupted global tracking data when multiple users were active.
**Prevention:** Always namespace user-generated metrics and logs under `/users/{uid}/` or use unique, user-prefixed document IDs (e.g., `{uid}_{date}`) in conjunction with Firestore rules that enforce `request.auth.uid` ownership.
