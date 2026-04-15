# Bolt's Performance Journal

## 2025-05-14 - Redundant Text Normalization in Course Matching
**Learning:** High-frequency UI loops (like course matching during search) are significantly slowed down by redundant string normalization and tag object parsing. For 2000 courses, these operations were happening 2000 times per search.
**Action:** Use `WeakMap` to cache pre-normalized metadata on stable course objects and hoist search-specific tokenization outside of the scoring loop.

## 2025-05-15 - Redundant Metadata Normalization in Content Gap Analysis
**Learning:** Similar to course matching, the Content Gap analysis performed expensive string normalization and tag flattening repeatedly for thousands of courses.
**Action:** Implemented a unified `getNormalizedCourse` helper using `WeakMap` to cache lowercased titles and tags, and hoisted persona rule normalization into a `Map` cache.
