## 2026-03-03 - Nested User-Scoped Subcollection Protection for Token Usage
**Vulnerability:** Broken Object Level Authorization (BOLA/IDOR) on `/token_usage/{dateKey}` Firestore collection allowed any authenticated user to read/write/overwrite any user's token usage logs.
**Learning:** Storing flat records under a shared global collection makes security rule partitioning more difficult unless strict document field ownership validation is executed on every query. Failing to check `uid` in document paths or payload keys can lead to cross-user data leakage.
**Prevention:** Nest user-specific data under `/users/{uid}/` nested collections, so that standard path-based rule authorization can cleanly and implicitly restrict access to the owning user or administrators.
