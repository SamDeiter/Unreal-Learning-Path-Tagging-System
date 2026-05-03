## 2025-03-03 - Insecure Direct Object Reference (IDOR) in Token Tracking
**Vulnerability:** The `token_usage` collection was stored at the root of Firestore with rules that allowed any authenticated user to read all records and update any record (using a date-based ID).
**Learning:** Top-level collections that use predictable IDs (like dates) without user-level namespacing allow users to enumerate or overwrite data belonging to others. Code comments or architectural assumptions of 'private' tracking are insufficient without strict Firestore rules enforcement.
**Prevention:** Always namespace user-specific data under a `/users/{uid}/` path in both Firestore rules and client-side service logic. Use `request.auth.uid == uid` to enforce isolation.
