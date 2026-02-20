"""
Build Video Lookup — maps VTT filenames to Google Drive video IDs.
=================================================================
Reads drive_video_metadata_final.json and outputs a lightweight
prototype/video_lookup.json for the dynamic viewer.

Usage:
    python scripts/build_video_lookup.py
"""
import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
METADATA_FILE = REPO_ROOT / "content" / "drive_video_metadata_final.json"
OUTPUT_FILE = REPO_ROOT / "prototype" / "video_lookup.json"


def extract_key(filename: str) -> tuple[str, str] | None:
    """Extract (course_code, video_key) from a drive metadata filename.
    
    Example: '100.01_18_BlueprintEditor_55.mp4' -> ('100_01', '18_BlueprintEditor')
    """
    # Strip extension
    name = filename.rsplit(".", 1)[0]
    # Match course code pattern: digits.digits_digits_Name
    m = re.match(r"(\d+\.\d+)_(\d+_.+?)_\d+$", name)
    if not m:
        # Try without trailing version number
        m = re.match(r"(\d+\.\d+)_(\d+_.+?)$", name)
    if not m:
        return None
    course = m.group(1).replace(".", "_")
    video_key = m.group(2)
    return course, video_key


def main():
    with open(METADATA_FILE, encoding="utf-8") as f:
        metadata = json.load(f)

    lookup = {}
    for entry in metadata:
        result = extract_key(entry["name"])
        if not result:
            continue
        course, video_key = result
        key = f"{course}/{video_key}"
        lookup[key] = {
            "drive_id": entry["id"],
            "duration": entry.get("duration_seconds", 0),
            "name": entry["name"],
        }

    OUTPUT_FILE.write_text(
        json.dumps(lookup, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"✓ Built video lookup with {len(lookup)} entries → {OUTPUT_FILE.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
