"""fetch_yt_channel_transcripts.py — Download transcripts for @UnrealEngine
YouTube videos that are missing from our content.

Uses yt-dlp to enumerate channel videos, cross-references against our
manifest, and downloads transcripts for anything missing.

Also grabs specific user-requested videos by ID.

Usage:
  python scripts/fetch_yt_channel_transcripts.py                    # Full run
  python scripts/fetch_yt_channel_transcripts.py --max-videos 10    # Test subset
  python scripts/fetch_yt_channel_transcripts.py --channel-limit 50 # Fewer videos
"""

import argparse
import json
import re
import subprocess
import time
from pathlib import Path

MANIFEST_PATH = Path("content/epic_learning/video_manifest.json")
TRANSCRIPT_DIR = Path("content/epic_learning/transcripts")

# User-specified video IDs to always include
EXTRA_VIDEO_IDS = [
    "Dc1PPYl2uxA",  # User-requested
    "SeNM9zBPLCA",  # "Exploring the depths of the Sky & Atmosphere system"
]

# Keywords indicating technical/tutorial content
TECH_KW = [
    "tutorial", "how to", "tips", "trick", "blueprint", "material",
    "animation", "niagara", "nanite", "lumen", "pcg", "metahuman",
    "render", "lighting", "shader", "mesh", "geometry", "vfx",
    "physics", "chaos", "control rig", "sequencer", "landscape",
    "foliage", "umg", "widget", "ui", "hud", "input", "gameplay",
    "c++", "python", "optimization", "performance", "debug",
    "plugin", "editor", "asset", "import", "export", "deep dive",
    "explained", "walkthrough", "getting started", "introduction",
    "begin play", "sample", "template", "state tree", "behavior tree",
    "ai ", "navigation", "procedural", "world partition", "level",
    "unreal fest", "gdc", "camera", "audio", "sound", "witcher",
    "profiling", "destruction", "stylized", "configurator",
    "verse", "uefn", "hmi", "virtual production", "digital twin",
    "motion design", "rigging", "groom", "hair", "metahuman",
    "101 ", "beginner", "first steps", "overview", "workflow",
]


def is_technical(title):
    tl = title.lower()
    return any(kw in tl for kw in TECH_KW)


def get_existing_yt_ids():
    """Get all YouTube IDs we already have transcripts or manifest entries for."""
    ids = set()
    
    # From manifest
    m = json.load(open(MANIFEST_PATH))
    for v in m.get("youtube_videos", []):
        ids.add(v.get("id", ""))
    
    # From existing transcripts (some may be named by YT ID)
    for t in TRANSCRIPT_DIR.glob("*.txt"):
        if len(t.stem) == 11 and not t.stem.startswith("cms_") and not t.stem.startswith("whisper_"):
            ids.add(t.stem)
    
    return ids


def enumerate_channel(channel_limit=200):
    """Get recent video IDs from @UnrealEngine channel."""
    print(f"  Enumerating @UnrealEngine channel (up to {channel_limit} videos)...")
    result = subprocess.run(
        ["yt-dlp", "--flat-playlist",
         "--print", "%(id)s\t%(title)s\t%(duration_string)s",
         "--playlist-end", str(channel_limit),
         "https://www.youtube.com/@UnrealEngine/videos"],
        capture_output=True, text=True, timeout=120
    )
    
    videos = []
    for line in result.stdout.strip().split("\n"):
        parts = line.split("\t")
        if len(parts) >= 2:
            videos.append({
                "id": parts[0].strip(),
                "title": parts[1].strip(),
                "duration": parts[2].strip() if len(parts) > 2 else "?",
            })
    return videos


