## 2026-03-03 - [Vulnerability] Non-Atomic Invite Increments
**Vulnerability:** The `path_builder_invites` collection allowed client-side updates to `usedCount` without enforcing atomic increments. A malicious client could set `usedCount` to any value, potentially extending the life of a limited-use invite or resetting it.
**Learning:** Firestore `update` rules should always validate numeric transitions using `request.resource.data.field == resource.data.field + 1` when atomic behavior is required. Simply allowing update access to a field is insufficient for data integrity in a multi-user environment.
**Prevention:** Enforce server-side timestamp validation using `request.time` for all metadata fields like `lastUsedAt` and use delta validation for counters.
