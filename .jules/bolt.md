## 2025-05-05 - Identity-based caching for course relevance scoring
**Learning:** The `scoreCourseRelevance` method was a bottleneck due to repeated tag normalization and graph traversals. Identity-based caching (`WeakMap`) for course metadata and `Map` for graph expansions significantly reduced overhead.
**Action:** Use `WeakMap` for object-bound metadata and `Map` for query-specific computation results in hot loops.
