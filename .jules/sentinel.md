## 2026-03-03 - [HIGH] Fix IDOR in token_usage isolation
**Vulnerability:** The `token_usage` Firestore collection was root-level (`/token_usage/{dateKey}`) and allowed any authenticated user to read or overwrite data without ownership checks.
**Learning:** Security regressions can occur when migrating from global to per-user storage if old root-level rules aren't removed or if client-side path logic isn't strictly enforced via shared auth services.
**Prevention:** Always scope user-specific data under `/users/{uid}` in both Firestore rules and client-side service paths. Use a centralized `getCurrentUser()` helper to ensure consistent UID retrieval for path construction.
