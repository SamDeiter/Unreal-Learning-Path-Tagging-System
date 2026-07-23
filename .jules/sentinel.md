# Sentinel Security Journal

## 2026-07-23 - Broken Object Level Authorization (BOLA/IDOR) in Token Tracker
**Vulnerability:** Global access control for user daily token tracking in Firestore. Daily stats were written to a root-level `/token_usage/{dateKey}` collection, allowing any authenticated user to read or modify other users' token tracking data.
**Learning:** Storing daily token tracking logs at a global collection level without checking individual ownership introduced a severe IDOR risk. Even when Firestore subcollections are nested, we must explicitly secure them or scope them under parent documents where access control is already defined.
**Prevention:** Always scope personal metrics or activity logs under `/users/{uid}` subcollections rather than root collections. This ensures nested resource security is inherently tied to the authenticated user's ID (`request.auth.uid == uid`).

*Note (Breaking Change):* Moving `token_usage` data to the user-scoped path (`users/{uid}/token_usage`) makes existing global usage data inaccessible to client-side code; this migration is documented here as part of the security isolation transition.
