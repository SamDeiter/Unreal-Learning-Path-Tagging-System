## 2026-03-03 - Atomic Usage Throttling in Firestore Rules
**Vulnerability:** Malicious users could potentially bypass invite code usage limits by manually setting the `usedCount` field to a lower value or 0 during the update operation, or by spoofing activity timestamps.
**Learning:** Firestore `allow update` rules that only check `affectedKeys()` are insufficient to ensure field integrity. Without explicit value checks, any authenticated user with update permission on those keys can set arbitrary values.
**Prevention:** Always enforce atomic increments for counters (e.g., `request.resource.data.counter == resource.data.counter + 1`) and validate that timestamps match `request.time` in the security rules.
