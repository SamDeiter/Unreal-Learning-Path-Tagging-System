"""Cross-reference @UnrealEngine YouTube channel against our manifest."""
import json
import subprocess

# Get our existing YouTube video IDs
m = json.load(open("content/epic_learning/video_manifest.json"))
our_yt_ids = set()
for v in m.get("youtube_videos", []):
    our_yt_ids.add(v.get("id", ""))

# Also check transcripts directory for any IDs
from pathlib import Path
transcript_stems = {t.stem for t in Path("content/epic_learning/transcripts").glob("*.txt")}

print(f"Our manifest YouTube IDs: {len(our_yt_ids)}")

# Get channel videos via yt-dlp (last 200)
result = subprocess.run(
    ["yt-dlp", "--flat-playlist", "--print", "%(id)s\t%(title)s\t%(duration_string)s",
     "--playlist-end", "200",
     "https://www.youtube.com/@UnrealEngine/videos"],
    capture_output=True, text=True, timeout=120
)

channel_videos = []
for line in result.stdout.strip().split("\n"):
    parts = line.split("\t")
    if len(parts) >= 2:
        vid_id = parts[0].strip()
        title = parts[1].strip() if len(parts) > 1 else ""
        duration = parts[2].strip() if len(parts) > 2 else "?"
        channel_videos.append({"id": vid_id, "title": title, "duration": duration})

print(f"Channel videos fetched: {len(channel_videos)}")

# Find missing ones
missing = []
for v in channel_videos:
    if v["id"] not in our_yt_ids:
        missing.append(v)

# Categorize by relevance
TECH_KW = ["tutorial", "how to", "tips", "trick", "blueprint", "material",
           "animation", "niagara", "nanite", "lumen", "pcg", "metahuman",
           "render", "lighting", "shader", "mesh", "geometry", "vfx",
           "physics", "chaos", "control rig", "sequencer", "landscape",
           "foliage", "umg", "widget", "ui", "hud", "input", "gameplay",
           "c++", "python", "optimization", "performance", "debug",
           "plugin", "editor", "asset", "import", "export", "deep dive",
           "explained", "walkthrough", "getting started", "introduction",
           "begin play", "sample", "template", "state tree", "behavior tree",
           "ai ", "navigation", "procedural", "world partition", "level",
           "unreal fest", "gdc", "camera", "audio", "sound"]

def is_technical(title):
    tl = title.lower()
    return any(kw in tl for kw in TECH_KW)

technical = [v for v in missing if is_technical(v["title"])]
non_technical = [v for v in missing if not is_technical(v["title"])]

print(f"\n{'='*80}")
print(f"MISSING FROM OUR CONTENT: {len(missing)} / {len(channel_videos)}")
print(f"  Technical/Tutorial: {len(technical)}")
print(f"  Other: {len(non_technical)}")

print(f"\n{'='*80}")
print(f"TECHNICAL VIDEOS WE'RE MISSING ({len(technical)}):")
print(f"{'='*80}")
for v in technical:
    print(f"  {v['duration']:>8} | {v['id']} | {v['title'][:75]}")

print(f"\n{'='*80}")
print(f"OTHER VIDEOS ({len(non_technical)}):")
print(f"{'='*80}")
for v in non_technical[:30]:
    print(f"  {v['duration']:>8} | {v['id']} | {v['title'][:75]}")
if len(non_technical) > 30:
    print(f"  ... and {len(non_technical) - 30} more")

# Check user's specific videos
for check_id in ["Dc1PPYl2uxA", "SeNM9zBPLCA"]:
    found = [v for v in channel_videos if v["id"] == check_id]
    in_ours = check_id in our_yt_ids
    if found:
        print(f"\n  ✓ {check_id} ON CHANNEL: {found[0]['title'][:60]} (in manifest: {in_ours})")
    else:
        print(f"\n  ○ {check_id} NOT in last 200 channel videos (in manifest: {in_ours})")
