## 2026-03-03 - [HIGH] Insecure data ownership in token_usage collection
**Vulnerability:** The `token_usage` collection used shared daily document IDs (e.g., "2026-03-03"), allowing any authenticated user to overwrite or read other users' token consumption data.
**Learning:** Using global unique keys (like dates) as document IDs in a shared collection creates a multi-tenancy isolation failure if not coupled with per-user fields and strict Firestore security rules.
**Prevention:** Always denormalize `userId` into documents, use composite document IDs (e.g., `${userId}_${date}`) for per-user-per-period uniqueness, and enforce ownership in `firestore.rules` using `resource.data.userId == request.auth.uid`.
