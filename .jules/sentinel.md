## 2026-08-20 - [IDOR in token_usage]
**Vulnerability:** The `token_usage` collection was a global, top-level collection in Firestore where any authenticated user could read or write documents named by date (e.g., `2026-08-20`). This allowed any user to potentially overwrite or view the usage statistics of all other users.
**Learning:** Shared global collections for per-user data are a classic IDOR (Insecure Direct Object Reference) pattern. Even if the document ID is a date, if multiple users share that date, their data will collide or be exposed.
**Prevention:** Always scope user-specific data under a `/users/{uid}/` hierarchy in Firestore and enforce ownership checks in `firestore.rules` using `request.auth.uid == uid`.
