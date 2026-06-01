## 2025-05-14 - Admin Authorization Guard
**Vulnerability:** The `triggerDemandScrape` Cloud Function was accessible to any authenticated user, allowing potentially unauthorized triggers of external GitHub Actions workflows.
**Learning:** Generic authentication (`request.auth`) is often insufficient for internal tools or administrative actions. A dedicated authorization layer is needed to distinguish between standard users and administrators.
**Prevention:** Use a centralized `requireAdmin` guard that checks for custom claims (e.g., `admin: true`) and provides an environment-based fallback (`ADMIN_UID`) for initial bootstrapping and migration periods.
