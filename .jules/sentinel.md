## 2025-05-22 - Enforce Atomic Increments and Authoritative Timestamps in Firestore
**Vulnerability:** The `path_builder_invites` collection allowed client-side updates to `usedCount` without enforcing that the increment was exactly 1, potentially allowing users to bypass usage limits. Additionally, `lastUsedAt` and `analytics_events` timestamps could be spoofed by the client.
**Learning:** Firestore rules must explicitly validate increments using `request.resource.data.field == resource.data.field + 1` to prevent manipulation, and use `request.time` to ensure timestamp integrity.
**Prevention:** Always enforce atomic increments for counters and validate timestamps against `request.time` in security rules for sensitive collections.
