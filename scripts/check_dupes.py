"""Quick check: how many nanite-related doc keys exist."""
import json

d = json.load(open("path-builder/src/data/doc_links.json", encoding="utf-8"))
nanite = [(k, d[k]["label"]) for k in d if "nanite" in k.lower()]
print(f"Keys containing 'nanite': {len(nanite)}")
for k, label in nanite:
    print(f"  {k}: {label}")

# Also check for duplicate labels
from collections import Counter

labels = Counter(v["label"] for v in d.values())
dupes = [(label, count) for label, count in labels.most_common(20) if count > 1]
print("\nTop duplicated labels:")
for label, count in dupes[:10]:
    print(f"  [{count}x] {label}")
