## 2025-05-15 - Tag Extraction Complexity Bottleneck
**Learning:** The `TagGraphService.extractTagsFromText` method was performing a linear $O(N)$ scan over the entire term index (600+ terms) for every query. This was compounded by repeated `RegExp` instantiation inside the loop for phrase matching.
**Action:** Partitioned the term index into a `phraseIndex` (for pre-compiled regex matching) and a `termMap` (for $O(1)$ single-word lookups). This yielded a ~7.5x performance boost in tag extraction (from ~1.05ms to ~0.14ms per call).
