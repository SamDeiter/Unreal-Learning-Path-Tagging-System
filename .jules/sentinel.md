## 2026-05-22 - [CRITICAL/HIGH] Fix BOLA/IDOR vulnerability in token_usage collection

**Vulnerability:** Top-level Firestore collection `/token_usage/{dateKey}` allowed unrestricted read/write access to any authenticated user (`allow read, create, update: if request.auth != null;`). This allowed any user to read, tamper with, or completely overwrite other users' API token/cost usage metrics.

**Learning:** Storing telemetry, metrics, or usage logs at a root-level collection without embedding a `uid` reference in the document ID or nesting under a `/users/{uid}` path introduces IDOR (Insecure Direct Object Reference) or BOLA (Broken Object Level Authorization) vulnerabilities. Client-side SDK queries cannot be reliably constrained unless security rules enforce user-scoped path structure or content-based validation matching the authenticated `request.auth.uid`.

**Prevention:** Always scope user-specific data inside nested subcollections under a securely locked `/users/{uid}` path. In `firestore.rules`, enforce that the subcollection matches `uid == request.auth.uid` to completely isolate data between users. For client-side Firestore queries, ensure path-construction maps explicitly to `/users/{uid}/...` instead of root-level paths.
