"""Data Quality Validation Script.

Checks for holes and missing data in the enriched courses.
"""

import json
from collections import Counter
from pathlib import Path

# Root Path relative to script
REPO_ROOT = Path(__file__).resolve().parent.parent
path = REPO_ROOT / "content" / "video_library_enriched.json"
data = json.loads(path.read_text(encoding='utf-8'))
courses = data.get('courses', [])

print("=" * 60)
print("DATA QUALITY VALIDATION")
print("=" * 60)

# Basic counts
print("\n📊 OVERVIEW")
print(f"   Total courses: {len(courses)}")

# Check for missing fields
issues = []

print("\n🔍 CHECKING FOR MISSING DATA...")

# Required fields
required_fields = ['code', 'title', 'ai_tags', 'canonical_tags', 'has_ai_tags',
                   'difficulty', 'duration_minutes', 'video_count']

missing_by_field = {f: [] for f in required_fields}

for course in courses:
    code = course.get('code', 'UNKNOWN')

    for field in required_fields:
        if field not in course or course[field] is None or field in ['ai_tags', 'canonical_tags'] and len(course[field]) == 0:
            missing_by_field[field].append(code)

# Report missing
for field, missing in missing_by_field.items():
    if missing:
        print(f"\n   ❌ Missing '{field}': {len(missing)} courses")
        if len(missing) <= 5:
            for code in missing:
                print(f"      - {code}")
        else:
            for code in missing[:3]:
                print(f"      - {code}")
            print(f"      ... and {len(missing)-3} more")
    else:
        print(f"   ✅ '{field}': All courses have data")

# Tag distribution
print("\n📈 TAG DISTRIBUTION")
ai_tag_counts = [len(c.get('ai_tags', [])) for c in courses]
canonical_counts = [len(c.get('canonical_tags', [])) for c in courses]

print(f"   AI tags: min={min(ai_tag_counts)}, max={max(ai_tag_counts)}, avg={sum(ai_tag_counts)/len(ai_tag_counts):.1f}")
print(f"   Canonical: min={min(canonical_counts)}, max={max(canonical_counts)}, avg={sum(canonical_counts)/len(canonical_counts):.1f}")

# Courses with very few tags
sparse = [c for c in courses if len(c.get('canonical_tags', [])) < 2]
if sparse:
    print(f"\n   ⚠️  Sparse courses (<2 canonical tags): {len(sparse)}")
    for c in sparse[:5]:
        print(f"      - {c['code']}: {c['title'][:40]}... ({len(c.get('canonical_tags', []))} tags)")

# Check difficulty distribution
print("\n📊 DIFFICULTY BREAKDOWN")
diff_counts = Counter(c.get('difficulty') for c in courses)
for d in sorted(diff_counts.keys()):
    if d is not None:
        print(f"   Level {d}: {diff_counts[d]} courses")
    else:
        print(f"   No difficulty: {diff_counts[d]} courses")

# Check for duplicates
print("\n🔍 CHECKING FOR DUPLICATES")
codes = [c.get('code') for c in courses]
dupe_codes = [code for code, count in Counter(codes).items() if count > 1]
if dupe_codes:
    print(f"   ❌ Duplicate course codes: {dupe_codes}")
else:
    print("   ✅ No duplicate course codes")

titles = [c.get('title') for c in courses]
dupe_titles = [t for t, count in Counter(titles).items() if count > 1]
if dupe_titles:
    print(f"   ⚠️  Duplicate titles: {len(dupe_titles)}")
    for t in dupe_titles[:3]:
        print(f"      - {t[:50]}")
else:
    print("   ✅ No duplicate titles")

print("\n" + "=" * 60)
print("VALIDATION COMPLETE")
print("=" * 60)
