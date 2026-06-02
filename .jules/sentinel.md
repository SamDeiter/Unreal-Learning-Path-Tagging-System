## 2025-03-03 - [IDOR & Data Corruption in Token Tracking]
**Vulnerability:** The `token_usage` collection used a shared document ID (`dateKey`), allowing any authenticated user to read or overwrite aggregate token usage data for the entire system.
**Learning:** Shared document IDs for user-contributed metrics create an IDOR vulnerability. Even if users are supposed to append to the data, client-side `setDoc` can overwrite the entire document.
**Prevention:** Always use unique, per-user document IDs (e.g., `${dateKey}_${uid}`) and enforce ownership in `firestore.rules` by checking `resource.data.userId == request.auth.uid` for both `read` and `update` operations.
