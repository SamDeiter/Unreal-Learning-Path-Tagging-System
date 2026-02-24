"""
sort_video_order.py — Sort each course's 'videos' array by the numeric
prefix in the filename (e.g. 100.03_01_ → sort key 1, 100.03_05_ → 5).

Fixes: videos were stored in arbitrary disk-scan order instead of
the correct pedagogical sequence encoded in the filename prefix.

Processes BOTH copies of video_library_enriched.json:
  - content/video_library_enriched.json  (source of truth)
  - path-builder/src/data/video_library_enriched.json (runtime)
"""
import json
import re
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FILES_TO_FIX = [
    ROOT / "content" / "video_library_enriched.json",
    ROOT / "path-builder" / "src" / "data" / "video_library_enriched.json",
]


def extract_sort_key(video_name: str) -> int:
    """Extract numeric prefix from filename like '100.03_03_Levels_55.mp4' → 3."""
    # Match pattern: courseCode_NN_ where NN is the video number
    m = re.search(r'_(\d+)[_\.]', video_name)
    if m:
        return int(m.group(1))
    return 999  # fallback: push unknowns to end


def sort_videos_in_library(filepath: Path) -> int:
    """Sort all courses' video arrays by filename prefix. Returns count of courses fixed."""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    courses = data if isinstance(data, list) else data.get("courses", data)
    fixed_count = 0

    for course in courses:
        videos = course.get("videos", [])
        if len(videos) <= 1:
            continue

        # Check if already sorted
        keys_before = [extract_sort_key(v.get("name", "")) for v in videos]
        sorted_keys = sorted(keys_before)

        if keys_before != sorted_keys:
            # Sort the videos array in place
            videos.sort(key=lambda v: extract_sort_key(v.get("name", "")))
            course["videos"] = videos
            fixed_count += 1
            print(f"  Fixed: {course.get('code', '?')} — {course.get('title', '?')[:60]}")
            print(f"    Before: {keys_before}")
            print(f"    After:  {sorted_keys}")

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')

    return fixed_count


def main():
    total_fixed = 0
    for filepath in FILES_TO_FIX:
        if not filepath.exists():
            print(f"⚠ Skipping (not found): {filepath}")
            continue
        print(f"\n📂 Processing: {filepath.relative_to(ROOT)}")
        count = sort_videos_in_library(filepath)
        total_fixed += count
        print(f"  → {count} courses had videos re-ordered")

    print(f"\n✅ Done. Total courses fixed across all files: {total_fixed}")


if __name__ == "__main__":
    main()
