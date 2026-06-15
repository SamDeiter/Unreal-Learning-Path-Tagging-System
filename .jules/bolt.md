## 2025-05-14 - Cache BFS expansions in TagGraphService
**Learning:** Performance bottlenecks in batch scoring often stem from redundant graph traversals (BFS) and string normalization within tight loops. Caching BFS results per-tag and course metadata (Set creation/normalization) per-course-identity (using WeakMap) provides massive speedups.
**Action:** Always check for repeated graph traversals or data normalization when processing large collections of objects against a set of queries. Use WeakMap for object-keyed metadata to prevent memory leaks.
