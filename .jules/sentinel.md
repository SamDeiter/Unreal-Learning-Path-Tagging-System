## 2025-03-03 - Insecure Direct Object Reference (IDOR) in Token Tracking
**Vulnerability:** The `token_usage` collection was stored at the root level of Firestore, and its security rules allowed any authenticated user to read or write any document in that collection. This meant a user could potentially view or manipulate the token usage stats of any other user if they knew or guessed the date key.

**Learning:** Root-level collections for user-specific data are dangerous unless the document structure itself contains a `userId` field AND the rules strictly enforce that `request.auth.uid == resource.data.userId`. Subcollections under a `users/{uid}` hierarchy are generally safer as they inherit the UID context and make it harder to accidentally misconfigure global access.

**Prevention:** Always isolate per-user data into subcollections under `users/{uid}/`. When writing security rules, use explicit permissions (`create`, `update`, `read`) instead of broad ones (`write`) to prevent unintended actions like `delete`, and always include document schema validation (like `keys().size()`) to prevent resource exhaustion or data pollution.
