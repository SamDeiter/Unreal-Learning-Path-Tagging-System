# Bolt Performance Journal

## 2025-02-12 - Initializing Bolt Journal
**Learning:** Found that textSimilarity.js computes word sets and intersections inside comparison loops dynamically without caching, which causes O(N²) regex split and set construction overhead during semantic deduplication of search passages.
**Action:** Precompute word sets using a local `Map` and optimize Jaccard similarity via the Inclusion-Exclusion Principle to avoid Union Set allocations.
