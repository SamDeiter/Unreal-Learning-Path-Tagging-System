# Bolt's Performance Journal

## 2025-05-14 - Redundant Text Normalization in Course Matching
**Learning:** High-frequency UI loops (like course matching during search) are significantly slowed down by redundant string normalization and tag object parsing. For 2000 courses, these operations were happening 2000 times per search.
**Action:** Use `WeakMap` to cache pre-normalized metadata on stable course objects and hoist search-specific tokenization outside of the scoring loop.

## 2026-04-11 - Optimized Semantic Deduplication with Pre-tokenized Sets
**Learning:** The semantic deduplication loop in `searchPipeline.js` was an (N^2)$ operation that re-tokenized strings on every comparison. Update `wordJaccard` to accept pre-computed Sets and use the inclusion-exclusion principle for union size calculations avoids redundant work and expensive Set creations.
**Action:** Always pre-tokenize strings when performing many-to-many text comparisons and use the inclusion-exclusion principle to compute Jaccard similarity without creating new Set objects for the union.
