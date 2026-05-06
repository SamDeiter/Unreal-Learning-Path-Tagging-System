## 2025-05-06 - Identity-based caching in TagGraphService
**Learning:** The `scoreCourseRelevance` method was a hot loop, processing 2,400+ courses per query. It performed redundant array spreads, `Set` creations, and BFS graph expansions (2 hops) for every single course, even though the query tags remained constant for the batch.
**Action:** Use `WeakMap` to cache course-level metadata (normalized tags, sets, suffix maps) and a `Map` to cache query-level graph expansions. Implement reference-based cache invalidation for the query batch to avoid redundant BFS traversals.
