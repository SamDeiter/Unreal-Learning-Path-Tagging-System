"""Check whisper priority vs actual captures and transcripts."""
import json
from pathlib import Path

d = json.load(open("content/epic_learning/whisper_priority.json"))
print(f"Priority list: {d['total']} total videos, {len(d['videos'])} entries")

# Count unique articles
articles = set()
for v in d["videos"]:
    articles.add(v.get("article_hash", "?"))
print(f"Unique articles: {len(articles)}")

# Show all videos
for i, v in enumerate(d["videos"]):
    print(f"  [{i+1}] {v.get('id','?')}: {v.get('title','?')[:60]}")

# Captured streams
streams = json.load(open("content/epic_learning/cms_stream_urls.json"))
print(f"\nCaptured DASH streams: {len(streams)}")

# Whisper transcripts produced so far
whisper_dir = Path("content/epic_learning/transcripts")
whisper_files = sorted(whisper_dir.glob("whisper_*.txt"))
print(f"Whisper transcripts so far: {len(whisper_files)}")
for f in whisper_files:
    print(f"  {f.name} ({f.stat().st_size / 1024:.1f} KB)")
