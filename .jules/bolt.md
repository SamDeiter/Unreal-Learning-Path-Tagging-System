## 2025-06-07 - Identity-based Caching in TagGraphService
**Learning:** Re-calculating normalized tag sets and performing multi-hop BFS for thousands of courses in a single search batch is a significant bottleneck. Using identity-based caching (WeakMap) for course metadata and a standard Map for static graph BFS results provides massive speedups.
**Action:** Always check for redundant calculations in loops that iterate over large datasets (like course libraries). Use WeakMap for object-keyed caches to prevent memory leaks.
