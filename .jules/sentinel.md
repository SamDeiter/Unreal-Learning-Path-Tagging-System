## 2026-03-03 - Administrative Access Control & Data Isolation
**Vulnerability:** The `triggerDemandScrape` Cloud Function and the `token_usage` Firestore collection were accessible to all authenticated users (IDOR/Broken Access Control), allowing any user to trigger expensive background workflows or view global system-wide token usage stats.
**Learning:** Defaulting to simple authentication checks (`request.auth != null` or `requireAuth`) is insufficient for internal administrative tools or collections that aggregate data across all users.
**Prevention:** Implement and enforce a centralized `requireAdmin` helper for sensitive Cloud Functions and restrict global collection reads in `firestore.rules` using the `isAdmin()` helper (validating the `admin: true` custom claim).
