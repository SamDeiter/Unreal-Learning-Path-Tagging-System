"""Step 1: Add Drive IDs to Video Library
Links videos in video_library_enriched.json to Drive file IDs for transcript matching.
"""
import json
from difflib import SequenceMatcher
from pathlib import Path

CONTENT_DIR = Path("content")

def similarity(a, b):
    """Calculate string similarity ratio."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def main():
    print("=" * 60)
    print("STEP 1: Adding Drive IDs to Video Library")
    print("=" * 60)

    # Load data
    drive_videos = json.loads((CONTENT_DIR / "drive_video_metadata_final.json").read_text())
    library = json.loads((CONTENT_DIR / "video_library_enriched.json").read_text())
    courses = library.get("courses", [])

    # Build lookup by exact name and by similar name
    name_to_drive = {v["name"]: v for v in drive_videos}

    # Track stats
    exact_matches = 0
    fuzzy_matches = 0
    no_match = 0

    for course in courses:
        for vid in course.get("videos", []):
            vid_name = vid.get("name", "")

            # Try exact match first
            if vid_name in name_to_drive:
                drive_data = name_to_drive[vid_name]
                vid["drive_id"] = drive_data["id"]
                vid["duration_seconds"] = drive_data.get("duration_seconds", 0)
                exact_matches += 1
                continue

            # Try fuzzy match
            best_match = None
            best_score = 0
            for drive_name, drive_data in name_to_drive.items():
                score = similarity(vid_name, drive_name)
                if score > best_score and score > 0.85:
                    best_score = score
                    best_match = drive_data

            if best_match:
                vid["drive_id"] = best_match["id"]
                vid["duration_seconds"] = best_match.get("duration_seconds", 0)
                fuzzy_matches += 1
            else:
                no_match += 1

    total = exact_matches + fuzzy_matches + no_match
    print(f"\n✅ Exact matches: {exact_matches}")
    print(f"🔄 Fuzzy matches: {fuzzy_matches}")
    print(f"❌ No match: {no_match}")
    print(f"📊 Coverage: {(exact_matches + fuzzy_matches) / total * 100:.1f}%")

    # Save updated library
    (CONTENT_DIR / "video_library_enriched.json").write_text(
        json.dumps(library, indent=2, ensure_ascii=False)
    )
    print("\n💾 Saved updated library with Drive IDs")

if __name__ == "__main__":
    main()
