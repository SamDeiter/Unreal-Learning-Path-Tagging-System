"""Link Drive video files (already scraped) to courses missing videos.

Matches Drive filenames like '127.02_01_Intro_53.mp4' to course code '127.02'
and populates the 'videos' array with drive_id, name, and duration.

Run: python scripts/link_drive_videos.py
"""
import json
import re
import sys
import io
from pathlib import Path
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DRIVE_META = Path('content/drive_video_metadata_final.json')
ENRICHED_PATHS = [
    Path('content/video_library_enriched.json'),
    Path('path-builder/src/data/video_library_enriched.json'),
    Path('path-builder/public/data/video_library_enriched.json'),
]

# ── 1. Load Drive metadata ──────────────────────────────────────
drive_files = json.loads(DRIVE_META.read_text(encoding='utf-8'))
print(f"Loaded {len(drive_files)} Drive video files")

# ── 2. Group Drive files by course code prefix ──────────────────
# Filenames follow: CODE_INDEX_TITLE_VERSION.mp4
# e.g. 127.02_01_Intro_53.mp4  -> code = "127.02"
# e.g. 100.01_08_15_UMG_Editor_5.5.mp4 -> code = "100.01"
code_to_drive = defaultdict(list)
unmatched = 0

for df in drive_files:
    name = df.get('name', '')
    # Match patterns like "127.02_" or "100.01_"
    m = re.match(r'^(\d{2,3}\.\d{2})', name)
    if m:
        code = m.group(1)
        code_to_drive[code].append(df)
    else:
        unmatched += 1

print(f"Grouped into {len(code_to_drive)} course codes ({unmatched} files didn't match a code pattern)")

# ── 3. Load enriched course data ────────────────────────────────
enriched_path = next((p for p in ENRICHED_PATHS if p.exists()), None)
if not enriched_path:
    print("ERROR: No enriched JSON found!")
    sys.exit(1)

data = json.loads(enriched_path.read_text(encoding='utf-8'))
courses = data.get('courses', []) if isinstance(data, dict) else data

# Build a code -> course index
code_to_course = {}
for c in courses:
    code = c.get('code', '')
    if code:
        code_to_course[code] = c

print(f"Loaded {len(courses)} courses ({len(code_to_course)} with codes)")

# ── 4. Link Drive files to courses ──────────────────────────────
linked_count = 0
videos_added = 0
already_had = 0

for code, drive_vids in sorted(code_to_drive.items()):
    course = code_to_course.get(code)
    if not course:
        continue

    existing_vids = course.get('videos', [])
    existing_drive_ids = {v.get('drive_id') for v in existing_vids if v.get('drive_id')}

    # Sort Drive files by index number in filename
    def sort_key(df):
        name = df.get('name', '')
        # Extract index: "127.02_03_Title.mp4" -> 3
        m = re.match(r'^\d{2,3}\.\d{2}_(\d+)', name)
        return int(m.group(1)) if m else 999
    
    drive_vids_sorted = sorted(drive_vids, key=sort_key)

    new_vids = []
    for df in drive_vids_sorted:
        new_vids.append({
            'name': df.get('name', ''),
            'drive_id': df.get('id', ''),
            'duration_seconds': df.get('duration_seconds', 0),
        })

    if new_vids:
        # Overwrite to ensure drive_ids are first and properly ordered
        course['videos'] = new_vids
        course['video_count'] = len(course['videos'])
        linked_count += 1
        videos_added += len(new_vids)

# ── 5. Save updated data ────────────────────────────────────────
output = data if isinstance(data, dict) else {'courses': data}
for p in ENRICHED_PATHS:
    if p.parent.exists():
        p.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding='utf-8')
        print(f"  Saved: {p}")

# ── 6. Report ────────────────────────────────────────────────────
print(f"\n{'='*50}")
print(f"RESULTS:")
print(f"  Courses updated:     {linked_count}")
print(f"  Videos added:        {videos_added}")
print(f"  Already linked:      {already_had}")
print(f"{'='*50}")

# Show some examples
print(f"\nSample updated courses:")
count = 0
for code, drive_vids in sorted(code_to_drive.items()):
    course = code_to_course.get(code)
    if course and len(course.get('videos', [])) > 0:
        print(f"  {code}: {course.get('title','')[:50]} -> {len(course['videos'])} videos")
        count += 1
        if count >= 10:
            break
