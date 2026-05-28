## 2025-05-22 - Batch Graph Scoring Optimization
**Learning:** In systems where a shared graph is traversed for thousands of items in a batch (e.g., scoring a course library against a set of tags), redundant BFS traversals and object property normalization are massive bottlenecks. Caching BFS expansions per-tag and course metadata per-identity (using WeakMap) can reduce per-item processing time by 60-70%.
**Action:** Use `WeakMap` for identity-based metadata caching of large objects. Decouple graph traversal from item-specific matching to enable efficient reuse of BFS results across a batch.
