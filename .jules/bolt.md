# Bolt's Performance Journal

## 2025-05-14 - Redundant Text Normalization in Course Matching
**Learning:** High-frequency UI loops (like course matching during search) are significantly slowed down by redundant string normalization and tag object parsing. For 2000 courses, these operations were happening 2000 times per search.
**Action:** Use `WeakMap` to cache pre-normalized metadata on stable course objects and hoist search-specific tokenization outside of the scoring loop.

## 2025-05-22 - Redundant Persona Rule Normalization and Tag Flattening
**Learning:** Hot loops that score courses against personas (e.g., `analyzeGaps` and `getRelevanceBadge`) are bottlenecked by repeatedly flattening tag arrays and lowercasing strings. For 2,500 courses, these operations happen thousands of times per call. Persona-specific keywords (boost/penalty) were also being lowercased on every execution.
**Action:** Implement `WeakMap` caching for normalized course metadata (title + tags) and a `Map` for normalized persona rules. This reduces `analyzeGaps` execution time by ~40% for large course sets.
