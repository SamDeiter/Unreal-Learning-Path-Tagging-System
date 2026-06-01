## 2025-05-07 - Identity-based Caching in TagGraphService

**Learning:** `TagGraphService.scoreCourseRelevance` was a major bottleneck because it re-calculated graph expansions (BFS) and normalized course tags for every single course in the library (2400+ courses) on every search query. Implementing identity-based caching for course metadata via `WeakMap` and query-level expansion caching via `Map` reduced execution time by ~4-5x.

**Action:** Always look for "batch scoring" patterns where the same transformation is applied to many objects. Use `WeakMap` for per-object metadata and `Map` for query-specific state to avoid redundant work in hot loops.
