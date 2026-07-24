# Bolt's Journal

## 2026-05-24 - [Semantic Deduplication Performance in Search Pipeline]
**Learning:** In the RAG search pipeline, semantic deduplication of retrieved passages is an O(N^2) operation. Calling `wordJaccard` on raw strings inside the loop repeatedly tokenizes, filters, and constructs Set objects. By pre-calculating word sets once using a local Map (to maintain object purity and prevent freezing/sealing errors), and using the Inclusion-Exclusion Principle (|A ∪ B| = |A| + |B| - |A ∩ B|) to compute union sizes, we can eliminate redundant Set allocations and reduce mean latency by ~10x.
**Action:** Always pre-calculate sets or expensive properties when executing O(N^2) or matching loops, map them using local Map objects instead of mutating state objects, and use mathematical simplifications (like Inclusion-Exclusion) to compute unions/intersections cleanly without object allocation.
