## 2025-05-02 - TagGraphService Hot-Loop Optimization
**Learning:** `TagGraphService.scoreCourseRelevance` was a major bottleneck during batch course matching due to redundant string processing (tag splitting/lowercasing) and repeated BFS graph traversals for the same query tags across thousands of courses.
**Action:** Implemented identity-based caching using `WeakMap` for course metadata (normalized tag sets and suffix sets) and a `Map` for query tag BFS expansions. This achieved a ~10.8x measured speedup (0.0918ms -> 0.0085ms per course).
