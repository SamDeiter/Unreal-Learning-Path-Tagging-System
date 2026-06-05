## 2025-05-15 - [Identity-based Caching in TagGraphService]
**Learning:** `scoreCourseRelevance` was performing O(n*m) work per course by re-calculating tag sets and re-traversing the tag graph for every course-tag pair.
**Action:** Use `WeakMap` for identity-based course metadata caching and `Map` for per-session BFS expansion caching to reduce complexity from $O(Courses \times Tags \times GraphTraversal)$ to $O(Tags \times GraphTraversal + Courses \times Tags \times MatchedNeighbors)$.
