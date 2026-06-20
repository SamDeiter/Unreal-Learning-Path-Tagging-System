## 2026-06-20 - TagGraphService Performance Overhaul
**Learning:** Significant performance bottlenecks were identified in TagGraphService due to O(N*M) linear scans with redundant regex construction in extraction logic and repeated BFS expansions/string parsing in scoring logic.
**Action:** Use partitioned indexing (Map for O(1) word lookups, pre-compiled regex for phrases) and multi-level memoization (WeakMap for course metadata, Map for BFS expansions) to eliminate redundant work in hot paths.
