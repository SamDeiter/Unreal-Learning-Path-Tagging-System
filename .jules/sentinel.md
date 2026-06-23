## 2025-03-03 - Scoping Token Usage Tracking to Prevent IDOR
**Vulnerability:** The `token_usage` Firestore collection was using a global `{dateKey}` as the document ID, allowing any authenticated user to read and overwrite shared usage statistics.
**Learning:** Shared global documents for user-specific telemetry create a data leakage risk and allow for easy authorization bypass (IDOR) if not explicitly nested under a user UID. Path-based scoping is more robust and easier to secure than complex condition-based rules on a flat collection.
**Prevention:** Always scope user-generated metadata, usage statistics, and telemetry under a `users/{uid}/` subcollection. Use Firestore rules to strictly enforce `request.auth.uid == uid` for all sub-paths.
