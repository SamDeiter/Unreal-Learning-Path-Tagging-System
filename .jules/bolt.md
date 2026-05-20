## 2026-05-20 - Optimize TagGraphService scoring with BFS and Metadata caching
**Learning:** Batch scoring 2,436 courses iteratively was a significant bottleneck in search fallback. BFS expansions on the tag graph were being re-calculated for every course, leading to redundant (C \times T)$ graph traversals.
**Action:** Use a `Map` for query-tag BFS expansion caching and a `WeakMap` for identity-based course metadata (normalized tag sets) to achieve a ~55% speedup in the local environment.
