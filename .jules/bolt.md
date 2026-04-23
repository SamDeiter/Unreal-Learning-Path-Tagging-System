# Bolt's Performance Journal

## 2025-05-14 - Redundant Text Normalization in Course Matching
**Learning:** High-frequency UI loops (like course matching during search) are significantly slowed down by redundant string normalization and tag object parsing. For 2000 courses, these operations were happening 2000 times per search.
**Action:** Use `WeakMap` to cache pre-normalized metadata on stable course objects and hoist search-specific tokenization outside of the scoring loop.

## 2026-04-13 - Metadata Caching in ContentGapService
**Learning:** Scoring operations on large collections (~2,500 courses) are significantly slowed by repeated string normalization (lowercasing) and array flattening/joining. Caching these results per-object using a WeakMap and hoisting persona-specific rule normalization yields a significant speedup (~51%).
**Action:** Always check for redundant normalization in hot loops that iterate over large data sets and use WeakMap for non-intrusive caching of derived metadata.
