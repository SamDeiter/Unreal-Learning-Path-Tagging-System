## 2025-05-15 - Optimizing Semantic Deduplication with Pre-calculated Sets

**Learning:** Redundant tokenization and Set creation inside $O(N^2)$ comparison loops (like Jaccard similarity for deduplication) is a significant performance bottleneck. In `searchPipeline.js`, pre-calculating word sets once per passage ($O(N)$) and using the Inclusion-Exclusion Principle ($|A \cup B| = |A| + |B| - |A \cap B|$) to compute similarity without new Set allocations yielded a ~4.5x speedup in benchmarks.

**Action:** Identify nested comparison loops in search or ranking pipelines. Hoist expensive string splitting and Set initialization out of the loop by pre-calculating optimized data structures. Use the Inclusion-Exclusion Principle to avoid allocating "union" Sets.
