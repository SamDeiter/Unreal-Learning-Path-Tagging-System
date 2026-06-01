## 2026-03-03 - [Broken Access Control and Authorization Hardening]
**Vulnerability:** IDOR in `token_usage` collection and overly permissive access to `triggerDemandScrape`.
**Learning:** Top-level collections in Firestore using non-unique keys (like dates) are vulnerable to IDOR if not scoped to a `uid`. Additionally, internal administrative functions like `triggerDemandScrape` were accessible to any authenticated user.
**Prevention:** Always scope user-generated persistent data under `/users/{uid}/` in Firestore and use a centralized authorization utility (e.g., `adminGuard.js`) to enforce admin-only access on sensitive Cloud Functions.
