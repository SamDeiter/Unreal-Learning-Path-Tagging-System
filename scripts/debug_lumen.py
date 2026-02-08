"""Find the best Lumen-specific courses (not Lightmass/baked)."""
import json

lib = json.load(open("path-builder/src/data/video_library_enriched.json"))
courses = lib["courses"]
idx = json.load(open("path-builder/src/data/search_index.json"))
course_words = idx.get("course_words", {})

print("=== Courses with 'lumen' in tags, checking transcripts ===")
for c in courses:
    all_tags = c.get("canonical_tags", []) + c.get("gemini_system_tags", []) + c.get("extracted_tags", [])
    tag_str = " ".join(str(t) for t in all_tags).lower()
    if "lumen" not in tag_str:
        continue

    code = c["code"]
    title = c["title"]
    words = course_words.get(code, {})

    lumen_count = words.get("lumen", 0)
    lightmass_count = words.get("lightmass", 0)
    baked_count = words.get("baked", 0) + words.get("baking", 0)
    dynamic_count = words.get("dynamic", 0)
    reflection_count = words.get("reflection", 0) + words.get("reflections", 0)
    noise_count = words.get("noise", 0) + words.get("artifacts", 0)

    has_videos = bool(c.get("videos", []) and c["videos"][0].get("drive_id"))

    print(f"  {code}: {title}")
    print(f"    Playable: {has_videos}")
    print(f"    lumen={lumen_count} lightmass={lightmass_count} baked={baked_count} dynamic={dynamic_count} reflection={reflection_count} noise={noise_count}")
    print()
