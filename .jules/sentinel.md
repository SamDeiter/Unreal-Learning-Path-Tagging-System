## 2026-04-07 - [Secure Firestore Rules for Analytics and Invites]
**Vulnerability:** The `analytics_events` collection was readable by any authenticated user, potentially leaking search queries and session data. The `path_builder_invites` collection allowed client-side updates to `usedCount` and `lastUsedAt` without server-side validation of the increment or timestamp.
**Learning:** Even when documentation (like `analyticsQueryService.js`) claims a collection is admin-only, the Firestore rules are the actual source of truth and must be explicitly audited. Implicit trust in "authenticated users" is often too broad for sensitive telemetry.
**Prevention:** Always restrict read access to the minimum necessary persona (e.g., `isAdmin()`). For sensitive counters or metadata updates (like invite consumption), use `request.resource.data.field == resource.data.field + 1` and `request.resource.data.timestamp == request.time` to ensure data integrity and prevent replay or bulk-increment attacks.

## 2026-04-08 - [User Isolation for Token Usage Tracking]
**Vulnerability:** The `token_usage` collection used a global date-based path (`token_usage/{dateKey}`), allowing any authenticated user to read or overwrite the entire application's token usage data for a given day.
**Learning:** Shared global documents for user-driven metrics are an Insecure Direct Object Reference (IDOR) risk. Even "anonymous" tracking should be scoped to a session or user ID if stored in a shared collection.
**Prevention:** Always nest user-specific data under their UID in Firestore (e.g., `collection/{userId}/subcollection/{docId}`) and enforce this in rules using `request.auth.uid == userId`. For aggregate admin views, use `isAdmin()` bypasses in the same rule.
