# Bolt's Journal — Critical Learnings

This journal is used to capture critical, codebase-specific performance learnings to help avoid mistakes and make better decisions.

## 2026-05-22 - O(N^2) Semantic Deduplication Tokenization Overhead
**Learning:** In `searchPipeline.js`, the semantic deduplication loop compared each retrieved passage with already kept passages using Jaccard similarity. Because `wordJaccard(textA, textB)` was called inside the nested loop, it repeatedly tokenized, lowercased, and filtered the same text strings, yielding O(N^2) tokenization overhead. Pre-calculating word sets beforehand eliminates redundant splits. Using a Map (instead of mutating the object properties inline) prevents side effects if passage objects are frozen or sealed in other parts of the application. Furthermore, calculating the union size using the Inclusion-Exclusion Principle (|A ∪ B| = |A| + |B| - |A ∩ B|) completely avoids allocating a new union Set inside the inner loop.
**Action:** Always pre-calculate expensive text transformations (such as tokenization, lowercasing, stemming) outside of nested loops and map them using a local `Map` to guarantee data/object purity. Utilize set theory principles (Inclusion-Exclusion) to compute union/intersection properties to avoid Set allocations.
