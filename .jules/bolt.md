## 2025-05-15 - Optimizing Semantic Deduplication
**Learning:** Performing string tokenization and `Set` creation inside a nested $O(N^2)$ loop is a major performance bottleneck. For semantic deduplication of 20+ passages, this resulted in significant latency.
**Action:** Pre-calculate word sets ($O(N)$) before the loop and use `wordJaccardFromSets` which implements the inclusion-exclusion principle ($|A \cup B| = |A| + |B| - |A \cap B|$) to avoid redundant allocations. This yielded a ~6.4x speedup in benchmarks.
