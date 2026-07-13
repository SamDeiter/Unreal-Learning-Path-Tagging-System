# Bolt's Performance Journal ⚡

This journal captures critical performance learnings, bottlenecks, and optimizations within this codebase.

## Format
## YYYY-MM-DD - [Title]
**Learning:** [Insight]
**Action:** [How to apply next time]

---

## 2025-05-15 - Optimized Semantic Deduplication
**Learning:** Pre-calculating word sets for Jaccard similarity avoids redundant $O(N^2)$ tokenization and Set allocations in the deduplication loop. For 100 long passages, this yields a ~2.4x speedup.
**Action:** Always hoist expensive tokenization/parsing out of comparison loops when doing N-to-M or N-to-N comparisons.
