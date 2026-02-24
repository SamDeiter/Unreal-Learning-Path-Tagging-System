"""Quick check: what level field do YouTube courses have?"""
import json

with open("path-builder/src/data/video_library_enriched.json", "r", encoding="utf-8") as f:
    data = json.load(f)

courses = data if isinstance(data, list) else data.get("courses", data.get("videos", []))
yt = [c for c in courses if isinstance(c, dict) and c.get("source") == "youtube"]

print(f"Total YouTube courses: {len(yt)}")

# Check level fields
levels = {}
for c in yt:
    lvl = c.get("level", "NONE")
    tags_lvl = (c.get("tags") or {}).get("level", "NONE")
    key = f"level={lvl}, tags.level={tags_lvl}"
    levels[key] = levels.get(key, 0) + 1

for k, v in sorted(levels.items(), key=lambda x: -x[1]):
    print(f"  {k}: {v}")

# Show sample
if yt:
    print(f"\nSample keys: {list(yt[0].keys())}")
    print(f"Sample level: {yt[0].get('level')}")
    print(f"Sample tags: {yt[0].get('tags')}")
    print(f"Sample title: {yt[0].get('title')}")
