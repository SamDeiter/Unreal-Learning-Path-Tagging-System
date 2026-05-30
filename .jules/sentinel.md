## 2025-03-03 - IDOR and Data Corruption in Shared Analytics Collection
**Vulnerability:** The `token_usage` collection used predictable, date-based document IDs (`YYYY-MM-DD`) shared by all users. Firestore rules allowed any authenticated user to read/write these documents. This created an IDOR vulnerability where one user could overwrite another's usage stats, and a data corruption issue where aggregate daily totals were lost as users stepped on each other's data.

**Learning:** Predictable document IDs without ownership metadata in the document and corresponding enforcement in security rules fail to provide isolation. Even when the UI intends to track "own" stats, the lack of backend enforcement allows malicious or accidental data overwriting.

**Prevention:** Use composite document IDs that include the user's unique identifier (e.g., `YYYY-MM-DD_UID`) to guarantee isolation at the storage level. Supplement this with Firestore rules that validate `request.auth.uid` against a `userId` field in the document.
