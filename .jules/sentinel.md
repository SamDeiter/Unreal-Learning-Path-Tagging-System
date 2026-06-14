# Sentinel Journal 🛡️

## 2026-03-03 - [IDOR in token_usage collection]
**Vulnerability:** Insecure Direct Object Reference (IDOR) and lack of data isolation in the `token_usage` collection.
**Learning:** The application was using the date string as the document ID for daily token usage stats (`token_usage/{date}`), causing all users to overwrite the same document. Firestore rules were also overly permissive, allowing any authenticated user to read all usage data.
**Prevention:** Use composite document IDs that include the user's UID (`{userId}_{date}`) and enforce ownership in `firestore.rules` by checking `resource.data.userId == request.auth.uid`. Always include a `userId` field in collections that track per-user state to enable rule-based isolation and filtered queries.
