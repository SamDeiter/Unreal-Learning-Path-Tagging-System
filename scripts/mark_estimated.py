"""Mark 2 remaining unmatched courses."""
import json
from pathlib import Path

CONTENT_DIR = Path('content')
DATA_DIR = Path('path-builder/src/data')

data = json.loads((CONTENT_DIR / 'video_library_enriched.json').read_text())

# Find the 2 unmatched and mark with estimated flag
for c in data['courses']:
    if c.get('duration_source') != 'drive':
        print(f"{c['code']}: {c['title']}")
        print(f"  Current duration: {c.get('duration_minutes', 0)} min")
        c['duration_source'] = 'estimated'
        c['not_in_drive'] = True

# Save
for path in [CONTENT_DIR / 'video_library_enriched.json',
             DATA_DIR / 'video_library.json',
             DATA_DIR / 'video_library_enriched.json']:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))

print('\nMarked as estimated - these courses may not exist on Drive yet.')
