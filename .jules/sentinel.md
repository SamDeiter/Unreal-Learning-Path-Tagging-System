## 2026-04-07 - [Secure Firestore Rules for Analytics and Invites]
**Vulnerability:** The `analytics_events` collection was readable by any authenticated user, potentially leaking search queries and session data. The `path_builder_invites` collection allowed client-side updates to `usedCount` and `lastUsedAt` without server-side validation of the increment or timestamp.
**Learning:** Even when documentation (like `analyticsQueryService.js`) claims a collection is admin-only, the Firestore rules are the actual source of truth and must be explicitly audited. Implicit trust in "authenticated users" is often too broad for sensitive telemetry.
**Prevention:** Always restrict read access to the minimum necessary persona (e.g., `isAdmin()`). For sensitive counters or metadata updates (like invite consumption), use `request.resource.data.field == resource.data.field + 1` and `request.resource.data.timestamp == request.time` to ensure data integrity and prevent replay or bulk-increment attacks.

## 2026-04-08 - [Insecure and Unscoped Token Tracking]
**Vulnerability:** Token usage was being tracked in a global Firestore collection `token_usage/{dateKey}` where any authenticated user could overwrite the document. This allowed for data corruption and potential unauthorized access to aggregate cost telemetry.
**Learning:** Telemetry and usage tracking services often default to global or loosely scoped paths, which is a major security and data integrity risk in multi-user environments. Authenticated access is not a substitute for proper data isolation.
**Prevention:** Always scope user-specific data behind hierarchical paths (e.g., `{collection}/{userId}/{subcollection}/{docId}`) and enforce this scoping in Firestore rules using `request.auth.uid == userId`.
