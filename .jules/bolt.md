# Bolt's Journal - Performance Learnings

## 2025-05-15 - TagGraphService Performance Overhaul
**Learning:** The `TagGraphService` was performing O(N) linear scans on every text extraction and redundant BFS traversals for every course scoring call. Partitioning the index into a `termMap` (O(1)) and pre-compiling regexes for phrases significantly reduced search time. Implementing BFS caching and `WeakMap`-based course metadata caching eliminated the bottleneck in batch course scoring.
**Action:** Always check for linear scans in hot paths and use `Map`/`WeakMap` for caching static or object-associated metadata. Pre-compile regexes during initialization rather than inside loops.
