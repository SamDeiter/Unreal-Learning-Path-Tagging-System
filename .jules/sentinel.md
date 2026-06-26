## 2025-03-03 - Broken Access Control in Token Tracking

**Vulnerability:** Insecure Direct Object Reference (IDOR) in `token_usage` collection. Any authenticated user could read or write any other user's daily token usage document because the documents were stored in a global collection indexed only by date (e.g., `token_usage/2025-03-03`).

**Learning:** Data that is conceptually per-user but logically indexed by date must be nested under a user-specific path (e.g., `users/{uid}/token_usage/{date}`) to allow Firestore rules to enforce ownership via `request.auth.uid`.

**Prevention:** Always scope user-specific data under a `users/{uid}` prefix in both the frontend service logic and the Firestore security rules.
