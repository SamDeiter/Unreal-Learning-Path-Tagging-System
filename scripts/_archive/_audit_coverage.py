"""Audit transcript coverage against the video manifest."""
import json
from pathlib import Path

manifest = json.load(open("content/epic_learning/video_manifest.json"))
transcript_dir = Path("content/epic_learning/transcripts")
existing = {t.stem for t in transcript_dir.glob("*.txt")}

# Check whisper_priority.json
try:
    priority = json.load(open("content/epic_learning/whisper_priority.json"))
    print(f"whisper_priority.json: {priority['total']} videos were queued")
except Exception:
    print("No whisper_priority.json found")

# YouTube coverage
yt_videos = manifest.get("youtube_videos", [])
deleted_garbage = [
    "reqac5S3hJg", "FHPgImnBk0s", "migUPQ1jcqc",
    "W45mkuf3m4g", "flEtQBPtBTc", "XQkS3A1i0DU",
]
print(f"\n=== YOUTUBE ({len(yt_videos)} in manifest) ===")
yt_found = 0
for v in yt_videos:
    vid = v["id"]
    if vid in existing:
        yt_found += 1
    else:
        tag = "(deleted garbage)" if vid in deleted_garbage else "(never transcribed)"
        print(f"  MISSING: {vid} {tag}")
print(f"Coverage: {yt_found}/{len(yt_videos)}")

# CMS coverage
cms_videos = manifest.get("cms_videos", [])
cms_missing = []
cms_found = 0
for v in cms_videos:
    vid = v["id"]
    if any(vid in stem for stem in existing):
        cms_found += 1
    else:
        cms_missing.append(v)

by_article = {}
for v in cms_missing:
    title = v.get("article_title", "Unknown")
    by_article.setdefault(title, []).append(v["id"])

print(f"\n=== CMS ({len(cms_videos)} in manifest) ===")
print(f"Coverage: {cms_found}/{len(cms_videos)}")
print(f"Missing: {len(cms_missing)} videos across {len(by_article)} articles:\n")
for title, vids in sorted(by_article.items()):
    print(f"  [{len(vids)} videos] {title[:70]}")
    for vid in vids:
        print(f"    - {vid}")
