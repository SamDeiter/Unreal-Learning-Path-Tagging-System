## 2026-05-17 - TagGraphService Batch Scoring Optimization
**Learning:** The primary performance bottleneck when matching courses was the redundant normalization of course tags and repeated BFS graph expansions for the same query tags across thousands of courses.
**Action:** Implement identity-based caching for course metadata (using WeakMap) and memoization for BFS expansions (using Map) within `TagGraphService`. This reduced batch scoring time for 2,436 courses from ~142ms to ~10ms.
