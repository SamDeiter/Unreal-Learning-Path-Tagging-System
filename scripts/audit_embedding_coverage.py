"""
audit_embedding_coverage.py — Compare courses across all data sources
to find which courses are missing embeddings.
"""
import json, os
from collections import defaultdict

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

# --- Load data ---
with open(os.path.join(ROOT, "prototype", "video_lookup.json"), "r", encoding="utf-8") as f:
    video_lookup = json.load(f)

with open(os.path.join(ROOT, "path-builder", "src", "data", "segment_index.json"), "r", encoding="utf-8") as f:
    segment_index = json.load(f)  # dict: { "100.01": { videos: { ... } } }

with open(os.path.join(ROOT, "path-builder", "src", "data", "segment_embeddings.json"), "r", encoding="utf-8") as f:
    embeddings_data = json.load(f)  # dict with "segments" key
    segment_embeddings = embeddings_data.get("segments", {})

# Augmentation results
aug_dir = os.path.join(ROOT, "prompts", "augmentation_results")
augmented_courses = set(os.listdir(aug_dir)) if os.path.isdir(aug_dir) else set()

# --- Extract course codes ---

# video_lookup keys: "201_03/08_SubSurface" → course "201_03"
video_courses = defaultdict(list)
for key in video_lookup:
    course = key.split("/")[0]
    video_courses[course].append(key)

# segment_index keys: "100.01" (dot-separated course codes with videos inside)
indexed_courses = {}
for course_code, data in segment_index.items():
    if isinstance(data, dict) and "videos" in data:
        indexed_courses[course_code] = len(data["videos"])

# segment_embeddings: each segment has "course_code"
embedded_courses = defaultdict(int)
for seg_id, seg in segment_embeddings.items():
    cc = seg.get("course_code", "unknown")
    embedded_courses[cc] += 1

# Normalize course codes: video_lookup uses "201_03", segment_index uses "201.03"
def normalize(code):
    return code.replace(".", "_")

all_video_normalized = set(normalize(c) for c in video_courses.keys())
all_indexed_normalized = set(normalize(c) for c in indexed_courses.keys())
all_embedded_normalized = set(normalize(c) for c in embedded_courses.keys())

# --- Report ---
all_codes = sorted(all_video_normalized | all_indexed_normalized | all_embedded_normalized)

print("=" * 95)
print(f"{'COURSE':<15} {'VIDEOS':>8} {'INDEXED':>9} {'EMBEDDED':>10} {'AUGMENTED':>11} {'STATUS':<20}")
print("=" * 95)

missing = []
indexed_only = []
complete = []

for code in all_codes:
    dot_code = code.replace("_", ".")
    vid_count = len(video_courses.get(code, []))
    idx_count = indexed_courses.get(dot_code, 0)
    emb_count = embedded_courses.get(dot_code, 0)
    aug = "✅" if code in augmented_courses else "❌"
    
    if emb_count > 0:
        status = "✅ EMBEDDED"
        complete.append(code)
    elif idx_count > 0:
        status = "⚠️  INDEXED ONLY"
        indexed_only.append(code)
    elif vid_count > 0:
        status = "❌ MISSING"
        missing.append(code)
    else:
        status = "❓ UNKNOWN"
    
    print(f"{code:<15} {vid_count:>8} {idx_count:>9} {emb_count:>10} {aug:>11} {status:<20}")

print("=" * 95)
print(f"\n📊 SUMMARY")
print(f"  Total course groups in video library:  {len(video_courses)}")
print(f"  Courses in segment_index:              {len(indexed_courses)}")
print(f"  Courses with embeddings:               {len(embedded_courses)}")
print(f"  Total embedded segments:               {len(segment_embeddings)}")
print(f"  Courses with augmentation data:        {len(augmented_courses)}")
print()
print(f"  ✅ Fully embedded:     {len(complete)}")
print(f"  ⚠️  Indexed, not embedded: {len(indexed_only)}")
print(f"  ❌ Not indexed at all:  {len(missing)}")

if missing:
    print(f"\n{'='*60}")
    print(f"🔴 MISSING COURSES — Videos exist, NO embeddings:")
    print(f"{'='*60}")
    total_missing_videos = 0
    for c in sorted(missing):
        vids = video_courses.get(c, [])
        total_missing_videos += len(vids)
        print(f"\n  📁 {c} ({len(vids)} videos)")
        for v in sorted(vids)[:8]:
            name = video_lookup[v].get("name", v)
            print(f"     └─ {name}")
        if len(vids) > 8:
            print(f"     └─ ... and {len(vids) - 8} more")
    print(f"\n  TOTAL: {len(missing)} courses, {total_missing_videos} videos without embeddings")

coverage = len(complete) / max(len(all_codes), 1) * 100
print(f"\n📈 Embedding Coverage: {coverage:.1f}% ({len(complete)}/{len(all_codes)} courses)")
