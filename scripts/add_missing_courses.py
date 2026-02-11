"""Add missing courses from Google Drive to the library."""
import json
import re
from collections import defaultdict
from pathlib import Path

CONTENT_DIR = Path("content")

# Load video metadata
videos = json.loads((CONTENT_DIR / "drive_video_metadata_final.json").read_text())

# Load existing library
library = json.loads((CONTENT_DIR / "video_library_enriched.json").read_text())
existing_codes = {c["code"] for c in library["courses"]}

# Parse codes from video names
code_pattern = re.compile(r"^(\d{3}\.\d{2})")
video_by_code = defaultdict(list)

for v in videos:
    match = code_pattern.match(v["name"])
    if match:
        code = match.group(1)
        video_by_code[code].append(v)

# Find missing codes
missing_codes = set(video_by_code.keys()) - existing_codes
print(f"Missing course codes: {len(missing_codes)}")

# Create new course entries
new_courses = []
for code in sorted(missing_codes):
    vids = video_by_code[code]
    first_name = vids[0]["name"]

    # Extract title part
    title_match = re.match(r"\d{3}\.\d{2}_\d{2}_(.+?)_\d+", first_name)
    title = title_match.group(1).replace("_", " ") if title_match else code

    # Calculate total duration
    total_duration = sum(v.get("duration_seconds", 0) for v in vids)

    new_courses.append({
        "code": code,
        "title": title,
        "description": f"Auto-generated from {len(vids)} videos",
        "duration_seconds": total_duration,
        "duration_formatted": f"{total_duration // 3600}h {(total_duration % 3600) // 60}m",
        "video_count": len(vids),
        "tags": [],
        "source": "google_drive_auto"
    })

print(f"Created {len(new_courses)} new course entries")

# Add to library
library["courses"].extend(new_courses)
total = len(library["courses"])
print(f"Total courses now: {total}")

# Save
(CONTENT_DIR / "video_library_enriched.json").write_text(json.dumps(library, indent=2))
Path("path-builder/src/data/video_library.json").write_text(json.dumps(library, indent=2))
Path("path-builder/src/data/video_library_enriched.json").write_text(json.dumps(library, indent=2))
print("Saved updated library!")
