"""Enrich remaining sparse courses with Gemini API."""

import json
import os
import urllib.request
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv('GEMINI_API_KEY')

data = json.loads(Path('content/video_library_enriched.json').read_text())
sparse = [c for c in data['courses'] if len(c.get('canonical_tags', [])) < 2]

print(f'Found {len(sparse)} sparse courses to enrich')

# Process in batches
VALID_TAGS = ['rendering.material', 'rendering.lighting', 'rendering.lumen', 'rendering.nanite',
              'animation.general', 'animation.control_rig', 'scripting.blueprint', 'scripting.cpp',
              'environment.landscape', 'environment.foliage', 'vfx.niagara', 'ui.umg',
              'cinematic.sequencer', 'optimization.general', 'platform.mobile', 'industry.aec',
              'industry.automotive', 'audio.metasounds', 'physics.general', 'rendering.postprocess']

for batch_start in range(0, len(sparse), 10):
    batch = sparse[batch_start:batch_start + 10]
    
    prompt = f'''Analyze these UE5 training course titles and return canonical tags for each.
Use ONLY these tag categories: {', '.join(VALID_TAGS)}

'''
    for i, c in enumerate(batch):
        prompt += f"{i+1}. {c['title']}\n"
    
    prompt += '\nReturn ONLY a JSON array of arrays, one per course. Example: [["tag1","tag2"], ["tag1"]]'
    
    print(f'\nBatch {batch_start//10 + 1}: Processing {len(batch)} courses...')
    
    try:
        req_data = {'contents': [{'parts': [{'text': prompt}]}], 
                    'generationConfig': {'temperature': 0.2, 'maxOutputTokens': 500}}
        req = urllib.request.Request(
            f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}',
            data=json.dumps(req_data).encode(), 
            headers={'Content-Type': 'application/json'}, 
            method='POST')
        
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            text = result['candidates'][0]['content']['parts'][0]['text']
            
            # Extract JSON
            if '```json' in text:
                text = text.split('```json')[1].split('```')[0]
            elif '```' in text:
                text = text.split('```')[1].split('```')[0]
            
            tags_list = json.loads(text.strip())
            
            # Apply tags
            for i, tags in enumerate(tags_list):
                if i < len(batch):
                    code = batch[i]['code']
                    existing = set(batch[i].get('canonical_tags', []))
                    # Filter to valid tags only
                    valid = [t for t in tags if t in VALID_TAGS]
                    batch[i]['canonical_tags'] = sorted(existing | set(valid))
                    print(f"  {code}: {batch[i]['canonical_tags']}")
    
    except Exception as e:
        print(f"  Error: {e}")

# Save all
for p in [Path('content/video_library_enriched.json'),
          Path('path-builder/src/data/video_library.json'),
          Path('path-builder/src/data/video_library_enriched.json')]:
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False))

print('\n✅ Saved to all data files!')

# Verify
still_sparse = [c for c in data['courses'] if len(c.get('canonical_tags', [])) < 2]
print(f'Remaining sparse: {len(still_sparse)}')
