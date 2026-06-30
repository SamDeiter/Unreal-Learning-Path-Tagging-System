## 2025-06-30 - Broken Access Control (IDOR) in Token Tracking

**Vulnerability:** The `token_usage` collection was a top-level Firestore collection where documents were keyed by date (`token_usage/{date}`). Any authenticated user could read or overwrite the daily token usage totals for the entire application, as the security rules only checked for `request.auth != null`.

**Learning:** When implementing "convenience" tracking features (like a cost dashboard) that aggregate data, it's easy to overlook isolation. Even if the data seems non-sensitive, allowing any user to modify shared records creates a "Data Integrity" and "Denial of Service" (via data corruption) risk.

**Prevention:** Always isolate user-specific data into subcollections keyed by UID (e.g., `/users/{uid}/...`). Nest Firestore rules within the parent `/users/{uid}` block to ensure `request.auth.uid == uid` is automatically enforced for all nested paths.
