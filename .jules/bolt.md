## 2025-06-08 - Graph and Extraction Caching
**Learning:** In batch operations like course ranking, redundant graph traversals and string processing are the primary bottlenecks. Identity-based caching (WeakMap for objects, Map for primitives/IDs) can reduce computation time by over 90% without breaking functional purity.
**Action:** Always look for O(N*M) patterns where M is a repetitive sub-task (like BFS) and move it to a cached O(M) lookup outside the main loop.
