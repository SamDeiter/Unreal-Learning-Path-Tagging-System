"""Audit the enrichment pipeline output for completeness."""
import json
from pathlib import Path

content_dir = Path("content")

# Pipeline state
state = json.load(open(content_dir / "pipeline_state.json", encoding="utf-8"))
print("=== PIPELINE STATE ===")
print(f"  Last completed phase: {state['last_completed_phase']}")
print(f"  Started:  {state['started_at']}")
print(f"  Finished: {state['updated_at']}")
print(f"  Complete: {state['pipeline_complete']}")
print(f"  Courses tracked: {len(state.get('completed_courses', {}))}")
print()

# Enriched data audit
data = json.load(open(content_dir / "video_library_enriched.json", encoding="utf-8"))
courses = data["courses"]
print(f"=== ENRICHED DATA ({len(courses)} courses) ===")

fields = ["ai_tags", "canonical_tags", "gemini_enriched", "tags", "video_count", "thumbnail_url", "has_cc"]
for field in fields:
    has = sum(1 for c in courses if c.get(field))
    empty_list = sum(
        1 for c in courses
        if isinstance(c.get(field), list) and len(c.get(field)) == 0
    )
    print(f"  {field:20s}: {has:3d} have data, {empty_list:3d} empty lists")

# Tags sub-fields
print()
print("=== TAGS SUB-FIELDS ===")
for tf in ["topic", "level", "industry", "product"]:
    has = sum(1 for c in courses if c.get("tags", {}).get(tf))
    print(f"  tags.{tf:12s}: {has:3d} / {len(courses)}")

# Courses with no ai_tags
no_ai = [c["code"] for c in courses if not c.get("ai_tags") or len(c.get("ai_tags", [])) == 0]
print(f"\nCourses with 0 ai_tags: {len(no_ai)}")
if no_ai:
    for code in no_ai:
        print(f"  - {code}")

# YouTube vs Original
print()
yt = [c for c in courses if c.get("source") == "youtube"]
non_yt = [c for c in courses if c.get("source") != "youtube"]
print(f"YouTube courses:  {len(yt)}")
print(f"Original courses: {len(non_yt)}")

# ai_tags stats
tag_counts = [len(c.get("ai_tags", [])) for c in courses]
print(f"\nai_tags per course: min={min(tag_counts)}, max={max(tag_counts)}, avg={sum(tag_counts)/len(tag_counts):.1f}")

# Check the main.py phases
print()
print("=== PHASE ANALYSIS ===")
# Phase 0: transcripts
transcript_dir = content_dir / "transcripts"
vtt_count = len(list(transcript_dir.glob("*.json"))) if transcript_dir.exists() else 0
print(f"  Phase 0 - Transcripts: {vtt_count} JSON files in content/transcripts/")

# Phase 3: tag extraction
has_tags = sum(1 for c in courses if len(c.get("ai_tags", [])) > 0)
print(f"  Phase 3 - Tag extraction: {has_tags}/{len(courses)} have ai_tags")

# Phase 4: edges
edges_path = content_dir / "generated_edges.json"
if edges_path.exists():
    edges = json.load(open(edges_path, encoding="utf-8"))
    print(f"  Phase 4 - Edges: {len(edges)} generated")
else:
    print("  Phase 4 - Edges: NOT FOUND")

# Phase 5: Gemini enrichment
enriched = sum(1 for c in courses if c.get("gemini_enriched"))
print(f"  Phase 5 - Gemini enriched: {enriched}/{len(courses)}")

# Check for suspicious patterns
print()
print("=== SUSPICIOUS PATTERNS ===")
# Courses with very few tags
sparse = [(c["code"], len(c.get("ai_tags", []))) for c in courses if 0 < len(c.get("ai_tags", [])) < 3]
if sparse:
    print(f"  Courses with < 3 ai_tags: {len(sparse)}")
    for code, count in sparse:
        print(f"    {code}: {count} tags")
else:
    print("  No courses with suspiciously few tags ✓")

# Courses missing tags object
no_tags_obj = [c["code"] for c in courses if not c.get("tags")]
if no_tags_obj:
    print(f"  Courses missing tags object: {len(no_tags_obj)}")
else:
    print("  All courses have tags object ✓")
