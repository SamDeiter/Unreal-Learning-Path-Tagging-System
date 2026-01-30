"""
Fix edges.json to use proper tag_id format
Maps simple terms like 'blueprint' to 'scripting.blueprint'
"""
import json
from pathlib import Path

# Load tags and build lookup
tags_file = json.loads(Path('path-builder/src/data/tags.json').read_text())
tags = tags_file['tags']

# Build mapping from simple name to tag_id
name_to_id = {}
for t in tags:
    tag_id = t['tag_id']
    display = t.get('display_name', '').lower()
    
    # Map by display name parts
    for part in display.replace('/', ' ').split():
        name_to_id[part.lower()] = tag_id
    
    # Also map by tag_id suffix (e.g., "blueprint" from "scripting.blueprint")
    suffix = tag_id.split('.')[-1].lower()
    name_to_id[suffix] = tag_id
    
    # Map synonyms
    for syn in t.get('synonyms', []):
        name_to_id[syn.lower()] = tag_id
    
    # Map aliases
    for alias in t.get('aliases', []):
        name_to_id[alias.get('value', '').lower()] = tag_id

print(f"Built mappings for {len(name_to_id)} terms -> {len(tags)} tags")
print(f"Sample: 'blueprint' -> {name_to_id.get('blueprint')}")
print(f"Sample: 'niagara' -> {name_to_id.get('niagara')}")
print(f"Sample: 'material' -> {name_to_id.get('material')}")

# Load and fix edges
edges = json.loads(Path('path-builder/src/data/edges.json').read_text())
print(f"\nProcessing {len(edges)} edges...")

valid_tag_ids = {t['tag_id'] for t in tags}
fixed_edges = []
dropped = 0

for e in edges:
    source = e.get('sourceTagId', e.get('source', '')).lower()
    target = e.get('targetTagId', e.get('target', '')).lower()
    
    # Map to proper tag_ids
    source_id = name_to_id.get(source, source)
    target_id = name_to_id.get(target, target)
    
    # Only keep if both tags exist
    if source_id in valid_tag_ids and target_id in valid_tag_ids and source_id != target_id:
        fixed_edges.append({
            'sourceTagId': source_id,
            'targetTagId': target_id,
            'weight': e['weight'],
            'type': e.get('type', 'related')
        })
    else:
        dropped += 1

# Dedupe
seen = set()
deduped = []
for e in fixed_edges:
    key = tuple(sorted([e['sourceTagId'], e['targetTagId']]))
    if key not in seen:
        seen.add(key)
        deduped.append(e)

deduped.sort(key=lambda x: -x['weight'])
print(f"Kept {len(deduped)} edges, dropped {dropped}")
print(f"Top edges: {[(e['sourceTagId'], e['targetTagId'], e['weight']) for e in deduped[:5]]}")

# Save
Path('path-builder/src/data/edges.json').write_text(json.dumps(deduped, indent=2))
print(f"\n✅ Saved {len(deduped)} edges to edges.json")
