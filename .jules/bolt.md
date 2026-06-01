## 2025-05-15 - Caching in TagGraphService
**Learning:** Identity-based caching with `WeakMap` for course metadata and static `Map` for graph expansions significantly improves batch scoring performance. The primary bottleneck was redundant string normalization and graph traversals in a hot loop (O(N*M) where N is courses and M is query tags).
**Action:** Always use `WeakMap` for objects that don't need to be kept alive by the cache, and pre-calculate independent traversal results before entering iterative scoring loops.
