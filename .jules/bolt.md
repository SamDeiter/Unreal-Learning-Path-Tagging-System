## 2025-05-15 - Tag Extraction Bottleneck
**Learning:** `TagGraphService.extractTagsFromText` was performing O(N) string matching using dynamically created regular expressions on every call. As the tag taxonomy grows, this becomes a significant bottleneck in the search pipeline.
**Action:** Partition tag indices into a `Map` for O(1) single-word lookups and a pre-compiled `phraseIndex` for multi-word matches. This avoids redundant regex compilation and linear scans for the majority of terms.
