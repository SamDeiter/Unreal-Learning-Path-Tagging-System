## 2025-05-15 - Caching Course Metadata and BFS Expansions
**Learning:** In batch scoring scenarios (like search results), normalizing course tags and performing graph traversals repeatedly is a significant O(N * M) bottleneck. Identity-based caching for courses (WeakMap) and query-tag caching for graph expansions (Map) reduces this to O(N + M).
**Action:** Use WeakMap for identity-based metadata and Map for query-based expansions in all graph-heavy scoring paths.
