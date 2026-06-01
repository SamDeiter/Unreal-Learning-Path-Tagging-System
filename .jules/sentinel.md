## 2025-03-03 - Centralized Admin Authorization
**Vulnerability:** The `triggerDemandScrape` Cloud Function was protected by authentication but lacked authorization, allowing any signed-in user to trigger potentially resource-intensive or rate-limited scraping workflows.
**Learning:** Authentication (knowing who a user is) was incorrectly treated as sufficient for authorization (what a user can do). Additionally, hardcoding admin bootstrap lists across multiple files created a fragmented security boundary that was difficult to audit.
**Prevention:** Use a centralized `requireAdmin` helper that validates both custom claims and bootstrap fallback lists. Ensure every sensitive endpoint explicitly calls an authorization guard rather than relying on global auth state alone.
