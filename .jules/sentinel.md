## 2025-03-03 - Insecure Direct Object Reference (IDOR) in Token Usage Tracking
**Vulnerability:** The global `token_usage` collection allowed any authenticated user to read and write daily token usage statistics for the entire application, exposing sensitive cost and usage data.
**Learning:** Legacy architectural patterns often favor simplicity (global collections) over security (per-user namespacing). Client-side tracking logic that directly writes to top-level collections without UID-based path segments is a common source of IDOR.
**Prevention:** Always namespace user-generated data under `users/{uid}/...` and enforce strict ownership checks in Firestore rules. Use `getAuth().currentUser` within service methods to ensure operations are correctly attributed to the authenticated session.
