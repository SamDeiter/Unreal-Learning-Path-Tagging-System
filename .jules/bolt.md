## 2026-05-20 - Semantic Deduplication Optimization
**Learning:** Tokenizing strings and creating `Set` objects inside a nested $O(N^2)$ loop is a major bottleneck. Pre-calculating word sets once ($O(N)$) and using Jaccard arithmetic (`sizeA + sizeB - intersection`) yields ~8x speedup for semantic deduplication.
**Action:** Always pre-calculate metadata (like word Sets) outside of comparison loops, and use the inclusion-exclusion principle for set similarity to avoid redundant set operations.
