"""Audit tag data consistency across the application."""
import json

with open("path-builder/src/data/video_library_enriched.json") as f:
    data = json.load(f)

courses = data if isinstance(data, list) else data.get("courses", [])
total = len(courses)
enriched = sum(1 for c in courses if c.get("gemini_enriched"))
missing = [c.get("code", "?") for c in courses if not c.get("gemini_enriched")]

print(f"Total: {total}, Enriched: {enriched}, Missing: {len(missing)}")
print(f"Missing codes: {missing[:30]}")

# Check what fields missing courses have
for code in missing[:3]:
    for c in courses:
        if c.get("code") == code:
            print(f"\n--- {code}: {c.get('title', '?')} ---")
            print(f"  gemini_enriched: {c.get('gemini_enriched')}")
            print(f"  ai_tags: {len(c.get('ai_tags', []))} items")
            print(f"  transcript_tags: {len(c.get('transcript_tags', []))} items")
            print(f"  gemini_system_tags: {len(c.get('gemini_system_tags', []))} items")
            print(f"  extracted_tags: {len(c.get('extracted_tags', []))} items")
            print(f"  canonical_tags: {len(c.get('canonical_tags', []))} items")
            break

# Check for duplicate General display names in tags.json
print("\n=== Tags.json General Duplicates ===")
with open("path-builder/src/data/tags.json") as f:
    tags_data = json.load(f)

tags = tags_data.get("tags", tags_data)
generals = [t for t in tags if t.get("display_name", "").lower() == "general"]
print(f"Tags with display_name='General': {len(generals)}")
for g in generals:
    print(f"  {g['tag_id']}: {g['display_name']}")

# Check substring inflation - how many courses match "ai" via substring
print("\n=== Substring Inflation: 'ai' ===")
ai_substring = 0
ai_exact = 0
for c in courses:
    all_tags = (
        (c.get("canonical_tags") or [])
        + (c.get("ai_tags") or [])
        + (c.get("gemini_system_tags") or [])
        + (c.get("transcript_tags") or [])
        + (c.get("extracted_tags") or [])
    )
    all_lower = [t.lower() for t in all_tags if isinstance(t, str)]
    if any("ai" in t for t in all_lower):
        ai_substring += 1
    if any(t == "ai" for t in all_lower):
        ai_exact += 1

print(f"Courses matching 'ai' substring: {ai_substring}")
print(f"Courses matching 'ai' exact: {ai_exact}")
