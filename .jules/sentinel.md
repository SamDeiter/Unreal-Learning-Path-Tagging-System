## 2026-06-04 - IDOR in Shared Token Tracking Collection
**Vulnerability:** Insecure Direct Object Reference (IDOR) and Data Corruption in the `token_usage` collection.
**Learning:** Using a simple date (e.g., `2026-03-03`) as a document ID in a collection where multiple users write results in a global collision. Any authenticated user could overwrite the daily stats of the entire platform, and lack of Firestore rule ownership checks allowed any user to read everyone else's usage data.
**Prevention:** Use a composite document ID that includes the `userId` (e.g., `${userId}_${dateKey}`) or store user-specific data in a subcollection under the user's document. Always enforce `resource.data.userId == request.auth.uid` in Firestore rules for collections that aren't globally shared.
