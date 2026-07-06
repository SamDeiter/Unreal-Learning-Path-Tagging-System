## 2026-07-06 - Fix insecure token_usage data ownership
**Vulnerability:** Insecure Direct Object Reference (IDOR) in the `token_usage` collection. Daily token usage stats were stored in a global collection `/token_usage/{dateKey}`, allowing any authenticated user to read or overwrite the entire application's usage data.
**Learning:** Legacy collections often lack per-user scoping when implemented as simple "logs" or "stats". Even non-sensitive data like token counts should be user-scoped if they power a private dashboard or represent individual activity.
**Prevention:** Always scope user-specific data under `/users/{uid}/...` and use Firestore rules to enforce `request.auth.uid == uid`. Move data that contains aggregate or sensitive context out of client-writable global collections.
