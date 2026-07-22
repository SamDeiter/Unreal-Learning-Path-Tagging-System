# Bolt's Performance Journal

## 2026-05-24 - Jaccard Similarity and O(N^2) Loop Optimization
**Learning:** Under an O(N^2) similarity comparison loop, performing inline string tokenization, regex-based splitting, and Set allocations on every iteration introduces a massive bottleneck. Pre-calculating word sets using a local `Map` reference-mapping reduces latency significantly. Furthermore, calculating Jaccard similarity union size via the Inclusion-Exclusion Principle (`|A ∪ B| = |A| + |B| - |A ∩ B|`) completely avoids allocating a new Set object on every single comparison.
**Action:** Always pre-calculate expensive parsing or tokenization structures before entering comparison loops, and use algebraic properties (like inclusion-exclusion) to compute set unions without allocation.
