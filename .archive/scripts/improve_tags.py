"""Quick Phase 2 tag improvement."""
import json
from pathlib import Path

CONTENT_DIR = Path('content')
DATA_DIR = Path('path-builder/src/data')

data = json.loads((CONTENT_DIR / 'video_library_enriched.json').read_text())
courses = data['courses']

# More specific keyword to tag mappings
keyword_tags = {
    'optimization': 'optimization.general',
    'animation': 'animation.general',
    'runtime': 'animation.runtime',
    'speed warp': 'animation.runtime',
    'ui creation': 'ui.umg',
    'umg': 'ui.umg',
    'brush': 'rendering.material',
    'final output': 'rendering.postprocess',
    'render': 'rendering.postprocess',
    'material': 'rendering.material',
    'substrate': 'rendering.material',
    'vdb': 'rendering.volume',
    'lighting': 'rendering.lighting',
    'cinematics': 'cinematic.sequencer',
    'metasound': 'audio.metasound',
    'niagara': 'rendering.niagara',
    'landscape': 'worldbuilding.landscape',
    'control rig': 'animation.controlrig',
    'sequencer': 'cinematic.sequencer',
}

improved = 0
for c in courses:
    if len(c.get('canonical_tags', [])) < 2:
        title = c.get('title', '').lower()
        for keyword, tag in keyword_tags.items():
            if keyword in title and tag not in c.get('canonical_tags', []):
                c.setdefault('canonical_tags', []).append(tag)
                improved += 1
                print(f'+ {c["code"]}: Added {tag}')

# Save
for path in [CONTENT_DIR / 'video_library_enriched.json',
             DATA_DIR / 'video_library.json',
             DATA_DIR / 'video_library_enriched.json']:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))

# Count remaining sparse
sparse = [c for c in courses if len(c.get('canonical_tags', [])) < 2]
print(f'\n✅ Added {improved} tags')
print(f'📊 Sparse courses remaining: {len(sparse)}')
for c in sparse:
    print(f'   {c["code"]}: {c["title"][:50]}')
