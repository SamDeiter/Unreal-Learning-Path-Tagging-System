## 2026-07-20 - Optimizing Jaccard Similarity and Semantic Deduplication Loops

**Learning:**
Performing semantic deduplication over a collection of text passages in a nested loop results in O(N^2) similarity checks. Calling a raw string similarity function like `wordJaccard` on each comparison triggers redundant tokenization, array filters, and Set creations. Pre-calculating word sets into a local `Map` outside the loop reduces tokenization complexity to O(N). Furthermore, computing Jaccard similarity via the Inclusion-Exclusion Principle (`|A ∪ B| = |A| + |B| - |A ∩ B|`) allows us to determine the union size in O(1) space with zero garbage collection overhead and object allocations.

**Action:**
Always extract and pre-compute tokenized representations (like Sets or stems) outside nested comparison loops. When computing Set-based similarity metrics (such as Jaccard similarity), utilize mathematical properties like the Inclusion-Exclusion Principle to calculate the union size directly, entirely bypassing runtime array/Set allocations.
