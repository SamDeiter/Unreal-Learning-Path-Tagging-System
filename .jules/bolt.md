# Bolt's Performance Journal

## 2025-05-14 - Redundant Text Normalization in Course Matching
**Learning:** High-frequency UI loops (like course matching during search) are significantly slowed down by redundant string normalization and tag object parsing. For 2000 courses, these operations were happening 2000 times per search.
**Action:** Use `WeakMap` to cache pre-normalized metadata on stable course objects and hoist search-specific tokenization outside of the scoring loop.

## 2026-04-08 - ContentGapService Scoring Loop Optimization
**Learning:** The `ContentGapService` scoring loops (`analyzeGaps` and `getRelevanceBadge`) were performing redundant string normalization and array flattening for every course/persona pair. With ~1000 courses and multiple personas, this led to significant main-thread overhead.
**Action:** Implemented a `WeakMap` cache to store pre-normalized course metadata (title and tags) and replaced `for...of` with standard `for` loops in high-frequency scoring functions. This resulted in a measured ~2.9x speedup for bulk analysis.
