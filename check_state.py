import json
from pathlib import Path

data = json.loads(Path('content/video_library_enriched.json').read_text())
courses = data['courses']

# Find course without tags
no_tags = [c for c in courses if not c.get('has_ai_tags')]
sparse = [c for c in courses if len(c.get('canonical_tags', [])) < 3]

print(f"Total courses: {len(courses)}")
print(f"AI-enriched (has_ai_tags=True): {sum(1 for c in courses if c.get('has_ai_tags'))}")
print(f"Sparse courses (<3 canonical): {len(sparse)}")
print()

if no_tags:
    print("Courses without tags:")
    for c in no_tags:
        print(f"  {c['code']}: {c['title']}")
else:
    print("All courses have tags!")
