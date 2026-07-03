## 2026-07-03 - Insecure Direct Object Reference in Token Usage
**Vulnerability:** The `token_usage` collection was keyed only by date (`token_usage/{dateKey}`), allowing any authenticated user to read and overwrite global usage statistics.
**Learning:** Even when security rules use `request.auth != null`, they do not automatically provide data isolation. Without matching a document key or field to the `uid`, data is effectively shared across all users.
**Prevention:** Always nest user-specific data under a `/users/{uid}` path or subcollection, and enforce `request.auth.uid == uid` in Firestore rules. Use subcollections (e.g., `users/{uid}/token_usage`) to simplify rule inheritance and ensure atomicity of access control.
