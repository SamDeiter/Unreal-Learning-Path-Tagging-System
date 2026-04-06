## 2026-04-06 - [Business Logic Protection: Invite System Hardening]
**Vulnerability:** Overly permissive Firestore update rules allowed authenticated users to set sensitive counter fields (`usedCount`) and timestamps (`lastUsedAt`) to arbitrary values on invite code documents.
**Learning:** Even when restricting the keys a user can modify via `affectedKeys().hasOnly()`, failing to validate the *value* of those changes (e.g., ensuring an atomic increment of +1) allows for "Usage Exhaustion" or "Counter Reset" attacks.
**Prevention:** Always use `request.resource.data.field == resource.data.field + 1` for counters and `request.resource.data.timestamp == request.time` for server-side timestamps in security rules.
