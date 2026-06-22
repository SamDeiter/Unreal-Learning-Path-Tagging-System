## 2025-05-14 - [Hoisting Regex and Inclusion-Exclusion for Sets]
**Learning:** Instantiating `new RegExp()` and performing string operations like `toLowerCase()` inside hot loops (e.g., iterating over hundreds of transcript segments) is a major bottleneck. Additionally, computing Jaccard similarity by creating a new Set for the union is much slower than using the inclusion-exclusion principle.
**Action:** Always hoist regex compilation and case normalization outside of loops. Use `|A| + |B| - |A ∩ B|` to compute union size for Sets to avoid memory allocation.
