## 2026-03-03 - User Isolation in Shared Collections
**Vulnerability:** IDOR in `token_usage` collection allowed any authenticated user to read or overwrite daily usage stats of other users by predicting the `dateKey`.
**Learning:** Shared top-level collections using generic keys (like dates) are inherently vulnerable to IDOR in Firebase if not namespaced by `uid` in the document path.
**Prevention:** Always namespace user-generated content or metrics under `/users/{uid}/` or `/{collection}/{uid}/` and enforce `request.auth.uid == uid` in Firestore rules.
