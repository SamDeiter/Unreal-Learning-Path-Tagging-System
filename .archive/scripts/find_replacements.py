"""
Cross-reference the 30 removed curated video titles against the
442 YouTube videos in video_library_enriched.json to find potential
re-uploads or replacement videos.
"""
import json
import re

ENRICHED_PATH = "path-builder/src/data/video_library_enriched.json"
CURATED_PATH = "path-builder/src/data/youtube_curated.json"

# The 30 dead curated video titles (from git history)
DEAD_TITLES = [
    "Niagara VFX - Getting Started",
    "Animation in UE5 | Feature Highlight",
    "Procedural Content Generation Framework",
    "MetaSounds in Unreal Engine",
    "Chaos Physics System Overview",
    "Virtual Production with nDisplay",
    "Blueprint Communications | Live Training | Unreal Engine",
    "Data-Driven Design with Data Tables | Live Training | Unreal Engine",
    "Level Design in UE5 | Feature Highlight",
    "World Partition in UE5",
    "Nanite Virtualized Geometry",
    "Lumen Global Illumination and Reflections",
    "Virtual Shadow Maps | Inside Unreal",
    "Control Rig in UE5",
    "Sequencer Cinematics in UE5",
    "Mass Entity System Overview",
    "Enhanced Input System in UE5",
    "Common UI Framework",
    "Modeling Tools in UE5 | Feature Highlight",
    "Water System in UE5",
    "Chaos Destruction Overview",
    "Motion Matching in UE5",
    "PCG Framework Deep Dive | Inside Unreal",
    "Substrate Materials | Inside Unreal",
    "Nanite in UE5 | Feature Highlight",
    "Landscape & Foliage in UE5",
    "UE5 Migration Guide",
    "State Tree AI | Inside Unreal",
    "Large World Coordinates | Inside Unreal",
    "Gameplay Ability System (GAS) | Inside Unreal",
]


def normalize(title):
    """Normalize a title for fuzzy matching."""
    t = title.lower()
    # Remove common suffixes
    for suffix in ["| inside unreal", "| feature highlight", "| live training | unreal engine",
                   "| unreal engine", "| inside ue", "in ue5", "in unreal engine 5",
                   "in unreal engine"]:
        t = t.replace(suffix, "")
    # Remove non-alphanumeric
    t = re.sub(r'[^a-z0-9 ]', '', t)
    return t.strip()


def extract_keywords(title):
    """Extract key topic words from a title."""
    norm = normalize(title)
    stop_words = {"in", "ue5", "the", "a", "an", "and", "or", "of", "for", "with", "on", "to", "at"}
    return {w for w in norm.split() if w not in stop_words and len(w) > 2}


def main():
    with open(ENRICHED_PATH, "r", encoding="utf-8") as f:
        enriched = json.load(f)
    with open(CURATED_PATH, "r", encoding="utf-8") as f:
        curated = json.load(f)

    yt_courses = [c for c in enriched["courses"] if c.get("source") == "youtube"]
    existing_curated_ids = {
        re.search(r'v=([a-zA-Z0-9_-]{11})', r.get("url", "")).group(1)
        for r in curated.get("resources", [])
        if re.search(r'v=([a-zA-Z0-9_-]{11})', r.get("url", ""))
    }

    print(f"Enriched YouTube courses: {len(yt_courses)}")
    print(f"Already curated video IDs: {len(existing_curated_ids)}")
    print(f"Dead titles to search for: {len(DEAD_TITLES)}")
    print("=" * 70)

    found_replacements = []

    for dead_title in DEAD_TITLES:
        dead_kw = extract_keywords(dead_title)
        best_match = None
        best_score = 0

        for course in yt_courses:
            c_title = course.get("title", "")
            c_kw = extract_keywords(c_title)
            overlap = dead_kw & c_kw
            score = len(overlap) / max(len(dead_kw), 1)

            if score > best_score:
                best_score = score
                best_match = course

        code = best_match.get("code", "") if best_match else ""
        already = code in existing_curated_ids

        if best_score >= 0.5:
            status = "ALREADY CURATED" if already else "REPLACEMENT FOUND"
            found_replacements.append({
                "dead_title": dead_title,
                "match_title": best_match["title"],
                "match_code": code,
                "match_url": best_match.get("youtube_url", f"https://www.youtube.com/watch?v={code}"),
                "score": best_score,
                "already_curated": already,
            })
            print(f"\n[{status}] {dead_title}")
            print(f"  -> {best_match['title']}")
            print(f"     https://www.youtube.com/watch?v={code}  (score: {best_score:.0%})")
        else:
            print(f"\n[NO MATCH] {dead_title}")
            if best_match:
                print(f"  best candidate: {best_match['title']} (score: {best_score:.0%})")

    # Summary
    replacements = [r for r in found_replacements if not r["already_curated"]]
    already = [r for r in found_replacements if r["already_curated"]]
    no_match = len(DEAD_TITLES) - len(found_replacements)

    print(f"\n{'=' * 70}")
    print(f"SUMMARY:")
    print(f"  {len(replacements)} replacement videos found (can add to curated)")
    print(f"  {len(already)} already in curated list")
    print(f"  {no_match} no match found in enriched library")

    if replacements:
        print(f"\n--- Videos to add back ---")
        for r in replacements:
            print(f"  {r['dead_title'][:45]:45} -> {r['match_code']}")


if __name__ == "__main__":
    main()
