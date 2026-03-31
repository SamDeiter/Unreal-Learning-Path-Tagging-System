"""Quick audit: which priority videos are missing Whisper transcripts?"""
import json
from pathlib import Path

PRIORITY = Path("content/epic_learning/whisper_priority.json")
TRANSCRIPT_DIR = Path("content/epic_learning/transcripts")
STREAM_URLS = Path("content/epic_learning/cms_stream_urls_v2.json")

priority = json.load(open(PRIORITY))["videos"]

# Check stream URLs
stream_urls = {}
if STREAM_URLS.exists():
    stream_urls = json.load(open(STREAM_URLS))

missing = []
for v in priority:
    vid = v["id"]
    t_path = TRANSCRIPT_DIR / f"whisper_{vid}.txt"
    if not t_path.exists():
        has_mpd = vid in stream_urls and bool(stream_urls[vid].get("mpd_xml"))
        missing.append({"id": vid, "title": v["article_title"], "has_mpd": has_mpd})

print(f"Total priority videos: {len(priority)}")
print(f"Already transcribed:   {len(priority) - len(missing)}")
print(f"Missing transcripts:   {len(missing)}")
print()

need_phase_a = [m for m in missing if not m["has_mpd"]]
need_phase_b = [m for m in missing if m["has_mpd"]]

print(f"Need Phase A (stream URL capture): {len(need_phase_a)}")
print(f"Need Phase B only (have MPD, need transcription): {len(need_phase_b)}")
print()

if missing:
    print("Missing videos:")
    for m in missing:
        status = "has MPD" if m["has_mpd"] else "needs capture"
        print(f"  [{status}] {m['id']}: {m['title'][:65]}")
