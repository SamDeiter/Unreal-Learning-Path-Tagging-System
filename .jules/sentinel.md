## 2025-05-21 - User Data Isolation in Firestore

**Vulnerability:** Insecure Direct Object Reference (IDOR) in the `token_usage` collection.
**Learning:** Firestore collections used for client-side tracking must be isolated per user or restricted via owner-based security rules. A global collection like `token_usage/{dateKey}` with `allow read: if request.auth != null;` permits any authenticated user to read (and potentially enumerate) all other users' usage data.
**Prevention:** Always namespace user-specific data under `/users/{uid}/...` or implement strict ownership checks using `resource.data.userId == request.auth.uid` in Firestore rules.
