## 2025-05-14 - IDOR in token_usage Collection
**Vulnerability:** Insecure Direct Object Reference (IDOR) and lack of per-user data isolation.
**Learning:** The collection used a simple date string as the document ID, making it a shared global resource readable and overwritable by any authenticated user.
**Prevention:** Always include a unique user identifier (e.g., UID) in document IDs and fields for per-user data, and enforce this in Firestore rules by checking both existing and new resource state (`resource.data.userId` and `request.resource.data.userId`).
