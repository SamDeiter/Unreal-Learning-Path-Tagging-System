"""Find how doc courses link to YouTube videos and check those links."""
import json
import urllib.request
import urllib.error
import time
import re

with open("path-builder/src/data/video_library_enriched.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Find YouTube IDs referenced in doc courses
yt_pattern = re.compile(r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})')

doc_yt_refs = []
for c in data["courses"]:
    if c.get("source") != "epic_docs":
        continue
    # Search all string values in the course for YouTube IDs
    course_str = json.dumps(c)
    matches = yt_pattern.findall(course_str)
    if matches:
        for vid_id in set(matches):
            doc_yt_refs.append({
                "doc_code": c.get("code", ""),
                "doc_title": c.get("title", ""),
                "youtube_id": vid_id,
            })

print(f"Found {len(doc_yt_refs)} YouTube references in {len(set(r['doc_code'] for r in doc_yt_refs))} doc courses")

# Also find YouTube IDs in the youtube_url or video_url fields  
for c in data["courses"]:
    for field in ["youtube_url", "video_url", "url"]:
        val = c.get(field, "")
        if val and "youtube" in val:
            print(f"  {c.get('source','?')} course '{c.get('title','?')[:40]}' has {field}={val[:60]}")

# Check first 10 doc-referenced YouTube links
print(f"\nChecking doc-referenced YouTube links...")
dead_refs = []
for i, ref in enumerate(doc_yt_refs[:30]):
    vid_id = ref["youtube_id"]
    url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={vid_id}&format=json"
    try:
        req = urllib.request.Request(url)
        req.add_header("User-Agent", "Mozilla/5.0")
        with urllib.request.urlopen(req, timeout=10) as resp:
            pass  # alive
    except urllib.error.HTTPError as e:
        if e.code in (401, 403, 404):
            dead_refs.append(ref)
            print(f"  DEAD: {ref['doc_title'][:50]} -> {vid_id}")
    except Exception:
        pass
    time.sleep(0.3)

print(f"\nResults: {len(dead_refs)} dead YouTube refs in doc courses")
for d in dead_refs:
    print(f"  {d['doc_title'][:50]:50} {d['youtube_id']}")
