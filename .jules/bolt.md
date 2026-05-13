## 2025-05-13 - TagGraphService relevance scoring optimization
**Learning:** Identity-based WeakMap course metadata caching and Map-based BFS expansion caching significantly reduce redundant computation in batch scoring. Iterative speedup was ~7.5x (from 363ms to 48ms for 2436 courses).
**Action:** Use WeakMap for object-keyed metadata caching in hot loops.
