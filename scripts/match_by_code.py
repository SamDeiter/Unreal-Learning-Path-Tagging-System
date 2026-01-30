"""
Match unmatched courses by course code prefix in video filenames.
"""
import json
import re
from pathlib import Path
from collections import defaultdict

CONTENT_DIR = Path('content')
DATA_DIR = Path('path-builder/src/data')

data = json.loads((CONTENT_DIR / 'video_library_enriched.json').read_text())
videos = json.loads((CONTENT_DIR / 'drive_video_metadata_final.json').read_text())

# Find unmatched courses
unmatched = [c for c in data['courses'] if c.get('duration_source') != 'drive']
print(f"Unmatched courses: {len(unmatched)}")

# Extract course code prefix from video names (e.g., "112.02" from "112.02_03_Night_Lighting.mp4")
code_pattern = re.compile(r'^(\d{3}\.\d{2})')

# Build code -> videos index
code_videos = defaultdict(list)
for v in videos:
    match = code_pattern.match(v['name'])
    if match:
        code = match.group(1)
        code_videos[code].append(v)

print(f"\nFound {len(code_videos)} unique course codes in videos")
print(f"Sample codes: {list(code_videos.keys())[:10]}")

# Match unmatched courses
matched = 0
for c in unmatched:
    code = c['code']
    if code in code_videos:
        vids = code_videos[code]
        duration = sum(v.get('duration_seconds', 0) for v in vids)
        c['duration_minutes'] = duration // 60
        c['duration_source'] = 'drive'
        c['video_count'] = len(vids)
        matched += 1
        print(f"+ {code}: {len(vids)} videos, {duration//60} min")
    else:
        print(f"- {code}: No videos found")

print(f"\nMatched {matched} more courses!")

# Save updated data
if matched > 0:
    for path in [CONTENT_DIR / 'video_library_enriched.json',
                 DATA_DIR / 'video_library.json',
                 DATA_DIR / 'video_library_enriched.json']:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print("Saved updated data!")

# Final count
still_unmatched = [c for c in data['courses'] if c.get('duration_source') != 'drive']
print(f"\nRemaining unmatched: {len(still_unmatched)}")
for c in still_unmatched:
    print(f"  {c['code']}: {c['title']}")
