## 2026-03-03 - [HIGH] Fix IDOR in token usage tracking
**Vulnerability:** The `token_usage` collection was at the root level, allowing any authenticated user to read or overwrite any other user's daily usage statistics by manipulating the document ID (date).
**Learning:** Security rules for subcollections in Firestore do not automatically inherit isolation from parent document rules unless explicitly nested or path-scoped. Root-level collections are inherently prone to IDOR if they lack ownership fields and corresponding rule checks.
**Prevention:** Always scope user-specific data under `/users/{uid}/...` and enforce ownership with `request.auth.uid == uid` in Firestore rules. Use unit tests with mocked auth to verify that service-layer path construction is correctly user-isolated.

## 2026-03-03 - E2E Bypass and Firebase Test Infrastructure
**Vulnerability:** N/A (Infrastructure)
**Learning:** Automatically enabling authentication bypass during Vitest runs (via `import.meta.env.VITEST`) is necessary to prevent 'auth/invalid-api-key' errors in environments without Firebase secrets. However, this causes `getFirebaseApp()` to return `null`, which can break existing unit tests that assert on a valid Firebase app object.
**Prevention:** When implementing environment-based bypasses, ensure that infrastructure-level unit tests (like `firebaseConfig.test.js`) are updated to handle the `null` return state gracefully.