def fetch_transcript(video_id, output_path):
    """Download transcript for a single YouTube video using yt-dlp."""
    cmd = [
        "yt-dlp",
        "--skip-download",
        "--write-auto-subs",
        "--sub-lang", "en",
        "--sub-format", "vtt",
        "--convert-subs", "srt",
        "-o", str(output_path.with_suffix("")),  # yt-dlp adds extension
        f"https://www.youtube.com/watch?v={video_id}",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    
    # yt-dlp creates .en.srt file
    srt_path = output_path.with_suffix("").parent / f"{output_path.stem}.en.srt"
    
    # Also check for variations
    possible = [
        srt_path,
        output_path.with_suffix(".en.srt"),
        output_path.parent / f"{output_path.stem}.en.vtt",
    ]
    
    for p in possible:
        if p.exists():
            # Convert SRT/VTT to plain text
            text = srt_to_text(p.read_text(encoding="utf-8", errors="ignore"))
            if len(text.strip()) > 50:
                with open(output_path, "w", encoding="utf-8") as f:
                    f.write(text)
                p.unlink()  # Remove SRT/VTT
                return True
            p.unlink()
    
    # Fallback: try fetching transcript directly
    cmd2 = [
        "yt-dlp",
        "--skip-download",
        "--write-subs",
        "--sub-lang", "en",
        "--sub-format", "vtt",
        "--convert-subs", "srt",
        "-o", str(output_path.with_suffix("")),
        f"https://www.youtube.com/watch?v={video_id}",
    ]
    result2 = subprocess.run(cmd2, capture_output=True, text=True, timeout=60)
    
    for p in possible:
        if p.exists():
            text = srt_to_text(p.read_text(encoding="utf-8", errors="ignore"))
            if len(text.strip()) > 50:
                with open(output_path, "w", encoding="utf-8") as f:
                    f.write(text)
                p.unlink()
                return True
            p.unlink()
    
    return False


def srt_to_text(srt_content):
    """Convert SRT/VTT content to clean plain text."""
    lines = []
    seen = set()
    for line in srt_content.split("\n"):
        line = line.strip()
        if not line or line.startswith("WEBVTT") or line.startswith("NOTE"):
            continue
        if re.match(r"^\d+$", line):
            continue
        if re.match(r"^\d{2}:\d{2}", line):
            continue
        if "-->" in line:
            continue
        # Remove HTML tags and timestamps
        line = re.sub(r"<[^>]+>", "", line)
        line = re.sub(r"\{[^}]+\}", "", line)
        if line and line not in seen:
            lines.append(line)
            seen.add(line)
    return " ".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Fetch YouTube channel transcripts")
    parser.add_argument("--max-videos", type=int, help="Limit videos to process")
    parser.add_argument("--channel-limit", type=int, default=200,
                        help="How many channel videos to enumerate")
    args = parser.parse_args()
    
    start = time.time()
    TRANSCRIPT_DIR.mkdir(parents=True, exist_ok=True)
    
    existing_ids = get_existing_yt_ids()
    print(f"  Existing YouTube IDs in manifest/transcripts: {len(existing_ids)}")
    
    # Enumerate channel
    channel_videos = enumerate_channel(args.channel_limit)
    print(f"  Channel videos found: {len(channel_videos)}")
    
    # Find missing technical videos
    to_fetch = []
    for v in channel_videos:
        if v["id"] not in existing_ids and is_technical(v["title"]):
            to_fetch.append(v)
    
    # Add user-specified extras
    for extra_id in EXTRA_VIDEO_IDS:
        if extra_id not in existing_ids:
            # Check if already in to_fetch
            if not any(v["id"] == extra_id for v in to_fetch):
                to_fetch.append({"id": extra_id, "title": f"(user-requested: {extra_id})", "duration": "?"})
    
    if args.max_videos:
        to_fetch = to_fetch[:args.max_videos]
    
    total = len(to_fetch)
    print(f"  Videos to fetch: {total}")
    print(f"\n  {'='*60}")
    print(f"  Fetching YouTube transcripts ({total} videos)")
    print(f"  {'='*60}\n")
    
    success = 0
    no_subs = 0
    errors = 0
    
    for i, v in enumerate(to_fetch, 1):
        vid_id = v["id"]
        title_short = v["title"][:55]
        output_path = TRANSCRIPT_DIR / f"yt_{vid_id}.txt"
        
        if output_path.exists():
            print(f"  [{i}/{total}] ✓ cached   {title_short}")
            success += 1
            continue
        
        try:
            ok = fetch_transcript(vid_id, output_path)
            if ok:
                size_kb = output_path.stat().st_size / 1024
                print(f"  [{i}/{total}] ✓ {size_kb:.1f}KB  {title_short}")
                success += 1
            else:
                print(f"  [{i}/{total}] ○ no subs  {title_short}")
                no_subs += 1
        except Exception as e:
            print(f"  [{i}/{total}] ✗ error   {title_short}: {e}")
            errors += 1
    
    print(f"\n  {'='*60}")
    print(f"  Transcripts saved:  {success}")
    print(f"  No subtitles:       {no_subs}")
    print(f"  Errors:             {errors}")
    print(f"  Output:             {TRANSCRIPT_DIR}")
    print(f"  Time:               {time.time() - start:.1f}s")
    print(f"  {'='*60}")


if __name__ == "__main__":
    main()
