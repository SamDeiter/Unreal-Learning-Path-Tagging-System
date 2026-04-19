# Bolt's Performance Journal

## 2025-05-14 - Redundant Text Normalization in Course Matching
**Learning:** High-frequency UI loops (like course matching during search) are significantly slowed down by redundant string normalization and tag object parsing. For 2000 courses, these operations were happening 2000 times per search.
**Action:** Use `WeakMap` to cache pre-normalized metadata on stable course objects and hoist search-specific tokenization outside of the scoring loop.

## 2025-05-23 - O(N^2) Redundant Tokenization in Semantic Deduplication
**Learning:** The semantic deduplication process in the RAG pipeline was re-tokenizing the same passages repeatedly in an $O(N^2)$ loop. Additionally, Jaccard similarity was using expensive Set union operations (spreading arrays into new Sets).
**Action:** Pre-tokenize passages once ($O(N)$), update `wordJaccard` to accept pre-computed Sets, and use the inclusion-exclusion principle ($|A \cup B| = |A| + |B| - |A \cap B|$) for union calculation.
