## 2025-05-15 - Tokenizing in O(N^2) loops
**Learning:** Tokenizing strings and creating `Set` objects inside a nested $O(N^2)$ loop (e.g., for Jaccard similarity in deduplication) is a major bottleneck that scales poorly with the number of items.
**Action:** Pre-calculate word sets once ($O(N)$) and use a specialized Jaccard implementation that operates on pre-calculated Sets and uses the inclusion-exclusion principle for the union size calculation.
