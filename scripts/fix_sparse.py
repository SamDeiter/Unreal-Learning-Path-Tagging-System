"""Fix all sparse courses with direct tag assignments."""
import json
from pathlib import Path

CONTENT_DIR = Path('content')
DATA_DIR = Path('path-builder/src/data')

data = json.loads((CONTENT_DIR / 'video_library_enriched.json').read_text())
courses = data['courses']

# Direct mappings for all sparse courses
extra_mappings = {
    '204.08': ['optimization.general', 'performance.profiling'],
    '307.00': ['animation.general', 'animation.runtime'],
    '102.00': ['ui.umg', 'blueprints.general'],
    '209.02': ['rendering.postprocess', 'rendering.general'],
    '209.03': ['rendering.postprocess', 'rendering.general'],
    '301.01': ['rendering.material', 'rendering.general'],
    '101.03': ['rendering.material', 'rendering.substrate'],
    '301.02': ['rendering.material', 'worldbuilding.environment'],
    '313.02': ['tools.metahuman', 'animation.general'],
    '305.02': ['cinematic.sequencer', 'cinematic.camera'],
    '216.00': ['xr.ar', 'xr.general'],
    '216.03': ['xr.vr', 'xr.general'],
    '206.02': ['datasmith.general', 'automation.general'],
    '226.02': ['motiondesign.general', 'cinematic.sequencer'],
}

improved = 0
for c in courses:
    code = c.get('code', '')
    if code in extra_mappings:
        for tag in extra_mappings[code]:
            if tag not in c.get('canonical_tags', []):
                c.setdefault('canonical_tags', []).append(tag)
                improved += 1
                print(f'+ {code}: Added {tag}')

# Save
for path in [CONTENT_DIR / 'video_library_enriched.json',
             DATA_DIR / 'video_library.json',
             DATA_DIR / 'video_library_enriched.json']:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))

sparse = [c for c in courses if len(c.get('canonical_tags', [])) < 2]
print(f'\n✅ Added {improved} tags')
print(f'📊 Sparse courses remaining: {len(sparse)}')
